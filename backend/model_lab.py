# [11] MODEL LAB -benchmarks 7 ML algorithms on the same GWP dataset and builds the prediction
#      analysis (actual vs predicted, residuals, feature importance, per-metal error, heatmaps).
"""
EcoForge - Model Lab (benchmarking + prediction analysis)

DATA: the 1,600 rows in data/training_dataset.csv are GENERATED scenarios (train_real_model.py),
built from cited factors (IAI, worldsteel, ICA, Ehrenberger) with a known equation + 3% noise.
They are not measured plant data.

PROTOCOL (no test data is used for any choice):
    1. Split 80/20 once (random_state=42). The 20% test set (320 rows) is locked away.
    2. Model selection: 5-fold cross-validation on the 1,280 TRAINING rows only. Scaling for
       SVR/KNN sits inside a Pipeline, so it is re-fitted on each training fold.
    3. The winner (best mean CV R2) is fitted on the training rows and evaluated ONCE on the
       test set. Those test numbers are what we report.
    4. Baselines on the same test set: the generating equation itself (no noise) and the
       plain calculator (cited factors mixed by scrap share, grid/ore ignored).
    5. Prediction interval: +/-1.96 x the per-metal std of OUT-OF-FOLD training residuals.
       Its actual coverage is then measured on the test set (approximate, not guaranteed).

The evaluated model (trained on the training split, scaler included) is DEPLOYED to
models/gwp_model.pkl and used by /api/predict-gwp, together with its metadata.

Run:  venv\\Scripts\\python.exe model_lab.py
Output: models/model_lab.json   (served to the frontend by GET /api/model-lab)
        models/gwp_model.pkl    (winning model, used for live predictions)
        data/model_benchmark.md (benchmark table for the report)
"""

import hashlib
import json
import joblib
import platform
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from sklearn.model_selection import KFold, cross_val_predict, cross_validate, train_test_split, learning_curve
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor

BASE = Path(__file__).parent
DATA = BASE / "data"
OUT = BASE / "models" / "model_lab.json"
DEPLOY = BASE / "models" / "gwp_model.pkl"
TARGET = "gwp_t_co2e_per_tonne"
NUMERIC = ["recycled_content", "grid_intensity_tco2_mwh", "ore_grade_factor", "transport_km"]

# name -> (estimator, family, one-line description)
MODELS = {
    "Linear Regression": (LinearRegression(), "Linear",
                          "Fits a straight-line relation between inputs and CO2. Fast baseline."),
    "Decision Tree": (DecisionTreeRegressor(max_depth=10, random_state=42), "Tree",
                      "Splits the data into if-else rules. Easy to read but can overfit."),
    "Random Forest": (RandomForestRegressor(n_estimators=300, max_depth=14, random_state=42, n_jobs=-1), "Ensemble (bagging)",
                      "Averages 300 decision trees trained on random samples. Stable and accurate."),
    "XGBoost": (XGBRegressor(n_estimators=400, learning_rate=0.05, max_depth=6, subsample=0.9,
                             colsample_bytree=0.9, random_state=42, n_jobs=-1), "Ensemble (boosting)",
                "Builds trees one after another, each fixing the errors of the last."),
    "Gradient Boosting": (GradientBoostingRegressor(n_estimators=300, learning_rate=0.05, max_depth=4, random_state=42),
                          "Ensemble (boosting)", "scikit-learn boosting; similar idea to XGBoost."),
    "KNN": (make_pipeline(StandardScaler(), KNeighborsRegressor(n_neighbors=7, weights="distance")), "Instance-based",
            "Predicts from the 7 most similar past scenarios."),
    "SVR": (make_pipeline(StandardScaler(), SVR(C=30, epsilon=0.05, gamma="scale")), "Kernel",
            "Support Vector Regression with an RBF kernel; fits a smooth curve."),
}


def rmse(a, b):
    return float(np.sqrt(mean_squared_error(a, b)))


def mape(a, b):
    a, b = np.asarray(a), np.asarray(b)
    return float(np.mean(np.abs((a - b) / a)) * 100)


def r(x, n=4):
    return round(float(x), n)


def load():
    df = pd.read_csv(DATA / "training_dataset.csv")
    X = pd.get_dummies(df.drop(columns=[TARGET]), columns=["metal"]).astype(float)
    return df, X, df[TARGET]


def _factors():
    f = pd.read_csv(DATA / "lca_emission_factors.csv")
    f["cls"] = f["route"].str.split().str[0]
    out = {}
    for m in f["metal"].unique():
        p = f[(f.metal == m) & (f.cls == "Primary")].iloc[0].gwp_t_co2e_per_tonne
        rc = f[(f.metal == m) & (f.cls == "Recycled")].iloc[0].gwp_t_co2e_per_tonne
        out[m] = (float(p), float(rc))
    return out


def equation_baseline(rows, grid_and_ore=True):
    """The equation that GENERATED the data (train_real_model.py), without its 3% noise.
    grid_and_ore=False is the plain calculator: cited factors mixed by scrap share + transport."""
    fac = _factors()
    out = []
    for _, x in rows.iterrows():
        gp, gr = fac[x["metal"]]
        base = (1 - x["recycled_content"]) * gp + x["recycled_content"] * gr
        if grid_and_ore:
            base *= 0.75 * x["grid_intensity_tco2_mwh"] / 0.7117 + 0.25 * x["ore_grade_factor"]
        out.append(base + x["transport_km"] / 1000 * 0.062)
    return np.array(out)


def _metrics(yt, p):
    return {"r2": r(r2_score(yt, p)), "mae": r(mean_absolute_error(yt, p)), "rmse": r(rmse(yt, p)), "mape": r(mape(yt, p), 2)}


def run():
    df, X, y = load()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    metal_train = df.loc[X_train.index, "metal"].values
    metal_test = df.loc[X_test.index, "metal"].values
    kfold = KFold(n_splits=5, shuffle=True, random_state=42)

    # ---------- 1) model selection: 5-fold CV on the TRAINING rows only ----------
    benchmark, preds, fitted = [], {}, {}
    for name, (model, family, desc) in MODELS.items():
        cv = cross_validate(clone(model), X_train, y_train, cv=kfold, n_jobs=-1,
                            scoring={"r2": "r2", "rmse": "neg_root_mean_squared_error"})
        m = clone(model)
        t0 = time.perf_counter()
        m.fit(X_train, y_train)
        train_ms = (time.perf_counter() - t0) * 1000
        t1 = time.perf_counter()
        p = m.predict(X_test)
        predict_ms = (time.perf_counter() - t1) * 1000
        train_r2 = r2_score(y_train, m.predict(X_train))
        test = _metrics(y_test.values, p)
        benchmark.append({
            "model": name, "family": family, "description": desc,
            "cv_r2_mean": r(cv["test_r2"].mean()), "cv_r2_std": r(cv["test_r2"].std()),
            "cv_rmse_mean": r(-cv["test_rmse"].mean()),
            # test-set numbers are reported for every model but are NOT used to rank them
            **test, "train_r2": r(train_r2), "overfit_gap": r(train_r2 - test["r2"]),
            "train_ms": round(train_ms, 1), "predict_ms": round(predict_ms, 2),
        })
        preds[name] = [round(float(v), 3) for v in p]
        fitted[name] = m
        print(f"{name:18s} CV R2={cv['test_r2'].mean():.4f}+/-{cv['test_r2'].std():.4f} (train folds)   "
              f"test R2={test['r2']:.4f}  RMSE={test['rmse']:.3f}  {train_ms:.0f} ms")

    # rank by CV on the training data only; ties broken by CV RMSE
    benchmark.sort(key=lambda b: (-b["cv_r2_mean"], b["cv_rmse_mean"]))
    for i, b in enumerate(benchmark, 1):
        b["rank"] = i
    best = benchmark[0]["model"]

    # ---------- 2) final evaluation of the winner on the untouched test set ----------
    prod = fitted[best]
    p = np.array(preds[best])
    yt = y_test.values
    resid = yt - p

    # baselines on the same test rows
    test_rows = df.loc[X_test.index]
    eq = equation_baseline(test_rows, True)
    calc = equation_baseline(test_rows, False)
    baselines = [
        {"name": "Generating equation (no noise)", "note": "The formula that created the data; the best any model can approach.",
         **_metrics(yt, eq)},
        {"name": f"{best} (deployed ML model)", "note": "Learned from the 1,280 training rows only.", **_metrics(yt, p)},
        {"name": "Plain calculator (grid and ore ignored)", "note": "Cited factors mixed by scrap share, plus transport.",
         **_metrics(yt, calc)},
    ]
    ml_vs_eq = r(np.sqrt(np.mean((p - eq) ** 2)))   # how far the ML sits from the known equation

    # ---------- 3) approximate 95% interval from out-of-fold training residuals ----------
    oof = cross_val_predict(clone(MODELS[best][0]), X_train, y_train, cv=kfold, n_jobs=-1)
    oof_resid = y_train.values - oof
    sigma = {m: float(np.std(oof_resid[metal_train == m])) for m in sorted(set(metal_train))}
    inside = np.array([abs(resid[i]) <= 1.96 * sigma[metal_test[i]] for i in range(len(resid))])
    coverage = {"overall_pct": round(float(inside.mean() * 100), 1),
                "per_metal_pct": {m: round(float(inside[metal_test == m].mean() * 100), 1) for m in sorted(set(metal_test))},
                "method": "prediction +/- 1.96 x per-metal std of out-of-fold training residuals; coverage measured on the 320 test rows",
                "note": "Generated data only. Coverage on real plants has not been measured."}

    per_metal = []
    for m in sorted(set(metal_test)):
        mask = metal_test == m
        per_metal.append({
            "metal": m, "n": int(mask.sum()),
            "r2": r(r2_score(yt[mask], p[mask])), "mae": r(mean_absolute_error(yt[mask], p[mask])),
            "rmse": r(rmse(yt[mask], p[mask])), "mape": r(mape(yt[mask], p[mask]), 2),
            "mean_actual": r(yt[mask].mean(), 3),
        })

    counts, edges = np.histogram(resid, bins=20)
    # permutation importance works for every algorithm (SVR/KNN have no built-in importance)
    perm = permutation_importance(prod, X_test, y_test, n_repeats=10, random_state=42, n_jobs=-1)
    importance = sorted([
        {"feature": c, "permutation": r(pm), "permutation_std": r(ps)}
        for c, pm, ps in zip(X.columns, perm.importances_mean, perm.importances_std)
    ], key=lambda d: -d["permutation"])

    sizes, tr_scores, cv_scores = learning_curve(
        clone(MODELS[best][0]), X_train, y_train, cv=kfold, scoring="r2",
        train_sizes=np.linspace(0.1, 1.0, 8), shuffle=True, random_state=42, n_jobs=-1)  # training rows only

    within_5 = float(np.mean(np.abs(resid / yt) <= 0.05) * 100)
    within_10 = float(np.mean(np.abs(resid / yt) <= 0.10) * 100)

    # ---------- heatmaps ----------
    num = df.drop(columns=["metal"]).copy()
    for m in sorted(df["metal"].unique()):
        num[f"is_{m}"] = (df["metal"] == m).astype(int)
    corr = num.corr()

    data_hash = hashlib.sha256((DATA / "training_dataset.csv").read_bytes()).hexdigest()[:12]
    generated_at = datetime.now().isoformat(timespec="seconds")
    model_version = f"gwp-{best.lower().replace(' ', '-')}-{data_hash}"
    result = {
        "generated_at": generated_at,
        "model_version": model_version,
        "protocol": ("Generated data (1,600 scenarios). 80/20 split (random_state=42); model selection by 5-fold CV on "
                     "the 1,280 training rows only; scaling inside each fold; winner evaluated once on the 320 held-out rows."),
        "baselines": baselines,
        "ml_vs_equation_rmse": ml_vs_eq,
        "interval_coverage": coverage,
        "environment": {"python": platform.python_version(), "scikit_learn": sklearn.__version__,
                        "xgboost": xgboost.__version__, "numpy": np.__version__, "pandas": pd.__version__},
        "dataset": {
            "rows": int(len(df)), "train_rows": int(len(X_train)), "test_rows": int(len(X_test)),
            "features": [c for c in df.columns if c != TARGET], "encoded_features": list(X.columns),
            "target": TARGET, "split": "80/20, random_state=42",
            "cv": "5-fold KFold (shuffled, random_state=42) on the training rows only",
            "generated": True, "data_sha256_12": data_hash,
            "generator": "train_real_model.py build_dataset(n_per_group=400), numpy default_rng(42)",
            "per_metal": df["metal"].value_counts().sort_index().to_dict(),
            "target_stats": {k: r(v, 3) for k, v in df[TARGET].describe().items()},
        },
        "production_model": best,
        "best_model": best,
        "benchmark": benchmark,
        "test_actual": [round(float(v), 3) for v in yt],
        "test_metal": list(metal_test),
        "predictions": preds,
        "analysis": {
            "model": best,
            "residuals": [round(float(v), 3) for v in resid],
            "residual_hist": {"counts": counts.tolist(), "edges": [r(e, 3) for e in edges]},
            "residual_mean": r(resid.mean()), "residual_std": r(resid.std()),
            "within_5pct": round(within_5, 1), "within_10pct": round(within_10, 1),
            "max_abs_error": r(np.abs(resid).max(), 3),
            "per_metal": per_metal,
            "feature_importance": importance,
            "learning_curve": {
                "train_sizes": sizes.tolist(),
                "train_r2": [r(v) for v in tr_scores.mean(axis=1)],
                "cv_r2": [r(v) for v in cv_scores.mean(axis=1)],
            },
        },
        "correlation": {"labels": list(corr.columns), "matrix": [[r(v, 3) for v in row] for row in corr.values]},
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(result, indent=1), encoding="utf-8")

    # deploy EXACTLY the evaluated model (fitted on the training split; the scaler is inside the pipeline)
    win = benchmark[0]
    tr = df.loc[X_train.index]
    joblib.dump({
        "model": prod, "columns": list(X.columns), "name": best, "model_version": model_version,
        "trained_at": generated_at, "trained_on": f"{len(X_train)} generated training rows (80% split, random_state=42)",
        "params": prod.get_params(deep=True) if hasattr(prod, "get_params") else {},
        "metrics": {"r2": win["r2"], "rmse": win["rmse"], "cv_r2_mean": win["cv_r2_mean"]},
        "residual_std_by_metal": sigma,
        "interval": {"z": 1.96, "coverage_test_pct": coverage["overall_pct"], "approximate": True},
        # training range widened by 5% on each side before a warning is shown
        "feature_ranges": {c: [round(float(tr[c].min() - 0.05 * (tr[c].max() - tr[c].min())), 3),
                               round(float(tr[c].max() + 0.05 * (tr[c].max() - tr[c].min())), 3)] for c in NUMERIC},
        "environment": result["environment"],
    }, DEPLOY)

    rows = "\n".join(
        f"| {b['rank']} | {b['model']} | {b['cv_r2_mean']:.4f} ± {b['cv_r2_std']:.4f} | {b['r2']:.4f} | {b['mae']:.3f} "
        f"| {b['rmse']:.3f} | {b['mape']:.2f}% | {b['train_ms']:.0f} |" for b in benchmark)
    base_rows = "\n".join(f"| {b['name']} | {b['r2']:.4f} | {b['mae']:.3f} | {b['rmse']:.3f} | {b['mape']:.2f}% |" for b in baselines)
    (DATA / "model_benchmark.md").write_text(f"""# EcoForge - ML Model Benchmark (generated data)

{result['protocol']}
Model version `{model_version}`. Generated {generated_at}.

| Rank | Model | 5-fold CV R² (training rows) | Test R² | MAE | RMSE | MAPE | Train (ms) |
|---|---|---|---|---|---|---|---|
{rows}

Ranking uses only the CV column. Test columns are reported once, after selection.

## Baselines on the same 320 test rows

| Method | R² | MAE | RMSE | MAPE |
|---|---|---|---|---|
{base_rows}

The deployed {best} approximates the known generating equation (RMSE between them: {ml_vs_eq:.3f} t CO2e/t).

## Approximate 95% interval

{coverage['method']}. Measured coverage: {coverage['overall_pct']}% overall; per metal {coverage['per_metal_pct']}.
{coverage['note']}

{result['analysis']['within_10pct']}% of test predictions are within ±10% of the generated value.
""", encoding="utf-8")

    print(f"\nBest by 5-fold CV: {best} -> deployed to {DEPLOY.name}. Saved {OUT.name}")
    return result


def get_model_lab(refresh=False):
    """Cached results for the API; recomputes if missing or when refresh=True."""
    if refresh or not OUT.exists():
        return run()
    return json.loads(OUT.read_text(encoding="utf-8"))


if __name__ == "__main__":
    run()
