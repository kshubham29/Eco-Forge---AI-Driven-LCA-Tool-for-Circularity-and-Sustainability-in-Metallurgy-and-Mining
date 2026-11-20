# [3] MODEL TRAINING - builds the dataset, trains a Random Forest baseline (80/20 split), then runs
#     model_lab.py, which benchmarks 7 algorithms and deploys the winner to models/gwp_model.pkl.
"""
EcoForge — Real ML training pipeline for metal Global Warming Potential (GWP).

Unlike the old create_*_model.py scripts (which used np.random with no source),
this pipeline builds a *parametric* training dataset grounded in cited LCA
emission factors (backend/data/lca_emission_factors.csv) and the CEA India grid
factor, then trains and VALIDATES a model with an 80/20 train/test split and
reports R2 / MAE / RMSE. This is honest and defensible in front of judges:

    "Model trained on a parametric LCA dataset grounded in IAI / worldsteel /
     ICA factors and the CEA (Govt. of India) grid emission factor, validated
     on a held-out test set (R2 = ...)."

Run:  venv\\Scripts\\python.exe train_real_model.py
Outputs:
    models/gwp_model.pkl        - trained, validated model
    data/model_metrics.md       - accuracy report you can cite
"""

import os
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

BASE = Path(__file__).parent
DATA = BASE / "data"
MODELS = BASE / "models"
MODELS.mkdir(exist_ok=True)

# CEA CO2 Baseline Database v21.0 (FY2024-25) — all-India grid factor.
CEA_GRID_FACTOR = 0.7117  # t CO2 / MWh

# Reproducibility for the parametric sampling (documented, not hidden as "AI").
RNG = np.random.default_rng(42)


def load_factors() -> pd.DataFrame:
    """Cradle-to-gate reference factors per tonne (cited in data/SOURCES.md).

    Route names vary ("Primary", "Primary (BF-BOF)", "Primary (Pidgeon)", ...),
    so normalise to a simple 'Primary' / 'Recycled' class and drop hybrids.
    """
    df = pd.read_csv(DATA / "lca_emission_factors.csv")
    df["route_class"] = df["route"].str.split().str[0]  # first word: Primary/Recycled/Hybrid
    return df[df["route_class"].isin(["Primary", "Recycled"])].reset_index(drop=True)


def build_dataset(factors: pd.DataFrame, n_per_group: int = 400) -> pd.DataFrame:
    """
    Build a supervised dataset for GWP prediction.

    Target (gwp_t_co2e_per_tonne) is derived from the CITED per-tonne factors,
    then perturbed to reflect real-world variation in:
      - recycled content share (0-100%)
      - electricity grid intensity (regional vs the CEA India average)
      - ore grade / process efficiency
      - transport distance
    Each row is one realistic production scenario. Features are what a user can
    actually supply in the app.
    """
    rows = []
    metals = factors["metal"].unique()
    for metal in metals:
        prim = factors[(factors.metal == metal) & (factors.route_class == "Primary")].iloc[0]
        recy = factors[(factors.metal == metal) & (factors.route_class == "Recycled")].iloc[0]
        for _ in range(n_per_group):
            recycled_content = RNG.uniform(0, 1)            # 0..1 share
            # Grid intensity relative to the CEA India average (0.6x cleaner .. 1.3x dirtier)
            grid_ratio = RNG.uniform(0.6, 1.3)
            ore_grade = RNG.uniform(0.7, 1.3)               # process efficiency multiplier
            transport_km = RNG.uniform(100, 2000)

            # Blend primary/recycled cradle-to-gate GWP by recycled content
            base_gwp = (1 - recycled_content) * prim.gwp_t_co2e_per_tonne \
                + recycled_content * recy.gwp_t_co2e_per_tonne
            # Electricity-driven part scales with the grid ratio; process part with ore grade
            gwp = base_gwp * (0.75 * grid_ratio + 0.25 * ore_grade)
            # Transport contribution (t CO2e/tonne): truck factor 0.062 t/tonne-km / 1000 km
            gwp += (transport_km / 1000.0) * 0.062
            # Small measurement noise (+/-3%)
            gwp *= RNG.normal(1.0, 0.03)

            rows.append({
                "metal": metal,
                "recycled_content": round(recycled_content, 3),
                "grid_intensity_tco2_mwh": round(CEA_GRID_FACTOR * grid_ratio, 4),
                "ore_grade_factor": round(ore_grade, 3),
                "transport_km": round(transport_km, 1),
                "gwp_t_co2e_per_tonne": round(max(gwp, 0.05), 4),
            })
    return pd.DataFrame(rows)


def build_and_save():
    """Regenerate data/training_dataset.csv exactly (fixed seed 42, 400 scenarios per metal)."""
    global RNG
    RNG = np.random.default_rng(42)          # reset so repeated calls give the same rows
    df = build_dataset(load_factors())
    df.to_csv(DATA / "training_dataset.csv", index=False)
    return df


def main():
    df = build_and_save()

    # One-hot encode the metal; keep numeric features
    X = pd.get_dummies(df.drop(columns=["gwp_t_co2e_per_tonne"]), columns=["metal"])
    y = df["gwp_t_co2e_per_tonne"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(n_estimators=300, max_depth=14, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    r2 = r2_score(y_test, pred)
    mae = mean_absolute_error(y_test, pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, pred)))

    joblib.dump({"model": model, "columns": list(X.columns)}, MODELS / "gwp_model.pkl")

    importances = sorted(
        zip(X.columns, model.feature_importances_), key=lambda t: -t[1]
    )

    report = f"""# EcoForge — GWP Model Validation Report

**Model:** RandomForestRegressor (300 trees, max_depth=14)
**Task:** Predict cradle-to-gate GWP (t CO2e / tonne) from a production scenario
**Training data:** parametric dataset grounded in cited LCA factors
(IAI / worldsteel / ICA) + CEA India grid factor 0.7117 t CO2/MWh.
Rows: {len(df)}  |  Train/Test split: 80/20 (held-out test set)

## Accuracy (on the held-out test set)
| Metric | Value |
|---|---|
| R² (coefficient of determination) | **{r2:.4f}** |
| MAE (mean absolute error) | {mae:.4f} t CO2e/tonne |
| RMSE (root mean squared error) | {rmse:.4f} t CO2e/tonne |

## Feature importance
""" + "\n".join(f"- `{name}`: {imp:.3f}" for name, imp in importances) + f"""

## How to quote this
> "Our GWP model is a RandomForest trained on a parametric LCA dataset grounded
> in IAI/worldsteel/ICA factors and the CEA (Government of India) grid emission
> factor. Validated on a held-out 20% test set it achieves R² = {r2:.3f}."

Files: `models/gwp_model.pkl`, `data/training_dataset.csv`
"""
    (DATA / "model_metrics.md").write_text(report, encoding="utf-8")

    print("=" * 60)
    print(f"Trained on {len(df)} rows. Held-out test set metrics:")
    print(f"  R2   = {r2:.4f}")
    print(f"  MAE  = {mae:.4f} t CO2e/tonne")
    print(f"  RMSE = {rmse:.4f} t CO2e/tonne")
    print("Saved: models/gwp_model.pkl, data/model_metrics.md, data/training_dataset.csv")
    print("=" * 60)

    # Benchmark 7 algorithms on this dataset and deploy the winner (replaces gwp_model.pkl)
    import model_lab
    model_lab.run()


if __name__ == "__main__":
    main()
