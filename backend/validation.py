# [23] VALIDATION - compares EcoForge's results with REAL published figures (Tata Steel, Vedanta, Hindalco,
#      Ministry of Steel, International Aluminium Institute) to show how close the tool is to reality.
"""
EcoForge - validation against published data

Each benchmark in data/validation_benchmarks.csv is a CO2 intensity (t CO2e per tonne of metal)
published by a company, the Government of India or an industry body, with its source and link.

EcoForge is run with its DEFAULT India inputs - nothing is tuned to fit:
    primary route (0% scrap), CEA grid factor 0.7117 t CO2/MWh, ore/process factor 1.0,
    200 km of truck transport.
Two EcoForge methods are checked:
    LCA engine : cited cradle-to-gate factor + transport (same as the Calculator)
    ML model   : the deployed model from the Model Lab benchmark (/api/predict-gwp)

A "what if" row then shows how much one documented Indian condition (coal-heavy captive power)
explains the largest gap. It is shown separately and is NOT used in the error summary.
"""

from pathlib import Path

import pandas as pd

from ml_predictor import predict_gwp

DATA = Path(__file__).parent / "data"
DEFAULTS = {"recycled_content": 0.0, "grid_intensity_tco2_mwh": 0.7117, "ore_grade_factor": 1.0, "transport_km": 200.0}
TRUCK_KG_PER_TKM = 0.062


def lca_engine(metal, km=DEFAULTS["transport_km"]):
    f = pd.read_csv(DATA / "lca_emission_factors.csv")
    primary = f[(f.metal == metal) & f.route.str.startswith("Primary")].iloc[0].gwp_t_co2e_per_tonne
    return float(primary) + km * TRUCK_KG_PER_TKM / 1000


def ml_model(metal, **over):
    r = predict_gwp({"metal": metal, **DEFAULTS, **over})
    return r["predicted_gwp_t_co2e_per_tonne"], r.get("range_95"), r.get("model")


def run():
    bench = pd.read_csv(DATA / "validation_benchmarks.csv")
    rows, model_name = [], None
    for b in bench.to_dict(orient="records"):
        lca = lca_engine(b["metal"])
        ml, rng, model_name = ml_model(b["metal"])
        pub = b["published_t_co2_per_t"]
        rows.append({**b, "ecoforge_lca": round(lca, 3), "ecoforge_ml": round(ml, 3), "ml_range_95": rng,
                     "error_lca_pct": round((lca - pub) / pub * 100, 1), "error_ml_pct": round((ml - pub) / pub * 100, 1)})

    def summary(k):
        errs = [abs(r[k]) for r in rows]
        return {"mean_abs_error_pct": round(sum(errs) / len(errs), 1),
                "within_10pct": sum(e <= 10 for e in errs), "count": len(errs)}

    # what-if: Indian smelters mostly run on captive coal power, which is dirtier than the grid average.
    # 0.925 t CO2/MWh is the top of the model's training range (1.3 x the CEA grid average).
    hind = next(r for r in rows if r["benchmark"].startswith("Hindalco"))
    coal, _, _ = ml_model("Aluminium", grid_intensity_tco2_mwh=0.925)
    what_if = {"benchmark": hind["benchmark"], "published": hind["published_t_co2_per_t"],
               "input_changed": "Power emission factor 0.7117 -> 0.925 t CO2/MWh (coal-heavy captive power)",
               "ecoforge_ml": round(coal, 3),
               "error_pct": round((coal - hind["published_t_co2_per_t"]) / hind["published_t_co2_per_t"] * 100, 1)}

    return {"success": True, "inputs": DEFAULTS, "model": model_name, "rows": rows,
            "summary": {"lca": summary("error_lca_pct"), "ml": summary("error_ml_pct")}, "what_if": what_if,
            "scope": ("Preliminary aggregate benchmark comparison: six published company, national and industry averages "
                      "for steel and aluminium only. It does not establish accuracy for individual plants, for copper or "
                      "magnesium, or for other operating conditions."),
            "notes": [
                "EcoForge uses global cited factors with India's grid; nothing was tuned to match these numbers.",
                "Indian steel is higher than EcoForge mainly because of coal-based DRI, less pellet/sinter use and less scrap (Ministry of Steel).",
                "Hindalco is higher because its smelters run on captive coal power; Vedanta is lower thanks to 1.57 billion units of renewable power.",
                "Company figures differ in scope (plant boundary, slag credit, power source, reporting period); each row lists its boundary and how EcoForge's default scenario differs.",
                "The IAI global figure comes from the same publisher as EcoForge's aluminium factor, so it is not a fully independent check.",
                "EcoForge's validation run uses 200 km of truck transport (16.11 t for aluminium); the Calculator default uses 500 + 300 + 200 km over three legs (16.15 t).",
            ]}


if __name__ == "__main__":
    import json
    print(json.dumps(run(), indent=1, default=str))
