# EcoForge — GWP Model Validation Report

**Model:** RandomForestRegressor (300 trees, max_depth=14)
**Task:** Predict cradle-to-gate GWP (t CO2e / tonne) from a production scenario
**Training data:** parametric dataset grounded in cited LCA factors
(IAI / worldsteel / ICA) + CEA India grid factor 0.7117 t CO2/MWh.
Rows: 1600  |  Train/Test split: 80/20 (held-out test set)

## Accuracy (on the held-out test set)
| Metric | Value |
|---|---|
| R² (coefficient of determination) | **0.9939** |
| MAE (mean absolute error) | 0.2914 t CO2e/tonne |
| RMSE (root mean squared error) | 0.4786 t CO2e/tonne |

## Feature importance
- `recycled_content`: 0.419
- `metal_Magnesium`: 0.405
- `metal_Aluminium`: 0.128
- `grid_intensity_tco2_mwh`: 0.042
- `ore_grade_factor`: 0.003
- `transport_km`: 0.001
- `metal_Steel`: 0.001
- `metal_Copper`: 0.001

## How to quote this
> "Our GWP model is a RandomForest trained on a parametric LCA dataset grounded
> in IAI/worldsteel/ICA factors and the CEA (Government of India) grid emission
> factor. Validated on a held-out 20% test set it achieves R² = 0.994."

Files: `models/gwp_model.pkl`, `data/training_dataset.csv`
