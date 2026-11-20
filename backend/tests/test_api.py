"""API, input-validation and regression tests for the EcoForge backend.

Run from the backend folder:   venv\\Scripts\\python -m pytest tests -q
All model numbers come from GENERATED training data; these tests check behaviour and units,
not real-world accuracy.
"""
import json
import os
import sys
import time
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ecoforge_test")

from fastapi.testclient import TestClient  # noqa: E402

import assessments  # noqa: E402
import server  # noqa: E402

client = TestClient(server.app)


def post(path, body):
    return client.post(f"/api{path}", json=body)


# ---------------------------------------------------------------- CO2 prediction
def test_predict_gwp_primary_aluminium_has_range_and_version():
    r = post("/predict-gwp", {"metal": "Aluminium", "recycled_content": 0, "grid_intensity_tco2_mwh": 0.7117,
                              "ore_grade_factor": 1, "transport_km": 200}).json()
    assert r["success"]
    v = r["predicted_gwp_t_co2e_per_tonne"]
    assert 14.5 < v < 17.5                         # cited 16.1 t CO2e/t (IAI) plus a little transport
    lo, hi = r["range_95"]
    assert lo < v < hi
    assert "Approximate" in r["range_note"]
    assert r["model_version"].startswith("gwp-")


def test_predict_gwp_recycled_is_much_lower_than_primary():
    p = post("/predict-gwp", {"metal": "Aluminium", "recycled_content": 0}).json()["predicted_gwp_t_co2e_per_tonne"]
    rc = post("/predict-gwp", {"metal": "Aluminium", "recycled_content": 1}).json()["predicted_gwp_t_co2e_per_tonne"]
    assert rc < 0.15 * p


@pytest.mark.parametrize("body", [
    {"metal": "Gold"},                                   # unknown metal
    {"metal": "Steel", "recycled_content": 1.5},         # impossible share
    {"metal": "Steel", "transport_km": -10},             # negative distance
    {"metal": "Steel", "grid_intensity_tco2_mwh": 0},    # zero grid factor
    {},                                                  # missing metal
])
def test_predict_gwp_rejects_invalid_input(body):
    r = post("/predict-gwp", body)
    assert r.status_code == 422
    assert r.json()["success"] is False and r.json()["error"]


# ---------------------------------------------------------------- circularity pre-check
def test_precheck_painted_car_aluminium_plan_improves():
    r = post("/circularity-precheck", {"metal": "Aluminium", "sector": "Automotive", "alloy_mix": 2, "coating": "paint",
                                       "attachments_pct": 10, "oil": 1, "corrosion": 1,
                                       "collection": "informal scrap dealer"}).json()
    assert r["success"]
    p = r["probabilities"]
    assert abs(sum(p.values()) - 1) < 1e-3
    assert p["closed_loop"] < 0.2
    after = r["after_fixes"]["closed_loop"]
    assert after > p["closed_loop"]
    steps = [s["closed_loop_after"] for s in r["plan"]]
    assert steps == sorted(steps)                        # greedy plan never goes down


def test_precheck_rejects_bad_values():
    assert post("/circularity-precheck", {"alloy_mix": 5}).status_code == 422
    assert post("/circularity-precheck", {"attachments_pct": 150}).status_code == 422
    r = post("/circularity-precheck", {"sector": "Spaceships"}).json()
    assert r["success"] is False


# ---------------------------------------------------------------- AI gap-filling
def test_gap_fill_regression_primary_aluminium_energy():
    """Regression: the old iterative imputer gave ~46 GJ/t here; the cited value is ~155 GJ/t."""
    r = post("/estimate-missing", {"metal": "Aluminium", "values": {"recycled_content": 0}}).json()
    assert r["success"]
    e = r["values"]["energy_gj"]
    assert e["estimated"] and 120 < e["value"] < 180
    assert e["range"][0] <= e["value"] <= e["range"][1]


def test_gap_fill_flags_unreliable_columns():
    r = post("/estimate-missing", {"metal": "Steel", "values": {"recycled_content": 0.2}}).json()
    assert r["values"]["ore_grade_factor"]["low_reliability"] is True
    assert r["values"]["energy_gj"]["low_reliability"] is False
    assert any("cannot be estimated reliably" in w for w in r["warnings"])


@pytest.mark.parametrize("values", [
    {"energy_gj": -5},            # negative
    {"recycled_content": 2},      # share above 1
    {"water_m3": "lots"},         # not a number
    {"mystery_column": 1},        # unknown column
])
def test_gap_fill_rejects_invalid_values(values):
    r = post("/estimate-missing", {"metal": "Steel", "values": values})
    assert r.status_code == 422 and r.json()["success"] is False


def test_gap_fill_batch_reports_bad_rows_individually():
    r = post("/estimate-missing-batch", {"rows": [
        {"metal": "Steel", "values": {"recycled_content": 0.5}},
        {"metal": "Unobtainium", "values": {"recycled_content": 0.5}},
        {"metal": "Copper", "values": {"energy_gj": -1}},
    ]}).json()
    assert r["success"]
    ok, bad_metal, bad_value = r["results"]
    assert ok["success"] and not bad_metal["success"] and not bad_value["success"]


def test_gap_fill_batch_limits():
    assert post("/estimate-missing-batch", {"rows": []}).status_code == 422
    rows = [{"metal": "Steel", "values": {"recycled_content": 0.1}}] * 501
    assert post("/estimate-missing-batch", {"rows": rows}).status_code == 422


def test_gap_fill_cache_makes_repeat_pattern_faster():
    body = {"metal": "Copper", "values": {"recycled_content": 0.3, "water_m3": 50}}
    t0 = time.perf_counter(); post("/estimate-missing", body); first = time.perf_counter() - t0
    t1 = time.perf_counter(); post("/estimate-missing", body); second = time.perf_counter() - t1
    assert second < first


# ---------------------------------------------------------------- saved assessments
@pytest.fixture
def temp_store(tmp_path, monkeypatch):
    monkeypatch.setattr(assessments, "FILE", tmp_path / "assessments.json")
    return tmp_path / "assessments.json"


GOOD = {"title": "test", "metal": "Steel", "route": "Primary", "scrap_pct": 0, "weight_kg": 1000,
        "transport_km": 1000, "transport_mode": "Truck", "boundary": "gate", "energy_gj": 22.7, "co2_kg": 2240,
        "water_m3": 28.6, "waste_kg": 950, "recyclability": 88, "closed_loop": 80, "mci": 0.4,
        "hotspot": "Smelting", "hotspot_share": 70}


def test_assessment_save_list_delete_roundtrip(temp_store):
    saved = post("/assessments", GOOD).json()["assessment"]
    listed = client.get("/api/assessments").json()["assessments"]
    assert [a["id"] for a in listed] == [saved["id"]]
    assert client.delete(f"/api/assessments/{saved['id']}").json()["success"]
    assert client.get("/api/assessments").json()["assessments"] == []


def test_assessment_rejects_invalid(temp_store):
    assert post("/assessments", {**GOOD, "route": "Teleport"}).status_code == 422
    assert post("/assessments", {**GOOD, "weight_kg": -1}).status_code == 422
    assert post("/assessments", {**GOOD, "mci": 3}).status_code == 422
    assert client.delete("/api/assessments/..%2Fsecret").status_code in (404, 422)


def test_damaged_store_is_not_wiped(temp_store):
    temp_store.write_text("{not json", encoding="utf-8")
    r = post("/assessments", GOOD).json()
    assert r["success"] is False                              # refuses to overwrite
    backups = list(temp_store.parent.glob("assessments.corrupt-*.json"))
    assert backups and backups[0].read_text(encoding="utf-8") == "{not json"


# ---------------------------------------------------------------- removed endpoints + validation
def test_page_endpoints_work_and_removed_ones_stay_removed():
    # every GET endpoint a page loads must answer with success (catches a missing constant or import)
    for path in ("/api/india-sites", "/api/india-production", "/api/model-lab", "/api/assessments"):
        r = client.get(path)
        assert r.status_code == 200 and r.json().get("success") is not False, path
    sites = client.get("/api/india-sites").json()
    assert sites["success"] and any(s["est_co2_mt"] for s in sites["sites"])
    # old lifetime/recyclability models and live retraining were removed; retrain with `python model_lab.py`
    for path in ("/api/predict-lifetime", "/api/predict-recyclability", "/api/predict-closed-loop", "/api/model-lab/retrain"):
        assert client.post(path, json={}).status_code == 404


def test_validation_endpoint_aggregate_comparison():
    r = client.get("/api/validation").json()
    assert r["success"] and len(r["rows"]) == 6
    assert {row["metal"] for row in r["rows"]} == {"Steel", "Aluminium"}
    assert r["summary"]["ml"]["mean_abs_error_pct"] < 15


# ---------------------------------------------------------------- ML protocol regressions
def test_model_selection_did_not_use_test_rows():
    lab = json.loads((BACKEND / "models" / "model_lab.json").read_text(encoding="utf-8"))
    assert "training rows only" in lab["dataset"]["cv"]
    ranks = sorted(lab["benchmark"], key=lambda b: b["rank"])
    cv = [b["cv_r2_mean"] for b in ranks]
    assert cv == sorted(cv, reverse=True)                     # ranking follows CV, not test R2
    names = [b["name"] for b in lab["baselines"]]
    assert any("Generating equation" in n for n in names)
    assert 80 <= lab["interval_coverage"]["overall_pct"] <= 100


def test_deployed_model_carries_its_scaler_and_metadata():
    import joblib
    bundle = joblib.load(BACKEND / "models" / "gwp_model.pkl")
    model = bundle["model"]
    if bundle["name"] in ("SVR", "KNN"):
        assert "standardscaler" in model.named_steps        # preprocessing saved with the model
    assert set(bundle["residual_std_by_metal"]) == {"Aluminium", "Copper", "Magnesium", "Steel"}
    assert bundle["model_version"] and bundle["trained_on"].startswith("1280")


def test_precheck_metrics_report_baselines_and_per_class():
    m = json.loads((BACKEND / "models" / "precheck_metrics.json").read_text(encoding="utf-8"))
    assert m["baselines"]["majority_class"] == "lost"
    assert m["final"]["accuracy"] > m["baselines"]["majority_accuracy"]
    assert {c["class"] for c in m["per_class"]} == {"closed_loop", "downcycled", "lost"}
    assert "training rows" in m["protocol"]


def test_batch_grouping_gives_same_answers_as_single_requests():
    import gap_filler
    rows = [{"metal": "Steel", "values": {"recycled_content": 0.2}},
            {"metal": "Aluminium", "values": {"recycled_content": 0.7}},
            {"metal": "Copper", "values": {"energy_gj": 30}}]
    batch = gap_filler.estimate_missing_batch(rows)
    for row, b in zip(rows, batch):
        single = gap_filler.estimate_missing(row)
        for col, v in single["values"].items():
            assert abs(v["value"] - b["values"][col]["value"]) < 1e-9
