# EcoForge — AI-Driven Life Cycle Assessment for Circular Metals

An AI/ML tool for **Life Cycle Assessment (LCA)** advancing **circularity and
sustainability in metallurgy and mining**. It estimates the environmental impact
(energy, CO₂e, waste), recyclability, and closed-loop potential of metals across
their supply chain, grounded in **ISO 14040/14044** methodology.

## Tech stack
- **Backend:** FastAPI (Python) + scikit-learn ML models — port 8000
- **Frontend:** React (Create React App / craco) — port 3000
- **Visualisation:** d3 Sankey material-flow diagram, Plotly charts

## 📊 Dataset & data sources  →  `backend/data/`
| File | What it is |
|---|---|
| `lca_emission_factors.csv` | Cradle-to-gate LCA factors (energy, CO₂e, water, recyclability) for aluminium, steel, copper, magnesium — primary/recycled/hybrid |
| `training_dataset.csv` | 1,600-row supervised dataset for the ML model (grounded in the cited factors) |
| `SOURCES.md` | Citations for every factor (IAI, worldsteel, ICA, ISO 14040) |
| `GOVERNMENT_DATA_SOURCES.md` | Official Govt-of-India data sources (CEA, IBM, data.gov.in, BEE) |
| `model_metrics.md` | Validated model accuracy report (R², MAE, RMSE) |

**Key data anchor:** electricity→CO₂ uses the **CEA India grid factor
0.7117 t CO₂/MWh** (CEA CO₂ Baseline Database v21.0, FY 2024-25).

## 🤖 Machine learning
- `backend/train_real_model.py` — trains & validates a RandomForest GWP model
  (80/20 split). Latest run: **R² ≈ 0.99** on the held-out test set.
- Output model: `backend/models/gwp_model.pkl`
- Retrain anytime: `venv\Scripts\python.exe train_real_model.py`

## ▶️ How to run
Double-click **`START_APP.bat`**, or see **`HOW_TO_RUN.md`** for terminal steps.
Then open http://localhost:3000  (backend API docs at http://localhost:8000/docs).

## Project structure
```
LCA-main/
├── backend/          FastAPI server, ML predictor, training pipeline
│   ├── data/         ← DATASET + data sources (see table above)
│   ├── models/       trained ML model (gwp_model.pkl)
│   ├── server.py     API endpoints
│   └── ml_predictor.py
├── frontend/         React app (EcoForge UI)
│   └── src/data/lcaEngine.js   cited LCA factor library
├── START_APP.bat     one-click launcher
└── HOW_TO_RUN.md     run instructions
```
