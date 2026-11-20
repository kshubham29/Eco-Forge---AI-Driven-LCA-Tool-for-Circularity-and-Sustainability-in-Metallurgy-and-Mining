# [18] AI GAP-FILLER - when a user does not know some process data (energy, electricity, water, CO2...),
#      ML models estimate the missing values from the ones they do know, with a 95% range.
"""
EcoForge - AI estimation of missing LCA parameters

Real plant data is often incomplete. For every missing value, a Random Forest is trained to
predict that column from exactly the columns the user DID enter (plus the metal). This
"pattern-aware" approach never feeds one guess into another, so it stays accurate even when
most fields are blank. Models are cached per pattern, so repeat requests are instant.

The 95% range of each estimate comes from the forest's out-of-bag errors for that metal
(errors on rows the trees did not see during training).

Columns (per tonne of metal):
    recycled_content (0-1), ore_grade_factor, grid_intensity_tco2_mwh, transport_km,
    energy_gj, electricity_mwh, water_m3, gwp_t_co2e

Run:  venv\\Scripts\\python.exe gap_filler.py      (builds the dataset and prints the test accuracy)
Output: data/process_dataset.csv, models/gap_filler_metrics.json
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

BASE = Path(__file__).parent
DATA = BASE / "data"
DATASET = DATA / "process_dataset.csv"
METRICS = BASE / "models" / "gap_filler_metrics.json"
CEA_GRID = 0.7117
METALS = ["Aluminium", "Copper", "Magnesium", "Steel"]
COLS = ["recycled_content", "ore_grade_factor", "grid_intensity_tco2_mwh", "transport_km",
        "energy_gj", "electricity_mwh", "water_m3", "gwp_t_co2e"]
# transport distance does not depend on the other values, so it is never "estimated" - a default is used
ESTIMABLE = [c for c in COLS if c != "transport_km"]
OUTPUTS = ["energy_gj", "electricity_mwh", "water_m3", "gwp_t_co2e"]
DEFAULT_KM = 500.0
UNITS = {"recycled_content": "share 0-1", "ore_grade_factor": "x (1 = typical)", "grid_intensity_tco2_mwh": "t CO2/MWh",
         "transport_km": "km", "energy_gj": "GJ/t", "electricity_mwh": "MWh/t", "water_m3": "m3/t", "gwp_t_co2e": "t CO2e/t"}

# electricity per tonne, primary / recycled (indicative typical values: IAI, worldsteel, ICA, literature)
ELECTRICITY = {"Aluminium": (15.0, 0.7), "Copper": (3.5, 0.9), "Magnesium": (7.0, 0.5), "Steel": (0.6, 0.65)}


def build_dataset(n_per_metal=500, seed=7):
    rng = np.random.default_rng(seed)
    f = pd.read_csv(DATA / "lca_emission_factors.csv")
    f["cls"] = f["route"].str.split().str[0]
    rows = []
    for m in METALS:
        p = f[(f.metal == m) & (f.cls == "Primary")].iloc[0]
        r_ = f[(f.metal == m) & (f.cls == "Recycled")].iloc[0]
        for _ in range(n_per_metal):
            r = rng.uniform(0, 1)
            ore = rng.uniform(0.7, 1.3)
            grid_ratio = rng.uniform(0.6, 1.3)
            km = rng.uniform(100, 2000)
            mix = lambda a, b: (1 - r) * a + r * b  # noqa: E731
            energy = mix(p.energy_GJ_per_tonne, r_.energy_GJ_per_tonne) * (0.8 + 0.2 * ore) * rng.normal(1, 0.03)
            elec = mix(*ELECTRICITY[m]) * (0.9 + 0.1 * ore) * rng.normal(1, 0.03)
            water = mix(p.water_m3_per_tonne, r_.water_m3_per_tonne) * (0.7 + 0.3 * ore) * rng.normal(1, 0.05)
            # same GWP relation as the main training data (train_real_model.py)
            gwp = mix(p.gwp_t_co2e_per_tonne, r_.gwp_t_co2e_per_tonne) * (0.75 * grid_ratio + 0.25 * ore) \
                + km / 1000 * 0.062
            gwp *= rng.normal(1, 0.03)
            rows.append({"metal": m, "recycled_content": r, "ore_grade_factor": ore,
                         "grid_intensity_tco2_mwh": CEA_GRID * grid_ratio, "transport_km": km,
                         "energy_gj": energy, "electricity_mwh": elec, "water_m3": water, "gwp_t_co2e": max(gwp, 0.05)})
    return pd.DataFrame(rows).round(4)


def encode(df):
    X = df[COLS].copy()
    for m in METALS:
        X[f"metal_{m}"] = (df["metal"] == m).astype(float)
    return X


def fit_pattern(df, known, target, n_estimators=150):
    """Random Forest predicting `target` from the metal + the `known` columns, with per-metal OOB error spread."""
    feats = [f"metal_{m}" for m in METALS] + sorted(known)
    X, y = encode(df)[feats], df[target].values
    rf = RandomForestRegressor(n_estimators=n_estimators, min_samples_leaf=2, oob_score=True,
                               random_state=42, n_jobs=-1).fit(X, y)
    rf.set_params(n_jobs=1)   # predictions are small; one thread avoids per-call start-up cost
    err = rf.oob_prediction_ - y
    rel = target != "recycled_content"           # 0-1 share: absolute error; everything else: relative
    e = err / np.maximum(np.abs(y), 1e-6) if rel else err
    metal = df["metal"].values
    return {"model": rf, "features": feats, "relative": rel,
            # out-of-bag R2: how much of this column the known inputs can actually explain
            "oob_r2": float(rf.oob_score_),
            "spread": {m: float(np.std(e[metal == m])) for m in METALS},
            "mape": {m: float(np.mean(np.abs(err[metal == m] / np.maximum(np.abs(y[metal == m]), 1e-6))) * 100) for m in METALS},
            "mae": {m: float(np.mean(np.abs(err[metal == m]))) for m in METALS}}


def _score(true, est):
    err = est - true
    return {"mape": float(np.mean(np.abs(err) / np.maximum(np.abs(true), 1e-6)) * 100),
            "r2": float(1 - np.sum(err ** 2) / np.sum((true - true.mean()) ** 2)),
            "within_10pct": float(np.mean(np.abs(err) / np.maximum(np.abs(true), 1e-6) <= 0.10) * 100)}


# Missing-input patterns tested (what the user KNOWS; everything else is estimated). Transport is always known
# (a default is used when blank). Ordered from most to least information.
PATTERNS = [
    ("All drivers known (scrap %, ore, grid)", ["recycled_content", "ore_grade_factor", "grid_intensity_tco2_mwh", "transport_km"]),
    ("Scrap % and grid known", ["recycled_content", "grid_intensity_tco2_mwh", "transport_km"]),
    ("Energy, electricity and water known", ["energy_gj", "electricity_mwh", "water_m3", "transport_km"]),
    ("Only energy known", ["energy_gj", "transport_km"]),
    ("Only scrap % known", ["recycled_content", "transport_km"]),
]


def _score_with_coverage(m, test_df, target):
    true = test_df[target].values
    est = m["model"].predict(encode(test_df)[m["features"]])
    s = _score(true, est)
    # does the shown 95% range (1.96 x OOB spread for that metal) contain the true value?
    spread = np.array([m["spread"][mt] for mt in test_df["metal"].values])
    half = 1.96 * spread * (np.abs(est) if m["relative"] else 1)
    s["range_coverage_pct"] = float(np.mean(np.abs(true - est) <= half) * 100)
    return s


def evaluate(train_df, test_df):
    """Tests on held-out rows the models never saw (all rows are GENERATED scenarios)."""
    out = {"hide_one": {}, "only_recycled_known": {}, "patterns": []}
    # 1) one value missing, everything else known
    for c in ESTIMABLE:
        m = fit_pattern(train_df, [k for k in COLS if k != c], c, 80)
        out["hide_one"][c] = _score_with_coverage(m, test_df, c)
    # 2) only the metal, recycled content and transport are known (kept for the app's existing view)
    for c in OUTPUTS:
        m = fit_pattern(train_df, ["recycled_content", "transport_km"], c, 80)
        out["only_recycled_known"][c] = _score_with_coverage(m, test_df, c)
    # 3) a range of realistic missing-input patterns
    for label, known in PATTERNS:
        targets = {}
        for c in ESTIMABLE:
            if c in known:
                continue
            m = fit_pattern(train_df, known, c, 80)
            targets[c] = _score_with_coverage(m, test_df, c)
        out["patterns"].append({"pattern": label, "known": known, "targets": targets})
    return out


def train():
    df = build_dataset()
    df.to_csv(DATASET, index=False)
    tr, te = train_test_split(df, test_size=0.2, random_state=42, stratify=df["metal"])
    res = evaluate(tr, te)
    for test in ("hide_one", "only_recycled_known"):
        print(f"\n{test}:")
        for c, v in res[test].items():
            print(f"  {c:25s} R2 {v['r2']:.3f}  MAPE {v['mape']:5.1f}%  within 10%: {v['within_10pct']:.0f}%  range covers {v['range_coverage_pct']:.0f}%")
    for p in res["patterns"]:
        print(f"\n{p['pattern']}:")
        for c, v in p["targets"].items():
            print(f"  {c:25s} R2 {v['r2']:.3f}  MAPE {v['mape']:5.1f}%  range covers {v['range_coverage_pct']:.0f}%")
    METRICS.parent.mkdir(exist_ok=True)
    METRICS.write_text(json.dumps({
        "rows": len(df), "train_rows": len(tr), "test_rows": len(te), "generated": True,
        "generator": "build_dataset(n_per_metal=500, seed=7)",
        "protocol": "Generated data (2,000 scenarios). 80/20 split stratified by metal (random_state=42); "
                    "Random Forests fitted on the training rows only; scores on the 400 held-out rows.",
        **res}, indent=1), encoding="utf-8")
    print(f"\nSaved {DATASET.name} and {METRICS.name}")


_DF, _CACHE = None, {}


def _dataset():
    global _DF
    if _DF is None:
        if not DATASET.exists():
            train()
        _DF = pd.read_csv(DATASET)
    return _DF


def _model(known, c):
    key = (tuple(known), c)
    if key not in _CACHE:
        _CACHE[key] = fit_pattern(_dataset(), known, c)
    return _CACHE[key]


def _prepare(data):
    """Check one request and work out which columns are known. Returns (prep, None) or (None, error)."""
    metal = data.get("metal")
    if metal not in METALS:
        return None, f"AI estimation is available for {', '.join(METALS)} only."
    given = data.get("values") or {}
    row = {c: (float(given[c]) if given.get(c) not in (None, "") else None) for c in COLS}
    km_default = row["transport_km"] is None
    if km_default:
        row["transport_km"] = DEFAULT_KM
    known = sorted(c for c in COLS if row[c] is not None)
    if not [c for c in known if c in ESTIMABLE]:
        return None, "Enter at least one process value so the AI has something to work from."
    return {"metal": metal, "row": row, "known": known, "km_default": km_default}, None


def _features(p, feats):
    x = {**{c: p["row"][c] for c in p["known"]}, **{f"metal_{m}": float(m == p["metal"]) for m in METALS}}
    return [x[f] for f in feats]


def _assemble(p, preds):
    """preds = {column: estimate}. Builds the same answer for single and batch requests."""
    df, metal, row = _dataset(), p["metal"], p["row"]
    out, warnings = {}, []
    for c in COLS:
        if row[c] is not None:
            out[c] = {"value": row[c], "estimated": False, "default": c == "transport_km" and p["km_default"], "unit": UNITS[c]}
            lo, hi = df[c].min(), df[c].max()
            if not (c == "transport_km" and p["km_default"]) and not lo - 0.1 * (hi - lo) <= row[c] <= hi + 0.1 * (hi - lo):
                warnings.append(f"{c} = {row[c]:g} is outside the range the AI was trained on ({lo:.3g}-{hi:.3g}).")
            continue
        m, v = _model(p["known"], c), float(preds[c])
        s = 1.96 * m["spread"][metal] * (abs(v) if m["relative"] else 1)
        lo, hi = max(v - s, 0.0), v + s
        if c == "recycled_content":
            v, hi = min(max(v, 0.0), 1.0), min(hi, 1.0)
        low = m["oob_r2"] < 0.5
        out[c] = {"value": round(v, 4), "estimated": True, "range": [round(lo, 4), round(hi, 4)],
                  "typical_error_pct": round(m["mape"][metal], 1), "typical_error_abs": round(m["mae"][metal], 4),
                  "explained_r2": round(m["oob_r2"], 3), "low_reliability": low, "unit": UNITS[c]}
        if low:
            warnings.append(f"{c} cannot be estimated reliably from the values entered (explains {max(m['oob_r2'], 0) * 100:.0f}% "
                            f"of its variation); the estimate is close to a typical value. Enter it if you know it.")
    return {"success": True, "metal": metal, "values": out, "warnings": warnings,
            "n_estimated": sum(v["estimated"] for v in out.values()),
            "method": "Random Forest per missing value, trained on 2,000 GENERATED process scenarios using only the values you entered",
            "range_note": "Approximate 95% range from out-of-bag errors on generated data; not verified on real plants."}


def estimate_missing(data):
    """data = {"metal": "Steel", "values": {col: number or None}} -> every column filled, estimates marked."""
    p, err = _prepare(data)
    if err:
        return {"success": False, "error": err}
    preds = {}
    for c in COLS:
        if p["row"][c] is None:
            m = _model(p["known"], c)
            preds[c] = m["model"].predict(pd.DataFrame([_features(p, m["features"])], columns=m["features"]))[0]
    return _assemble(p, preds)


def estimate_missing_batch(rows):
    """Many plants at once. Rows that share the same set of known columns are grouped, so each missing
    column is predicted for the whole group in ONE model call instead of one call per row."""
    results, preps, groups = [None] * len(rows), {}, {}
    for i, data in enumerate(rows):
        p, err = _prepare(data)
        if err:
            results[i] = {"success": False, "error": err}
            continue
        preps[i] = p
        groups.setdefault(tuple(p["known"]), []).append(i)
    for known, idx in groups.items():
        preds = {i: {} for i in idx}
        for c in COLS:
            if c in known:
                continue
            m = _model(list(known), c)
            X = pd.DataFrame([_features(preps[i], m["features"]) for i in idx], columns=m["features"])
            for i, v in zip(idx, m["model"].predict(X)):
                preds[i][c] = v
        for i in idx:
            results[i] = _assemble(preps[i], preds[i])
    return results


if __name__ == "__main__":
    train()
