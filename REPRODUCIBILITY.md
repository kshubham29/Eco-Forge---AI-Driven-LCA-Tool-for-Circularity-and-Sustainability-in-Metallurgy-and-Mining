# EcoForge - reproducibility, assumptions and tests

This file says how every number shown in the app, the report and the slides is produced, what is assumed,
and how to check it. The current numbers are in `backend/data/EVALUATION_RESULTS.md`.

## 1. Re-create every dataset, model and result

```
cd backend
venv\Scripts\python reproduce_results.py
```

This regenerates the three generated datasets, retrains and re-selects every model, re-runs the benchmark
comparison and the speed test, and rewrites `backend/data/EVALUATION_RESULTS.md` (with library versions and
SHA-256 fingerprints of the data and model files). It takes about two minutes on a laptop.

## 2. What is generated and what is published

| Item | Rows | Kind | Generator and seed |
|---|---|---|---|
| CO2 scenarios (`data/training_dataset.csv`) | 1,600 (400 per metal) | **Generated** from cited factors with a known equation + 3% noise | `train_real_model.build_and_save()`, `numpy.random.default_rng(42)` |
| Process scenarios for gap-filling (`data/process_dataset.csv`) | 2,000 (500 per metal) | **Generated** | `gap_filler.build_dataset(seed=7)` |
| Pre-check cases (`data/precheck_dataset.csv`) | 8,000 | **Generated** from UNEP (2011) and Reck & Graedel (2012) rules; one outcome drawn per case | `circularity_precheck.build_dataset(seed=11)` |
| Emission, energy and water factors (`data/lca_emission_factors.csv`) | 12 | Published (IAI, worldsteel, ICA, Ehrenberger 2013) | - |
| Benchmarks (`data/validation_benchmarks.csv`) | 6 | Published company, national and industry **averages** for steel and aluminium | - |
| India production, plants and mines | 28 + 44 | Published (Ministry of Steel, Ministry of Mines, IBM, company reports) | - |

The machine-learning models have never been trained or tested on measured plant data or real recycler outcomes.

## 3. Model selection and evaluation protocol

| Model | Split | Selection | Final test | Deployed |
|---|---|---|---|---|
| CO2 prediction (7 regressors) | 80/20, `random_state=42` | Mean 5-fold CV R² (KFold, shuffled, `random_state=42`) on the 1,280 **training** rows only | Once, on the 320 held-out rows, after selection | The selected model as fitted on the training rows (the evaluated model) |
| Pre-check (4 classifiers) | 80/20 stratified, `random_state=42` | Mean 5-fold stratified CV log loss on the 6,400 training rows | Once, on the 1,600 held-out rows | The selected model as fitted on the training rows |
| Gap-filling (Random Forest per missing column) | 80/20 stratified by metal, `random_state=42` | Not selected (one method) | On 400 held-out rows, for 5 missing-input patterns + hide-one | Live models are fitted on all 2,000 rows per pattern, then cached |

Preprocessing: SVR, KNN and Logistic Regression use `StandardScaler` inside a scikit-learn `Pipeline`, so the
scaler is re-fitted on each training fold and is saved inside the model file used for predictions. One-hot
encoding of the metal is fixed (no fitted parameters).

Prediction interval (CO2): prediction ± 1.96 × the per-metal standard deviation of **out-of-fold** training
residuals. Its coverage is then measured on the held-out rows (about 96%). It is an approximate interval on
generated data, not a verified 95% interval for real plants.

Gap-filling interval: ± 1.96 × the per-metal spread of out-of-bag errors. Columns whose out-of-bag R² is below
0.5 for the given inputs are flagged "low reliability" in the app and in the exported CSV.

## 4. Model parameters

| Model | Parameters |
|---|---|
| SVR (deployed CO2 model) | `StandardScaler` → `SVR(C=30, epsilon=0.05, gamma="scale")`, RBF kernel |
| Gradient Boosting | 300 trees, learning rate 0.05, max depth 4 |
| XGBoost | 400 trees, learning rate 0.05, max depth 6, subsample 0.9, colsample 0.9 |
| Random Forest | 300 trees, max depth 14 |
| Decision Tree | max depth 10 |
| KNN | `StandardScaler` → 7 neighbours, distance weights |
| Linear Regression | default |
| Pre-check: Logistic Regression (deployed) | `StandardScaler` → `LogisticRegression(C=1.0, max_iter=2000)` |
| Pre-check alternatives | Random Forest 400 trees (min leaf 20); Gradient Boosting 250 trees; XGBoost 400 trees |
| Gap-filler | Random Forest, 150 trees live (80 in the evaluation, for speed), min leaf 2, out-of-bag on |

Every saved model file carries its name, version (`gwp-<model>-<data hash>`), training date, number of training
rows, parameters, error spreads and library versions.

## 5. Modelling assumptions (these are choices, not validated facts)

1. **Cited totals.** Each metal and route uses one published cradle-to-gate factor per tonne (Table in
   `data/lca_emission_factors.csv`). These are global or industry averages, not Indian plant values.
2. **Stage shares.** The split of a primary-route total into mining, refining, smelting and casting comes from
   indicative per-kg stage constants in `frontend/src/data/lcaEngine.js`, rescaled so the stages add up to the cited
   total. Rescaling makes the total match; it does **not** independently validate the hotspot shares.
3. **Recycled-route stages.** The recycled-route stage split uses the aluminium recycled-route shares as a template
   for all metals. Totals are metal-specific.
4. **Transport.** DEFRA freight factors (truck 0.062, rail 0.022, sea 0.015 kg CO2 per t-km). The chosen transport
   mode applies to the mine→refinery leg; refinery→smelter is assumed by sea and smelter→market by truck.
   The recycled route adds no separate transport (it is inside the cited recycled factor).
5. **Hybrid route.** Mass is split by the scrap share; the primary part uses the primary route (with transport),
   the scrap part the recycled factor. Hybrid at 0% equals primary and at 100% equals recycled (tested).
6. **Grid and ore adjustment (generated CO2 data only).** CO2 = mixed factor × (0.75 × grid / 0.7117 + 0.25 × ore)
   + 0.062 × km / 1000. The 75/25 split between electricity-driven and process emissions is an assumption.
7. **Electricity per tonne** (gap-filler and target planner): aluminium 15 / 0.7, copper 3.5 / 0.9, magnesium 7 /
   0.5, steel 0.6 / 0.65 MWh per tonne (primary / recycled), indicative values.
8. **Grid factor.** CEA CO2 Baseline Database v21, 0.7117 t CO2 per MWh (FY 2024-25, weighted average).
9. **End-of-life collection** defaults are midpoints of UNEP (2011) end-of-life recycling-rate ranges: aluminium
   60%, copper 48%, steel 80%, magnesium 39%; recycling yields 92 / 90 / 90 / 85%.
10. **Recycling credit.** Net-scrap method (worldsteel; EN 15804 Module D): (collected − recycled input) × yield ×
    (primary − recycled factor) × mass. A credit is an accounting convention, not an emission that disappears.
11. **Use phase** is zero by default because it depends on the product.
12. **Pre-check rules** for collection and grade retention follow UNEP (2011) and Reck & Graedel (2012) in
    direction; the exact effect sizes are our assumptions.

Two default scenarios exist, so two aluminium numbers appear: the Calculator default (500 + 300 + 200 km over three
legs) gives 16.15 t CO2e per tonne; the benchmark run (200 km by truck) gives 16.11 t.

## 6. Tests

```
cd backend
venv\Scripts\python -m pytest tests\test_api.py -q        # 27 API, validation, storage and protocol tests

cd frontend
set CI=true && npx craco test --watchAll=false src/data   # 37 tests: units, route mixing, stage totals, MCI, credit, planner
```

Regression tests cover bugs found during development: steel stages 8× too high before calibration, the old
gap-filler giving about 46 GJ for primary aluminium, test rows leaking into model selection, and a damaged
assessments file being silently replaced by an empty list.

## 7. Storage and access

Saved assessments are kept in `backend/data/assessments.json`. Writes go to a temporary file that is swapped in
one step, and requests in one server process are serialised by a lock. This is a single-user file store, not a
database: it has no multi-process transactions. The file is limited to 5 MB and 1,000 entries; a damaged file is
moved aside instead of being overwritten. Retraining (`POST /api/model-lab/retrain`) replaces the live model and
is only accepted from the server machine itself.
