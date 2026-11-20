# [3] ML PREDICTOR - live CO2 prediction with the deployed model (models/gwp_model.pkl), used by /api/predict-gwp.
#     The model is chosen and saved by model_lab.py (7-algorithm benchmark, cross-validation on training rows).

# =============================================================================
# GWP (Global Warming Potential) prediction — REAL trained ML model
# Loads models/gwp_model.pkl (the model that won the Model Lab benchmark, see
# model_lab.py) and predicts cradle-to-gate CO2 per tonne from a production scenario.
# =============================================================================
_GWP_BUNDLE = None


def _load_gwp_model(reload=False):
    """Lazy-load the trained GWP model bundle once (reload=True after retraining)."""
    global _GWP_BUNDLE
    if _GWP_BUNDLE is None or reload:
        import joblib
        from pathlib import Path
        model_path = Path(__file__).parent / "models" / "gwp_model.pkl"
        _GWP_BUNDLE = joblib.load(model_path)
        print(f"GWP model loaded from {model_path}")
    return _GWP_BUNDLE


def predict_gwp(data):
    """Predict GWP (t CO2e/tonne) with the deployed model, plus a 95% range."""
    try:
        import pandas as pd

        bundle = _load_gwp_model()
        model = bundle["model"]
        columns = bundle["columns"]

        metal = data.get("metal", "Aluminium")
        recycled_content = float(data.get("recycled_content", 0))       # 0..1
        grid = float(data.get("grid_intensity_tco2_mwh", 0.7117))       # CEA default
        ore_grade = float(data.get("ore_grade_factor", 1.0))
        transport_km = float(data.get("transport_km", 500))

        # Build the feature row in the exact column order the model was trained on
        row = {c: 0 for c in columns}
        if "recycled_content" in row:
            row["recycled_content"] = recycled_content
        if "grid_intensity_tco2_mwh" in row:
            row["grid_intensity_tco2_mwh"] = grid
        if "ore_grade_factor" in row:
            row["ore_grade_factor"] = ore_grade
        if "transport_km" in row:
            row["transport_km"] = transport_km
        metal_col = f"metal_{metal}"
        if metal_col in row:
            row[metal_col] = 1

        X = pd.DataFrame([[row[c] for c in columns]], columns=columns)
        prediction = max(float(model.predict(X)[0]), 0.0)

        # 95% range = prediction +/- 1.96 x the model's test-error spread for this metal
        spread = 1.96 * bundle.get("residual_std_by_metal", {}).get(metal, 0.0)
        warnings = []
        if metal_col not in row:
            warnings.append(f"{metal} is not in the training data; prediction is not reliable.")
        values = {"recycled_content": recycled_content, "grid_intensity_tco2_mwh": grid,
                  "ore_grade_factor": ore_grade, "transport_km": transport_km}
        for name, (lo, hi) in bundle.get("feature_ranges", {}).items():
            if not lo <= values[name] <= hi:
                label = {"recycled_content": "Recycled content", "grid_intensity_tco2_mwh": "Grid factor",
                         "ore_grade_factor": "Ore factor", "transport_km": "Total transport (km)"}.get(name, name)
                warnings.append(f"{label} {values[name]:,.4g} is outside what the model was trained on "
                                f"({lo:,.4g} to {hi:,.4g}), so trust the calculator value here.")

        name = bundle.get("name", "Random Forest")
        r2 = bundle.get("metrics", {}).get("cv_r2_mean")
        cov = bundle.get("interval", {}).get("coverage_test_pct")
        return {
            "success": True,
            "predicted_gwp_t_co2e_per_tonne": round(prediction, 3),
            "range_95": [round(max(prediction - spread, 0.0), 3), round(prediction + spread, 3)],
            "range_note": ("Approximate 95% range (±1.96 × out-of-fold error spread for this metal)"
                           + (f"; covered {cov}% of held-out generated test cases" if cov else "")
                           + ". Not verified on real plant data."),
            "warnings": warnings,
            "model": f"{name} (CV R² = {r2:.3f} on generated data)" if r2 else name,
            "model_version": bundle.get("model_version"),
            "input_features": {
                "metal": metal,
                "recycled_content": recycled_content,
                "grid_intensity_tco2_mwh": grid,
                "ore_grade_factor": ore_grade,
                "transport_km": transport_km,
            },
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"GWP prediction error: {str(e)}",
            "predicted_gwp_t_co2e_per_tonne": None,
        }
