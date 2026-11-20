# EcoForge - evaluation results (reproducible)

Generated 2026-11-11T23:55:41 by `backend/reproduce_results.py`. Re-run that script to regenerate every number below.
**All training and test data are generated scenarios** built from cited factors and literature rules, not measured plant data.

## 1. CO2 prediction (1,600 generated scenarios, seed 42)

Generated data (1,600 scenarios). 80/20 split (random_state=42); model selection by 5-fold CV on the 1,280 training rows only; scaling inside each fold; winner evaluated once on the 320 held-out rows.

| Item | Value |
|---|---|
| Selected model | SVR (model version `gwp-svr-20002a763bb1`) |
| 5-fold CV R² on the 1,280 training rows | 0.9970 ± 0.0003 |
| Held-out test (320 rows): R² / MAE / RMSE / MAPE | 0.9973 / 0.183 / 0.317 t CO2e/t / 4.00% |
| Baseline: generating equation, no noise | R² 0.9981, RMSE 0.268, MAPE 2.44% |
| Baseline: plain calculator (grid and ore ignored) | R² 0.9457, RMSE 1.431, MAPE 14.90% |
| RMSE between SVR and the generating equation | 0.1802 t CO2e/t |
| Approximate 95% interval coverage (held-out) | 95.9% ({'Aluminium': 94.4, 'Copper': 94.9, 'Magnesium': 94.3, 'Steel': 100.0}) |
| Test rows within ±10% | 96.6% |

Wording to use: "R² = 0.997 on generated test scenarios", never "99.7% accuracy".
The model approximates a known equation; its contribution is a fitted, retrainable model with an error estimate.

## 2. Circularity pre-check (8,000 generated cases, seed 11)

Generated data (8,000 cases from UNEP 2011 / Reck & Graedel 2012 rules, one outcome drawn per case). 80/20 stratified split (random_state=42); classifier chosen by 5-fold stratified CV log loss on the 6,400 training rows; winner evaluated once on the 1,600 held-out rows.

| Item | Value |
|---|---|
| Selected classifier | Logistic Regression |
| Accuracy (held-out 1,600) | 59.8% |
| Always predict "lost" | 53.75% |
| Generating rule's most-likely class (reference) | 60.25% |
| Macro F1 | 0.511 |
| Log loss: model / class prior / generating rule | 0.8558 / 1.0006 / 0.8411 |
| Closed loop: precision / recall | 50.7% / 39.7% |
| Downcycled: precision / recall | 47.3% / 29.2% |
| Lost: precision / recall | 64.9% / 82.6% |
| Confusion matrix (rows = actual closed/down/lost) | [[116, 54, 122], [55, 131, 262], [58, 92, 710]] |

The comparison of predicted probabilities with the generating rule's probabilities is possible only because the data is simulated;
it says nothing about real recycler outcomes.

## 3. AI gap-filling (2,000 generated scenarios, seed 7) - held-out 400 rows

| Known inputs | Estimated column | R² | MAPE | Range covers |
|---|---|---|---|---|
| All drivers known (scrap %, ore, grid) | energy_gj | 0.997 | 3.1% | 94% |
| All drivers known (scrap %, ore, grid) | electricity_mwh | 0.997 | 3.0% | 92% |
| All drivers known (scrap %, ore, grid) | water_m3 | 0.994 | 4.8% | 93% |
| All drivers known (scrap %, ore, grid) | gwp_t_co2e | 0.993 | 5.1% | 96% |
| Scrap % and grid known | ore_grade_factor | -0.110 | 16.6% | 99% |
| Scrap % and grid known | energy_gj | 0.994 | 3.9% | 94% |
| Scrap % and grid known | electricity_mwh | 0.997 | 3.3% | 92% |
| Scrap % and grid known | water_m3 | 0.986 | 6.8% | 96% |
| Scrap % and grid known | gwp_t_co2e | 0.991 | 6.0% | 96% |
| Energy, electricity and water known | recycled_content | 0.987 | 27.6% | 95% |
| Energy, electricity and water known | ore_grade_factor | 0.176 | 13.7% | 98% |
| Energy, electricity and water known | grid_intensity_tco2_mwh | -0.142 | 22.7% | 98% |
| Energy, electricity and water known | gwp_t_co2e | 0.928 | 16.3% | 97% |
| Only energy known | recycled_content | 0.981 | 23.3% | 94% |
| Only energy known | ore_grade_factor | -0.047 | 15.5% | 98% |
| Only energy known | grid_intensity_tco2_mwh | -0.202 | 23.1% | 98% |
| Only energy known | electricity_mwh | 0.995 | 4.5% | 98% |
| Only energy known | water_m3 | 0.989 | 5.6% | 96% |
| Only energy known | gwp_t_co2e | 0.933 | 16.3% | 98% |
| Only scrap % known | ore_grade_factor | -0.114 | 16.2% | 98% |
| Only scrap % known | grid_intensity_tco2_mwh | -0.063 | 21.9% | 98% |
| Only scrap % known | energy_gj | 0.994 | 3.9% | 95% |
| Only scrap % known | electricity_mwh | 0.997 | 3.2% | 94% |
| Only scrap % known | water_m3 | 0.986 | 6.6% | 95% |
| Only scrap % known | gwp_t_co2e | 0.929 | 16.7% | 97% |

R² near or below 0 means the column cannot be estimated from those inputs; the app flags such estimates as low reliability.

## 4. Preliminary aggregate benchmark comparison (steel and aluminium only)

Preliminary aggregate benchmark comparison: six published company, national and industry averages for steel and aluminium only. It does not establish accuracy for individual plants, for copper or magnesium, or for other operating conditions.
EcoForge inputs: {'recycled_content': 0.0, 'grid_intensity_tco2_mwh': 0.7117, 'ore_grade_factor': 1.0, 'transport_km': 200.0}.

| Benchmark | Period | Published | EcoForge LCA | EcoForge ML | Published boundary |
|---|---|---|---|---|---|
| Tata Steel Ltd (India plants) | FY2024-25 | 2.46 | 2.20 (-10.5%) | 2.34 (-4.8%) | Company figure, worldsteel CO2 method (direct + indirect emissions, with by-product/slag credits) |
| Tata Steel NINL (Odisha) | FY2024-25 | 2.53 | 2.20 (-12.9%) | 2.34 (-7.4%) | Company figure, worldsteel CO2 method (direct + indirect, with by-product credits) |
| India steel sector average | 2023-24 | 2.54 | 2.20 (-13.3%) | 2.34 (-7.8%) | National average reported to Parliament; calculation boundary not detailed |
| Vedanta Aluminium | FY2024-25 | 17.01 | 16.11 (-5.3%) | 15.86 (-6.8%) | Company-reported GHG intensity for FY25; exact upstream coverage (e.g. alumina refining) not stated |
| Hindalco (aluminium) | 9 months FY2024-25 | 19.48 | 16.11 (-17.3%) | 15.86 (-18.6%) | Aluminium-specific GHG intensity for 9 months (Apr-Dec 2024) from an earnings call; boundary not detailed |
| IAI global primary aluminium | 2023 | 14.80 | 16.11 (+8.9%) | 15.86 (+7.1%) | IAI global GHG intensity for 2023 (headline figure) |

Mean absolute gap: ML 8.8% (5 of 6 within 10%), LCA engine 11.4%.
What-if (not in the mean): Power emission factor 0.7117 -> 0.925 t CO2/MWh (coal-heavy captive power) gives 18.65 t vs 19.48 (-4.3%).

## 5. Speed (this machine)

```
{
 "predict_gwp_ms": {
  "median": 0.96,
  "max": 1.57,
  "calls": 200
 },
 "precheck_with_fix_plan_ms": {
  "median": 138.28,
  "max": 180.88,
  "calls": 20
 },
 "gap_fill_new_pattern_ms": 1205.7,
 "gap_fill_cached_pattern_ms": 40.97,
 "batch_100_rows_one_pattern_ms": 1342.4,
 "batch_100_rows_five_patterns_ms": 6464.5,
 "batch_100_rows_five_patterns_cached_ms": 266.9,
 "note": "Single laptop, in-process calls (no network). The first request for a new combination of known fields trains small Random Forests (about 1-2 s); repeats reuse them. Batch rows with the same known fields are grouped and predicted together."
}
```

## 6. Environment and file fingerprints

```
{
 "python": "3.14.3",
 "numpy": "2.5.2",
 "pandas": "3.0.5",
 "scikit-learn": "1.9.0",
 "xgboost": "3.4.0",
 "fastapi": "0.110.1",
 "pydantic": "2.13.4",
 "os": "Windows-11-10.0.26200-SP0"
}
{
 "data/training_dataset.csv": "20002a763bb1",
 "data/process_dataset.csv": "bf958bd61aab",
 "data/precheck_dataset.csv": "9a456a1bb39b",
 "data/lca_emission_factors.csv": "6ee80f6cb175",
 "data/validation_benchmarks.csv": "f16537f443f9",
 "models/gwp_model.pkl": "c1aab429d3d9",
 "models/precheck.pkl": "62bd046405ed"
}
```
