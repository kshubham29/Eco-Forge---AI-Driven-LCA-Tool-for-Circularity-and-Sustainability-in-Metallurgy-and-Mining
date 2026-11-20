# 🗂️ EcoForge — File Guide (Numbered, Easy to Explain)

Read this top-to-bottom when explaining your project. Files are grouped by role
and numbered in the order they matter.

---

## ▶️ SECTION A — How to run (start here)
| # | File | What to say |
|---|------|-------------|
| A1 | `START_APP.bat` | "Double-click this — it starts the whole project." |
| A2 | `run_backend.bat` | "Starts only the backend server." |
| A3 | `run_frontend.bat` | "Starts only the frontend website." |

---

## ⚙️ SECTION B — Backend = the BRAIN (Python) `/backend`
The part that does the calculations and machine learning.

| # | File | What to say |
|---|------|-------------|
| B1 | `server.py` | "The main API — it receives requests and sends back results." |
| B2 | `ml_predictor.py` | "The machine-learning logic — makes the predictions." |
| B3 | `train_real_model.py` | "The script that trains and validates my ML model (R² = 0.99)." |
| B4 | `requirements.txt` | "List of Python libraries the project needs." |
| B5 | `models/gwp_model.pkl` | "My main trained ML model (carbon prediction)." |

### Other backend files
| # | File | What to say |
|---|------|-------------|
| B6 | `model_lab.py` | "Compares 7 algorithms and saves the best one as the CO₂ model." |
| B7 | `circularity_precheck.py` | "The Pre-check model: closed loop / downcycled / lost." |
| B8 | `gap_filler.py` | "Fills missing plant data with a Random Forest." |
| B9 | `validation.py` | "Checks the model against 6 published figures." |

---

## 🎨 SECTION C — Frontend = the FACE (React) `/frontend/src`
The website the user sees and clicks.

| # | File | What to say |
|---|------|-------------|
| C1 | `index.js` | "The entry point — the first file that runs." |
| C2 | `App.js` | "The router — decides which page to show." |
| C3 | `pages/Home.jsx` | "The landing/welcome page." |
| C4 | `pages/Calculator.jsx` | "The MAIN screen — where the user calculates impact." |
| C5 | `pages/Reports.jsx` | "The reports page (PDF download, export)." |
| C6 | `pages/Insights.jsx` / `About.jsx` | "Analytics page and About page." |
| C7 | `data/lcaEngine.js` | "The LCA formulas and emission factors used for calculation." |
| C8 | `components/` folder | "Reusable UI pieces — input sidebar, result cards, the Sankey diagram, the ML card." |

---

## 📊 SECTION D — Datasets `/backend/data`
| # | File | What to say |
|---|------|-------------|
| D1 | `lca_emission_factors.csv` | "MAIN dataset — energy & CO₂ per tonne for each metal." |
| D2 | `training_dataset.csv` | "The data my ML model is trained on (1,600 rows)." |
| D3 | `india_metal_production.csv` | "Real Government of India production data." |
| D4 | `india_co2_data.csv` | "India's national CO₂ data (context)." |
| D5 | `SOURCES.md` + `GOVERNMENT_DATA_SOURCES.md` | "Where every number comes from (citations)." |
| D6 | `model_metrics.md` | "My ML model's accuracy report (R² = 0.99)." |
| D7 | `EcoForge_Datasets.xlsx` | "All datasets in one Excel file (for showing)." |

---

## 📄 SECTION E — Documents (root folder)
| # | File | What to say |
|---|------|-------------|
| E1 | `README.md` | "Short project overview." |
| E2 | `PROJECT_GUIDE.md` | "Detailed explanation of the whole project." |
| E3 | `HOW_TO_RUN.md` | "Steps to run the project." |
| E4 | `FILE_GUIDE.md` | "THIS file — what every file does." |

---

## 🎤 30-SECOND WALKTHROUGH (say this)
> "My project has two main parts. The **frontend** (Section C — React) is the website the
> user interacts with. The **backend** (Section B — Python) is the brain that runs the
> machine-learning models. The user's input goes from the frontend to the backend's
> `server.py`, which uses `ml_predictor.py` and the trained model files to calculate the
> result, then sends it back to the screen. All the data is in Section D, sourced and cited."

**The 3 files that matter most:** `server.py` (B1), `ml_predictor.py` (B2), `Calculator.jsx` (C4).
