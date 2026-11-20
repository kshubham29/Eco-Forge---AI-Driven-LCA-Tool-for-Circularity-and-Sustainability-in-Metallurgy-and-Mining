# [1] BACKEND API - FastAPI server. Defines every endpoint the frontend calls (e.g. /predict-gwp, /circularity-precheck).
from fastapi import FastAPI, APIRouter, Path as PathParam
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ValidationError, field_validator
from fastapi.exceptions import RequestValidationError
from typing import List, Literal
import math
from ml_predictor import predict_gwp
from model_lab import get_model_lab
from gap_filler import estimate_missing, estimate_missing_batch
from validation import run as run_validation
from assessments import list_assessments, save_assessment, delete_assessment
from circularity_precheck import precheck, precheck_metrics
from typing import Optional
import pandas as pd


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app without a prefix
app = FastAPI()


def _first_error(errors):
    """Turn Pydantic's error list into one readable sentence for the user."""
    if not errors:
        return "Invalid input."
    e = errors[0]
    field = ".".join(str(p) for p in e.get("loc", []) if p not in ("body",))
    msg = str(e.get("msg", "invalid value")).replace("Value error, ", "")
    return f"{field}: {msg}" if field else msg


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    # same shape as every other API answer, so the frontend can show the message
    return JSONResponse(status_code=422, content={"success": False, "error": _first_error(exc.errors()),
                                                  "details": jsonable_errors(exc.errors())})


def jsonable_errors(errors):
    return [{"loc": [str(p) for p in e.get("loc", [])], "msg": str(e.get("msg", ""))} for e in errors]


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


Metal = Literal["Aluminium", "Copper", "Magnesium", "Steel"]


class GwpPredictionRequest(BaseModel):
    metal: Metal
    recycled_content: float = Field(0.0, ge=0, le=1)                 # 0..1 share of recycled input
    grid_intensity_tco2_mwh: float = Field(0.7117, gt=0, le=2.0)     # CEA India grid factor default
    ore_grade_factor: float = Field(1.0, gt=0, le=5)
    transport_km: float = Field(500.0, ge=0, le=50000)

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "EcoForge API", "docs": "/docs"}

@api_router.post("/predict-gwp")
async def predict_gwp_endpoint(request: GwpPredictionRequest):
    """Predict cradle-to-gate GWP (t CO2e/tonne) using the trained ML model."""
    try:
        return predict_gwp(request.dict())
    except Exception as e:
        return {
            "success": False,
            "error": f"Server error: {str(e)}",
            "predicted_gwp_t_co2e_per_tonne": None
        }

@api_router.get("/model-lab")
async def model_lab_endpoint():
    """Benchmark of 7 ML models + prediction analysis of the deployed model (cached)."""
    try:
        return {"success": True, **get_model_lab()}
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

# primary cradle-to-gate t CO2e per tonne (data/lca_emission_factors.csv) for the site CO2 estimate
SITE_GWP = {"crude steel": 2.19, "aluminium": 16.1, "refined copper": 3.83}

@api_router.get("/india-sites")
async def india_sites_endpoint():
    """Major metal plants and mines in India (data/india_metal_sites.csv) with an annual CO2 estimate."""
    try:
        df = pd.read_csv(ROOT_DIR / "data" / "india_metal_sites.csv")
        sites = []
        for s in df.to_dict(orient="records"):
            s = {k: (None if pd.isna(v) else v) for k, v in s.items()}
            g = SITE_GWP.get(s["capacity_unit"])
            s["est_co2_mt"] = round(s["capacity_mtpa"] * g, 2) if g and s["capacity_mtpa"] else None
            sites.append(s)
        return {"success": True, "sites": sites,
                "note": "Locations approximate; capacities rounded from company reports. CO2 = capacity x primary GWP factor."}
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

GAP_COLUMNS = {"recycled_content": (0, 1), "ore_grade_factor": (0.01, 5), "grid_intensity_tco2_mwh": (0, 2),
               "transport_km": (0, 50000), "energy_gj": (0, 2000), "electricity_mwh": (0, 100),
               "water_m3": (0, 1000), "gwp_t_co2e": (0, 200)}


class EstimateRequest(BaseModel):
    metal: Metal
    values: dict = {}                       # column -> number, or null when unknown

    @field_validator("values")
    @classmethod
    def check_values(cls, v):
        for k, x in v.items():
            if k not in GAP_COLUMNS:
                raise ValueError(f"unknown column '{k}'; allowed: {', '.join(GAP_COLUMNS)}")
            if x in (None, ""):
                continue
            try:
                x = float(x)
            except (TypeError, ValueError):
                raise ValueError(f"{k} must be a number")
            lo, hi = GAP_COLUMNS[k]
            if math.isnan(x) or not lo <= x <= hi:
                raise ValueError(f"{k} = {x:g} is outside the physically meaningful range {lo}-{hi}")
        return v

@api_router.post("/estimate-missing")
def estimate_missing_endpoint(request: EstimateRequest):
    """AI fills the process values the user does not know (energy, electricity, water, CO2, ...)."""
    try:
        return estimate_missing(request.dict())
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

class EstimateBatchRequest(BaseModel):
    rows: List[dict] = Field(..., min_length=1, max_length=500)   # one per plant from an uploaded CSV

@api_router.post("/estimate-missing-batch")
def estimate_missing_batch_endpoint(request: EstimateBatchRequest):
    """Fill the missing values of many plants at once (uploaded CSV), max 500 rows.
    Each row is validated on its own, so one bad row returns an error for that row only.
    Rows with the same metal and the same known columns reuse one cached model per missing column."""
    try:
        results, valid = [None] * len(request.rows), {}
        for i, row in enumerate(request.rows):
            try:
                valid[i] = EstimateRequest.model_validate(row).model_dump()
            except ValidationError as e:
                results[i] = {"success": False, "error": _first_error(e.errors())}
        for i, out in zip(valid, estimate_missing_batch(list(valid.values()))):
            results[i] = out
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

class AssessmentIn(BaseModel):
    title: str = Field("", max_length=120)
    metal: Literal["Aluminium", "Copper", "Magnesium", "Steel"]
    route: Literal["Primary", "Recycled", "Hybrid"]
    scrap_pct: float = Field(0, ge=0, le=100)
    weight_kg: float = Field(..., gt=0, le=1e9)
    transport_km: float = Field(0, ge=0, le=1e6)
    transport_mode: Literal["Truck", "Rail", "Sea"] = "Truck"
    boundary: Literal["gate", "grave"] = "gate"
    energy_gj: float = Field(..., ge=0)
    co2_kg: float = Field(..., ge=0)        # cradle-to-gate
    co2_grave_kg: Optional[float] = None    # cradle-to-grave net (can be negative with a recycling credit)
    water_m3: float = Field(0, ge=0)
    waste_kg: float = Field(0, ge=0)
    recyclability: float = Field(0, ge=0, le=100)
    closed_loop: float = Field(0, ge=0, le=100)
    mci: float = Field(0, ge=0, le=1)
    hotspot: str = Field("", max_length=60)
    hotspot_share: float = Field(0, ge=0, le=100)

@api_router.get("/assessments")
def list_assessments_endpoint():
    """All saved assessments, newest first (Reports page)."""
    try:
        return {"success": True, "assessments": list_assessments()}
    except Exception as e:
        return {"success": False, "error": str(e), "assessments": []}

@api_router.post("/assessments")
def save_assessment_endpoint(request: AssessmentIn):
    """Save the current Calculator result so it can be tracked over time."""
    try:
        return {"success": True, "assessment": save_assessment(request.dict())}
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

@api_router.delete("/assessments/{item_id}")
def delete_assessment_endpoint(item_id: str = PathParam(..., pattern=r"^[0-9a-f]{12}$")):
    return {"success": delete_assessment(item_id)}

class PrecheckRequest(BaseModel):
    metal: str = "Aluminium"                # metal / sector / coating / collection are checked against the model's lists
    sector: str = "Automotive"
    alloy_mix: int = Field(1, ge=0, le=2)   # 0 single alloy, 1 a few alloys, 2 mixed / unknown
    coating: str = "paint"
    attachments_pct: float = Field(5, ge=0, le=100)
    oil: int = Field(1, ge=0, le=2)         # 0 none, 1 light, 2 heavy
    corrosion: int = Field(1, ge=0, le=2)   # 0 none, 1 surface, 2 heavy
    collection: str = "informal scrap dealer"
    design_for_disassembly: int = Field(0, ge=0, le=1)
    distance_km: float = Field(300, ge=0, le=20000)
    lifetime_years: float = Field(12, ge=0, le=200)

@api_router.post("/circularity-precheck")
def circularity_precheck_endpoint(request: PrecheckRequest):
    """Predict before processing: closed loop / downcycled / lost, the barriers and a fix plan."""
    try:
        return precheck(request.dict())
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

@api_router.get("/circularity-precheck/metrics")
def circularity_precheck_metrics_endpoint():
    """Benchmark and accuracy of the pre-check classifier (AI & Validation page)."""
    try:
        return {"success": True, **precheck_metrics()}
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

@api_router.get("/validation")
def validation_endpoint():
    """EcoForge results vs published figures (Tata Steel, Vedanta, Hindalco, Ministry of Steel, IAI)."""
    try:
        return run_validation()
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

@api_router.get("/india-production")
async def india_production_endpoint():
    """National production by fiscal year (Ministry of Steel / Ministry of Mines), data/india_metal_production.csv."""
    try:
        df = pd.read_csv(ROOT_DIR / "data" / "india_metal_production.csv")
        rows = [{k: (None if pd.isna(v) else v) for k, v in r.items()} for r in df.to_dict(orient="records")]
        return {"success": True, "rows": rows}
    except Exception as e:
        return {"success": False, "error": f"Server error: {str(e)}"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

