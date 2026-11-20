# EcoForge - ML Model Benchmark (generated data)

Generated data (1,600 scenarios). 80/20 split (random_state=42); model selection by 5-fold CV on the 1,280 training rows only; scaling inside each fold; winner evaluated once on the 320 held-out rows.
Model version `gwp-svr-20002a763bb1`. Generated 2026-11-15T19:29:03.

| Rank | Model | 5-fold CV R² (training rows) | Test R² | MAE | RMSE | MAPE | Train (ms) |
|---|---|---|---|---|---|---|---|
| 1 | SVR | 0.9970 ± 0.0003 | 0.9973 | 0.183 | 0.317 | 4.00% | 670 |
| 2 | Gradient Boosting | 0.9943 ± 0.0006 | 0.9947 | 0.277 | 0.446 | 5.34% | 1058 |
| 3 | XGBoost | 0.9933 ± 0.0009 | 0.9954 | 0.260 | 0.417 | 5.31% | 1668 |
| 4 | Random Forest | 0.9928 ± 0.0008 | 0.9939 | 0.291 | 0.479 | 4.98% | 581 |
| 5 | Decision Tree | 0.9836 ± 0.0043 | 0.9823 | 0.471 | 0.816 | 7.75% | 9 |
| 6 | KNN | 0.9778 ± 0.0034 | 0.9765 | 0.552 | 0.942 | 15.30% | 12 |
| 7 | Linear Regression | 0.7813 ± 0.0224 | 0.7739 | 2.281 | 2.920 | 118.72% | 5 |

Ranking uses only the CV column. Test columns are reported once, after selection.

## Baselines on the same 320 test rows

| Method | R² | MAE | RMSE | MAPE |
|---|---|---|---|---|
| Generating equation (no noise) | 0.9981 | 0.147 | 0.268 | 2.44% |
| SVR (deployed ML model) | 0.9973 | 0.183 | 0.317 | 4.00% |
| Plain calculator (grid and ore ignored) | 0.9457 | 0.874 | 1.431 | 14.90% |

The deployed SVR approximates the known generating equation (RMSE between them: 0.180 t CO2e/t).

## Approximate 95% interval

prediction +/- 1.96 x per-metal std of out-of-fold training residuals; coverage measured on the 320 test rows. Measured coverage: 95.9% overall; per metal {'Aluminium': 94.4, 'Copper': 94.9, 'Magnesium': 94.3, 'Steel': 100.0}.
Generated data only. Coverage on real plants has not been measured.

96.6% of test predictions are within ±10% of the generated value.
