# How to Run the LCA Tool Locally

Full-stack app: **FastAPI backend** (ML models) + **React frontend**.

## Prerequisites
- Python 3.14 (installed)
- Node.js 24 + npm (installed)
- MongoDB is optional — only the `/status` endpoints use it. All ML prediction
  features work without it.

## One-time setup (already done)
Backend virtual environment + packages, and frontend node_modules are already
installed. If you ever need to redo them:

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m pip install xgboost   # needed by the aluminum model

# Frontend
cd frontend
npm install --legacy-peer-deps
npm install ajv@^8.17.1 d3@^7.9.0 --legacy-peer-deps
```

## Running (two terminals)

### Terminal 1 — Backend (http://localhost:8000)
```bash
cd backend
venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
API docs: http://localhost:8000/docs

### Terminal 2 — Frontend (http://localhost:3000)
```bash
cd frontend
npm start
```
Open http://localhost:3000

## Fixes applied to make it run locally
1. `frontend/.env` → `REACT_APP_BACKEND_URL` changed from the remote
   emergentagent.com URL to `http://localhost:8000`.
2. Added `xgboost` to the backend (required by the aluminum model, was missing
   from requirements.txt).
3. Added `ajv@^8` to the frontend (fixes a CRA `ajv/dist/compile/codegen`
   module-resolution error).
4. Added `d3@^7.9.0` to the frontend (was listed in the root package.json but
   missing from frontend/package.json; used by the Sankey visualizations).

## Notes
- scikit-learn shows `InconsistentVersionWarning` (models trained on 1.6.1,
  running on 1.9.0). Harmless — models load and predict correctly.
- A `ws://localhost:3000/ws failed` console message is just the hot-reload
  socket; it does not affect the app.
