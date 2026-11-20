# [36] REPRODUCE ALL RESULTS - regenerates every dataset and model from fixed seeds, re-runs every evaluation,
#      measures speed, and writes data/EVALUATION_RESULTS.md (the numbers quoted in the report and slides).
"""
Run from the backend folder:
    venv\\Scripts\\python reproduce_results.py

Steps (all data is GENERATED from cited factors and literature rules; nothing here is measured plant data):
    1. CO2 dataset      train_real_model.build_and_save()      1,600 rows, numpy seed 42
    2. CO2 models       model_lab.run()                        7 models, selection by 5-fold CV on training rows
    3. Gap-filler       gap_filler.train()                     2,000 rows, seed 7, several missing-input patterns
    4. Pre-check        circularity_precheck.train()           8,000 cases, seed 11, selection by CV log loss
    5. Benchmarks       validation.run()                       6 published steel/aluminium averages
    6. Speed            timings of the live functions (new vs cached gap-filling patterns, batch grouping)
"""
import hashlib
import json
import platform
import statistics
import time
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).parent
OUT = BASE / "data" / "EVALUATION_RESULTS.md"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:12]


def timed(fn, n):
    ts = []
    for _ in range(n):
        t = time.perf_counter(); fn(); ts.append((time.perf_counter() - t) * 1000)
    return round(statistics.median(ts), 2), round(max(ts), 2)


def performance():
    import gap_filler
    import ml_predictor
    from circularity_precheck import precheck

    ml_predictor._load_gwp_model(reload=True)
    gwp_med, gwp_max = timed(lambda: ml_predictor.predict_gwp({"metal": "Steel", "recycled_content": 0.3}), 200)
    pre_med, pre_max = timed(lambda: precheck({"metal": "Aluminium"}), 20)

    gap_filler._CACHE.clear()
    body = {"metal": "Copper", "values": {"recycled_content": 0.3, "water_m3": 50}}
    t = time.perf_counter(); gap_filler.estimate_missing(body); new_ms = (time.perf_counter() - t) * 1000
    cached_med, _ = timed(lambda: gap_filler.estimate_missing(body), 50)

    # batch of 100 rows: one shared pattern vs 5 different patterns (each new pattern trains its models once)
    gap_filler._CACHE.clear()
    same = [{"metal": "Steel", "values": {"recycled_content": i / 100}} for i in range(100)]
    t = time.perf_counter(); gap_filler.estimate_missing_batch(same); same_ms = (time.perf_counter() - t) * 1000
    gap_filler._CACHE.clear()
    keys = [{"recycled_content": 0.2}, {"energy_gj": 20}, {"recycled_content": 0.2, "energy_gj": 20},
            {"water_m3": 15}, {"electricity_mwh": 0.6}]
    mixed = [{"metal": "Steel", "values": keys[i % 5]} for i in range(100)]
    t = time.perf_counter(); gap_filler.estimate_missing_batch(mixed); mixed_ms = (time.perf_counter() - t) * 1000
    t = time.perf_counter(); gap_filler.estimate_missing_batch(mixed); mixed_cached_ms = (time.perf_counter() - t) * 1000
    return {
        "predict_gwp_ms": {"median": gwp_med, "max": gwp_max, "calls": 200},
        "precheck_with_fix_plan_ms": {"median": pre_med, "max": pre_max, "calls": 20},
        "gap_fill_new_pattern_ms": round(new_ms, 1),
        "gap_fill_cached_pattern_ms": cached_med,
        "batch_100_rows_one_pattern_ms": round(same_ms, 1),
        "batch_100_rows_five_patterns_ms": round(mixed_ms, 1),
        "batch_100_rows_five_patterns_cached_ms": round(mixed_cached_ms, 1),
        "note": "Single laptop, in-process calls (no network). The first request for a new combination of known "
                "fields trains small Random Forests (about 1-2 s); repeats reuse them. Batch rows with the same known fields "
                "are grouped and predicted together.",
    }


def main():
    import train_real_model
    import model_lab
    import gap_filler
    import circularity_precheck
    import validation

    started = datetime.now().isoformat(timespec="seconds")
    train_real_model.build_and_save()
    lab = model_lab.run()
    gap_filler.train()
    gap = json.loads((BASE / "models" / "gap_filler_metrics.json").read_text(encoding="utf-8"))
    pre = circularity_precheck.train()
    val = validation.run()
    (BASE / "models" / "validation_results.json").write_text(json.dumps(val, indent=1, default=str), encoding="utf-8")
    perf = performance()

    import numpy, pandas, sklearn, xgboost, fastapi, pydantic
    env = {"python": platform.python_version(), "numpy": numpy.__version__, "pandas": pandas.__version__,
           "scikit-learn": sklearn.__version__, "xgboost": xgboost.__version__, "fastapi": fastapi.__version__,
           "pydantic": pydantic.VERSION, "os": platform.platform()}
    files = {p: sha(BASE / p) for p in ["data/training_dataset.csv", "data/process_dataset.csv", "data/precheck_dataset.csv",
                                         "data/lca_emission_factors.csv", "data/validation_benchmarks.csv",
                                         "models/gwp_model.pkl", "models/precheck.pkl"]}

    win = lab["benchmark"][0]
    b = {x["name"]: x for x in lab["baselines"]}
    eq = next(v for k, v in b.items() if k.startswith("Generating"))
    calc = next(v for k, v in b.items() if k.startswith("Plain"))
    pc = {c["class"]: c for c in pre["per_class"]}
    pattern_rows = "\n".join(
        f"| {p['pattern']} | {t} | {v['r2']:.3f} | {v['mape']:.1f}% | {v['range_coverage_pct']:.0f}% |"
        for p in gap["patterns"] for t, v in p["targets"].items())
    val_rows = "\n".join(
        f"| {r['benchmark']} | {r['period']} | {r['published_t_co2_per_t']:.2f} | {r['ecoforge_lca']:.2f} ({r['error_lca_pct']:+.1f}%) "
        f"| {r['ecoforge_ml']:.2f} ({r['error_ml_pct']:+.1f}%) | {r['emissions_boundary']} |" for r in val["rows"])

    md = f"""# EcoForge - evaluation results (reproducible)

Generated {started} by `backend/reproduce_results.py`. Re-run that script to regenerate every number below.
**All training and test data are generated scenarios** built from cited factors and literature rules, not measured plant data.

## 1. CO2 prediction (1,600 generated scenarios, seed 42)

{lab['protocol']}

| Item | Value |
|---|---|
| Selected model | {win['model']} (model version `{lab['model_version']}`) |
| 5-fold CV R² on the 1,280 training rows | {win['cv_r2_mean']:.4f} ± {win['cv_r2_std']:.4f} |
| Held-out test (320 rows): R² / MAE / RMSE / MAPE | {win['r2']:.4f} / {win['mae']:.3f} / {win['rmse']:.3f} t CO2e/t / {win['mape']:.2f}% |
| Baseline: generating equation, no noise | R² {eq['r2']:.4f}, RMSE {eq['rmse']:.3f}, MAPE {eq['mape']:.2f}% |
| Baseline: plain calculator (grid and ore ignored) | R² {calc['r2']:.4f}, RMSE {calc['rmse']:.3f}, MAPE {calc['mape']:.2f}% |
| RMSE between {win['model']} and the generating equation | {lab['ml_vs_equation_rmse']} t CO2e/t |
| Approximate 95% interval coverage (held-out) | {lab['interval_coverage']['overall_pct']}% ({lab['interval_coverage']['per_metal_pct']}) |
| Test rows within ±10% | {lab['analysis']['within_10pct']}% |

Wording to use: "R² = {win['r2']:.3f} on generated test scenarios", never "99.7% accuracy".
The model approximates a known equation; its contribution is a fitted, retrainable model with an error estimate.

## 2. Circularity pre-check (8,000 generated cases, seed 11)

{pre['protocol']}

| Item | Value |
|---|---|
| Selected classifier | {pre['best_model']} |
| Accuracy (held-out 1,600) | {pre['final']['accuracy'] * 100:.1f}% |
| Always predict "lost" | {pre['baselines']['majority_accuracy'] * 100:.2f}% |
| Generating rule's most-likely class (reference) | {pre['baselines']['reference_rule_accuracy'] * 100:.2f}% |
| Macro F1 | {pre['final']['macro_f1']:.3f} |
| Log loss: model / class prior / generating rule | {pre['final']['log_loss']:.4f} / {pre['baselines']['prior_log_loss']:.4f} / {pre['baselines']['reference_rule_log_loss']:.4f} |
| Closed loop: precision / recall | {pc['closed_loop']['precision'] * 100:.1f}% / {pc['closed_loop']['recall'] * 100:.1f}% |
| Downcycled: precision / recall | {pc['downcycled']['precision'] * 100:.1f}% / {pc['downcycled']['recall'] * 100:.1f}% |
| Lost: precision / recall | {pc['lost']['precision'] * 100:.1f}% / {pc['lost']['recall'] * 100:.1f}% |
| Confusion matrix (rows = actual closed/down/lost) | {pre['confusion_matrix']} |

The comparison of predicted probabilities with the generating rule's probabilities is possible only because the data is simulated;
it says nothing about real recycler outcomes.

## 3. AI gap-filling (2,000 generated scenarios, seed 7) - held-out 400 rows

| Known inputs | Estimated column | R² | MAPE | Range covers |
|---|---|---|---|---|
{pattern_rows}

R² near or below 0 means the column cannot be estimated from those inputs; the app flags such estimates as low reliability.

## 4. Preliminary aggregate benchmark comparison (steel and aluminium only)

{val['scope']}
EcoForge inputs: {val['inputs']}.

| Benchmark | Period | Published | EcoForge LCA | EcoForge ML | Published boundary |
|---|---|---|---|---|---|
{val_rows}

Mean absolute gap: ML {val['summary']['ml']['mean_abs_error_pct']}% ({val['summary']['ml']['within_10pct']} of 6 within 10%), LCA engine {val['summary']['lca']['mean_abs_error_pct']}%.
What-if (not in the mean): {val['what_if']['input_changed']} gives {val['what_if']['ecoforge_ml']} t vs {val['what_if']['published']} ({val['what_if']['error_pct']:+.1f}%).

## 5. Speed (this machine)

```
{json.dumps(perf, indent=1)}
```

## 6. Environment and file fingerprints

```
{json.dumps(env, indent=1)}
{json.dumps(files, indent=1)}
```
"""
    OUT.write_text(md, encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
