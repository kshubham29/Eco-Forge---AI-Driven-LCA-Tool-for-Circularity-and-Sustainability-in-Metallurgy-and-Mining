# 📘 EcoForge — Project Guide (Viva / Explanation Sheet)

> **What is this project?**
> EcoForge is an **AI-driven Life Cycle Assessment (LCA) tool** that measures the
> environmental impact (energy, CO₂, waste) of metals and predicts their
> **recyclability** and **closed-loop potential** — to advance **circularity and
> sustainability in metallurgy and mining**.

---

## 1️⃣ Folder structure (what you see in VS Code Explorer)

```
LCA-main/
├── backend/      → THE BRAIN  (Python) — calculations, ML, API
├── frontend/     → THE FACE   (React) — what the user sees & clicks
├── README.md     → short project overview
├── PROJECT_GUIDE.md → THIS FILE (full explanation)
├── HOW_TO_RUN.md → step-by-step run instructions
└── START_APP.bat → one-click launcher (starts everything)
```

---

## 2️⃣ Inside `backend/` — the brain (Python)

| File / Folder | What it does |
|---|---|
| **server.py** | The API — defines the web endpoints the frontend calls (`/predict-gwp`, `/circularity-precheck`, `/estimate-missing`, etc.) |
| **ml_predictor.py** | The ML logic — loads the trained models and makes predictions |
| **train_real_model.py** | Trains & validates the ML model (RandomForest) on our dataset |
| **models/** | Stores the trained ML model (`gwp_model.pkl`) |
| **data/** | 📊 THE DATASET + all data sources (see section 4) |
| **requirements.txt** | List of Python libraries the backend needs |
| **create_\*_model.py** | Older scripts that generated the first models |
| **.env** | Configuration (database URL, settings) |

---

## 3️⃣ Inside `frontend/` — the face (React)

| File / Folder | What it does |
|---|---|
| **src/index.js** | App entry point — the very first file that runs |
| **src/App.js** | The router — decides which page to show |
| **src/pages/** | The 5 screens of the app |
| &nbsp;&nbsp;• Home.jsx | Landing / welcome page |
| &nbsp;&nbsp;• Calculator.jsx | Main screen — enter inputs, see results |
| &nbsp;&nbsp;• Reports.jsx | View / export the report |
| &nbsp;&nbsp;• Insights.jsx | Analytics & insights |
| &nbsp;&nbsp;• About.jsx | About the project |
| **src/components/** | Reusable UI pieces (cards, charts, sidebar) |
| &nbsp;&nbsp;• InputSidebar.jsx | Where the user enters metal, route, weight |
| &nbsp;&nbsp;• ResultsArea.jsx | Shows all the results |
| &nbsp;&nbsp;• KeyIndicatorsCard.jsx | Energy / CO₂ / waste numbers |
| &nbsp;&nbsp;• RecycledSankey.jsx | The material-flow diagram |
| &nbsp;&nbsp;• InsightsCard.jsx | AI recommendations |
| **src/data/lcaEngine.js** | The LCA formulas & emission factors (cited) |
| **package.json** | List of frontend libraries |

---

## 4️⃣ Inside `backend/data/` — 📊 THE DATASET

| File | What it is |
|---|---|
| **india_metal_production.csv** | REAL Government-of-India production data (Ministry of Mines/Steel) |
| **lca_emission_factors.csv** | LCA impact factors — energy & CO₂ per tonne (IAI, worldsteel, ICA) |
| **training_dataset.csv** | 1,600-row dataset used to train the ML model |
| **SOURCES.md** | Citations for every number |
| **GOVERNMENT_DATA_SOURCES.md** | Official govt data source links (CEA, IBM, data.gov.in) |
| **model_metrics.md** | ML model accuracy report (R² = 0.99) |

**Data method:** real production data (Govt of India) × cited LCA factors (IAI/worldsteel),
localised with the **CEA India grid factor (0.7117 t CO₂/MWh)**. Based on **ISO 14040**.

---

## 5️⃣ How it works — the flow (FIRST → LAST)

```
START_APP.bat
   │
   ├─► BACKEND boots:  start_server.py → server.py → ml_predictor.py → loads models + data
   │
   └─► FRONTEND boots: index.js → App.js → Home.jsx (first page)

USER JOURNEY:
   Home → clicks "Start Calculating"
        → Calculator page → enters inputs (InputSidebar)
        → clicks "Run Calculation"
        → lcaEngine.js does LCA math  +  backend ML predicts recyclability
        → ResultsArea shows: numbers + Sankey diagram + AI tips
        → Reports page (export)
```

---

## 6️⃣ Tech stack (say this if asked)

```
Frontend:  React + Tailwind CSS + Plotly/D3 (charts)
Backend:   Python + FastAPI + Uvicorn
ML:        scikit-learn + XGBoost + pandas
Database:  MongoDB (optional)
```

---

## 7️⃣ Main features (what the project can do)

1. **Impact Calculator** — energy, CO₂, and waste for any metal & route
2. **Recyclability prediction** (ML) — how recyclable the metal is
3. **Closed-loop potential** (ML) — circular-economy score
4. **Lifetime prediction** (ML) — for aluminium, copper, steel, magnesium
5. **Sankey flow diagram** — visualises material flow through the supply chain
6. **AI recommendations** — tips to cut environmental impact
7. **Reports** — exportable results

---

## 8️⃣ Machine Learning (the "AI" part)

- **Models:** RandomForest, Decision Tree, XGBoost (scikit-learn / XGBoost)
- **Trained on:** a dataset grounded in real LCA factors + CEA grid factor
- **Validated:** 80/20 train-test split, **R² = 0.99** (see `data/model_metrics.md`)
- **Retrain command:** `venv\Scripts\python.exe train_real_model.py`

---

## 9️⃣ How to run (quick)

1. Open folder `LCA-main\LCA-main` in VS Code
2. Double-click **START_APP.bat** (or see HOW_TO_RUN.md)
3. Open **http://localhost:3000**

---

## 🎤 30-second explanation to your professor

> "EcoForge is an AI-based Life Cycle Assessment tool for the metals industry.
> The user selects a metal and how it's produced. The React frontend sends this
> to a Python FastAPI backend, which uses machine-learning models to calculate
> the environmental impact — energy, CO₂, waste — and predict recyclability and
> circular-economy potential. Our dataset combines real Government-of-India
> production data with international LCA factors and the CEA grid emission factor,
> following ISO 14040 methodology. The results are shown as clear numbers, a
> Sankey flow diagram, and AI recommendations to reduce impact."
