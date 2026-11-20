# [36] CIRCULARITY PRE-CHECK - predicts BEFORE processing whether a scrap batch / end-of-life product will go back
#      into the same-grade metal (closed loop), be downcycled, or be lost - and what to change to improve the odds.
"""
EcoForge - circularity pre-check (ML classifier)

Question it answers: "I have this scrap or product. Can it actually be recycled back into the same
quality metal, will it be downcycled into a lower grade, or will it be lost?"

Training data
-------------
Real recycler outcome records are not public, so outcomes are generated from rules informed by
published recycling research:
  * collection by sector and metal - UNEP International Resource Panel (2011), "Recycling Rates of Metals"
  * quality losses from mixed alloys, coatings, attachments, oil and corrosion, and why that causes
    downcycling - Reck & Graedel (2012), "Challenges in metal recycling", Science 337
  * product lifetime and distance lower collection ("hibernating" stock, uneconomic transport)
For every case the rules give a probability for each outcome, and ONE outcome is drawn at random,
just like a real recycler log records one result per batch. The ML model learns from those outcome
labels, not from the rules, so the same pipeline can be retrained on real recycler data later.

Run:  venv\\Scripts\\python.exe circularity_precheck.py
Output: data/precheck_dataset.csv, models/precheck.pkl, models/precheck_metrics.json
"""

import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, log_loss, precision_recall_fscore_support
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

BASE = Path(__file__).parent
DATASET = BASE / "data" / "precheck_dataset.csv"
MODEL = BASE / "models" / "precheck.pkl"
METRICS = BASE / "models" / "precheck_metrics.json"

CLASSES = ["closed_loop", "downcycled", "lost"]
METALS = ["Aluminium", "Copper", "Magnesium", "Steel"]
SECTORS = ["Construction", "Automotive", "Machinery & equipment", "Electrical & electronics", "Packaging", "Consumer goods"]
COATINGS = ["none", "paint", "galvanised / plated", "plastic laminate"]
COLLECTIONS = ["organised recycler", "informal scrap dealer", "mixed municipal waste"]
NUMERIC = ["alloy_mix", "attachments_pct", "oil", "corrosion", "design_for_disassembly", "distance_km", "lifetime_years"]
LEVEL = {0: "none / single", 1: "light / few", 2: "heavy / mixed"}

# --- reference rules (informed by UNEP 2011 and Reck & Graedel 2012) ---
SECTOR_COLLECTION = {"Construction": 0.85, "Automotive": 0.85, "Machinery & equipment": 0.90,
                     "Electrical & electronics": 0.55, "Packaging": 0.50, "Consumer goods": 0.45}
METAL_COLLECTION = {"Steel": 0.05, "Aluminium": 0.0, "Copper": 0.02, "Magnesium": -0.15}
METAL_QUALITY = {"Steel": 0.80, "Aluminium": 0.55, "Copper": 0.65, "Magnesium": 0.35}
ALLOY_SENSITIVITY = {"Steel": 0.5, "Aluminium": 1.0, "Copper": 0.7, "Magnesium": 1.1}


def reference_probs(c):
    """Outcome probabilities for one case (dict). Used ONLY to generate training labels."""
    m = c["metal"]
    collect = SECTOR_COLLECTION[c["sector"]] + METAL_COLLECTION[m]
    collect *= {"organised recycler": 1.05, "informal scrap dealer": 0.95, "mixed municipal waste": 0.40}[c["collection"]]
    collect *= 1 - 0.004 * max(0.0, c["lifetime_years"] - 15)          # long-lived goods get lost or hibernate
    collect *= 1 - 0.00012 * c["distance_km"]                            # far from a recycler = less collected
    collect = float(np.clip(collect, 0.02, 0.99))

    q = METAL_QUALITY[m]
    q -= ALLOY_SENSITIVITY[m] * [0.0, 0.15, 0.35][c["alloy_mix"]]
    q -= {"none": 0.0, "paint": 0.06, "plastic laminate": 0.15,
          "galvanised / plated": 0.04 if m == "Steel" else 0.10}[c["coating"]]
    q -= 0.007 * c["attachments_pct"]
    q -= [0.0, 0.03, 0.10][c["oil"]]
    q -= [0.0, 0.03, 0.10][c["corrosion"]] * (1.5 if m == "Magnesium" else 1.0)
    q += {"organised recycler": 0.05, "informal scrap dealer": -0.08, "mixed municipal waste": -0.15}[c["collection"]]
    q += 0.08 * c["design_for_disassembly"]
    q = float(np.clip(q, 0.02, 0.97))

    loss = 0.02 + 0.004 * c["attachments_pct"] + (0.03 if c["corrosion"] == 2 else 0) + (0.05 if m == "Magnesium" else 0)
    loss = float(min(loss, 0.30, 1 - q))
    closed = collect * q
    lost = (1 - collect) + collect * loss
    return np.array([closed, max(0.0, 1 - closed - lost), lost])


def build_dataset(n=8000, seed=11):
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n):
        c = {"metal": rng.choice(METALS), "sector": rng.choice(SECTORS),
             "alloy_mix": int(rng.choice([0, 1, 2], p=[0.4, 0.35, 0.25])),
             "coating": rng.choice(COATINGS, p=[0.45, 0.3, 0.15, 0.1]),
             "attachments_pct": float(round(rng.choice([0, 0, rng.uniform(0, 40)]), 1)),
             "oil": int(rng.choice([0, 1, 2], p=[0.55, 0.3, 0.15])),
             "corrosion": int(rng.choice([0, 1, 2], p=[0.5, 0.35, 0.15])),
             "collection": rng.choice(COLLECTIONS, p=[0.35, 0.45, 0.20]),
             "design_for_disassembly": int(rng.random() < 0.25),
             "distance_km": float(round(rng.uniform(5, 1500), 0)),
             "lifetime_years": float(round(rng.uniform(1, 60), 0))}
        p = reference_probs(c)
        c["outcome"] = CLASSES[rng.choice(3, p=p / p.sum())]       # one recorded outcome per batch
        c.update({f"p_{k}": round(float(v), 4) for k, v in zip(CLASSES, p)})
        rows.append(c)
    return pd.DataFrame(rows)


def encode(df):
    X = df[NUMERIC].astype(float).copy()
    for col, values in [("metal", METALS), ("sector", SECTORS), ("coating", COATINGS), ("collection", COLLECTIONS)]:
        for v in values:
            X[f"{col}={v}"] = (df[col] == v).astype(float)
    return X


CANDIDATES = {
    "Logistic Regression": lambda: make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0)),
    "Random Forest": lambda: RandomForestClassifier(n_estimators=400, min_samples_leaf=20, random_state=42, n_jobs=-1),
    "Gradient Boosting": lambda: GradientBoostingClassifier(n_estimators=250, learning_rate=0.05, max_depth=3, random_state=42),
    "XGBoost": lambda: XGBClassifier(n_estimators=400, learning_rate=0.04, max_depth=3, subsample=0.9, colsample_bytree=0.9,
                                     min_child_weight=10, random_state=42, n_jobs=-1, eval_metric="mlogloss"),
}


def train():
    """Protocol: 80/20 stratified split (random_state=42). The classifier is CHOSEN by 5-fold stratified CV
    log loss on the training rows only; the winner is then evaluated once on the held-out test rows and
    exactly that fitted model is deployed. All 8,000 cases are GENERATED from literature-based rules."""
    df = build_dataset()
    df.to_csv(DATASET, index=False)
    X, y = encode(df), df["outcome"].map({k: i for i, k in enumerate(CLASSES)}).values
    ref = df[[f"p_{k}" for k in CLASSES]].values
    Xtr, Xte, ytr, yte, _, rte = train_test_split(X, y, ref, test_size=0.2, random_state=42, stratify=y)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    bench, fitted = [], {}
    for name, make in CANDIDATES.items():
        cv = cross_validate(make(), Xtr, ytr, cv=skf, n_jobs=-1, scoring={"ll": "neg_log_loss", "acc": "accuracy"})
        m = make().fit(Xtr, ytr)
        p = m.predict_proba(Xte)
        bench.append({"model": name,
                      "cv_log_loss": round(float(-cv["test_ll"].mean()), 4), "cv_log_loss_std": round(float(cv["test_ll"].std()), 4),
                      "cv_accuracy": round(float(cv["test_acc"].mean()), 4),
                      # test numbers: reported after selection, never used to rank
                      "log_loss": round(float(log_loss(yte, p)), 4),
                      "accuracy": round(float(accuracy_score(yte, p.argmax(1))), 4),
                      "macro_f1": round(float(f1_score(yte, p.argmax(1), average="macro")), 4),
                      # distance to the rule probabilities that generated the data (only measurable on generated data)
                      "prob_mae_pts": round(float(np.abs(p - rte).mean() * 100), 2)})
        fitted[name] = m
        print(f"{name:20s} CV logloss {bench[-1]['cv_log_loss']:.4f} (train folds) | test logloss {bench[-1]['log_loss']:.4f}  "
              f"acc {bench[-1]['accuracy']:.3f}  macroF1 {bench[-1]['macro_f1']:.3f}")
    bench.sort(key=lambda b: b["cv_log_loss"])
    best = bench[0]["model"]
    bm = fitted[best]
    p = bm.predict_proba(Xte)
    pred = p.argmax(1)

    # reference points on the same test rows
    majority = int(np.bincount(ytr).argmax())                      # most common class in TRAINING data
    majority_acc = float((yte == majority).mean())
    ceiling = float((rte.argmax(1) == yte).mean())                  # always pick the true most-likely class
    oracle_ll = float(log_loss(yte, rte / rte.sum(1, keepdims=True)))
    prior_ll = float(log_loss(yte, np.tile(np.bincount(ytr, minlength=3) / len(ytr), (len(yte), 1))))
    prec, rec, f1s, sup = precision_recall_fscore_support(yte, pred, labels=[0, 1, 2], zero_division=0)
    per_class = [{"class": CLASSES[i], "precision": round(float(prec[i]), 4), "recall": round(float(rec[i]), 4),
                  "f1": round(float(f1s[i]), 4), "support": int(sup[i])} for i in range(3)]

    perm = permutation_importance(bm, Xte, yte, scoring="neg_log_loss", n_repeats=5, random_state=42, n_jobs=-1)
    groups = {}
    for col, v in zip(X.columns, perm.importances_mean):
        g = col.split("=")[0]
        groups[g] = groups.get(g, 0) + float(v)

    metrics = {
        "rows": len(df), "train_rows": len(ytr), "test_rows": len(yte), "classes": CLASSES, "generated": True,
        "protocol": ("Generated data (8,000 cases from UNEP 2011 / Reck & Graedel 2012 rules, one outcome drawn per case). "
                     "80/20 stratified split (random_state=42); classifier chosen by 5-fold stratified CV log loss on the "
                     "6,400 training rows; winner evaluated once on the 1,600 held-out rows."),
        "benchmark": bench, "best_model": best,
        "final": {"accuracy": round(float(accuracy_score(yte, pred)), 4), "macro_f1": round(float(f1_score(yte, pred, average="macro")), 4),
                  "log_loss": round(float(log_loss(yte, p)), 4)},
        "per_class": per_class,
        "baselines": {"majority_class": CLASSES[majority], "majority_accuracy": round(majority_acc, 4),
                      "prior_log_loss": round(prior_ll, 4),
                      "reference_rule_accuracy": round(ceiling, 4), "reference_rule_log_loss": round(oracle_ll, 4)},
        "accuracy_ceiling": round(ceiling, 4),
        "class_share": {k: round(float((df.outcome == k).mean()), 3) for k in CLASSES},
        "confusion_matrix": confusion_matrix(yte, pred, labels=[0, 1, 2]).tolist(),
        "importance": sorted([{"feature": k, "importance": round(v, 4)} for k, v in groups.items()], key=lambda d: -d["importance"]),
        "sources": ["UNEP International Resource Panel (2011), Recycling Rates of Metals",
                    "Reck & Graedel (2012), Challenges in metal recycling, Science 337"],
        "generator": "build_dataset(n=8000, seed=11)",
        "trained_at": datetime.now().isoformat(timespec="seconds"),
    }
    METRICS.write_text(json.dumps(metrics, indent=1), encoding="utf-8")
    joblib.dump({"model": bm, "columns": list(X.columns), "name": best, "trained_at": metrics["trained_at"],
                 "trained_on": f"{len(ytr)} generated training cases"}, MODEL)   # deploy exactly the evaluated model
    print(f"Best by CV: {best}. Test acc {metrics['final']['accuracy']:.3f} vs always-'{CLASSES[majority]}' "
          f"{majority_acc:.3f} and reference rule {ceiling:.3f}. Saved {MODEL.name}, {METRICS.name}")
    return metrics


# ---------------- prediction API ----------------
_B = None
DEFAULTS = {"metal": "Aluminium", "sector": "Automotive", "alloy_mix": 1, "coating": "paint", "attachments_pct": 5,
            "oil": 1, "corrosion": 1, "collection": "informal scrap dealer", "design_for_disassembly": 0,
            "distance_km": 300, "lifetime_years": 12}

ACTIONS = [  # (field, better value, label, applies when)
    ("coating", "none", "Remove paint / coating before recycling", lambda c: c["coating"] != "none"),
    ("alloy_mix", 0, "Sort scrap by alloy (XRF / LIBS sorting)", lambda c: c["alloy_mix"] > 0),
    ("attachments_pct", 0.0, "Dismantle plastic, rubber and glass parts", lambda c: c["attachments_pct"] > 1),
    ("oil", 0, "Clean off oil and grease", lambda c: c["oil"] > 0),
    ("collection", "organised recycler", "Send to an organised recycler or take-back scheme", lambda c: c["collection"] != "organised recycler"),
]
# applies to the NEXT generation of products, not to scrap that already exists
FUTURE = ("design_for_disassembly", 1, "Design new products for easy disassembly")
FIXED = [("corrosion", 0, "Corrosion / rust"), ("lifetime_years", 15.0, "Long product lifetime"), ("distance_km", 50.0, "Distance to recycler")]


def _clean(data):
    c = {**DEFAULTS, **{k: v for k, v in (data or {}).items() if v is not None}}
    for k in ("alloy_mix", "oil", "corrosion", "design_for_disassembly"):
        c[k] = int(c[k])
    for k in ("attachments_pct", "distance_km", "lifetime_years"):
        c[k] = float(c[k])
    return c


def _proba(cases):
    global _B
    if _B is None:
        if not MODEL.exists():
            train()
        _B = joblib.load(MODEL)
    X = encode(pd.DataFrame(cases))[_B["columns"]]
    return _B["model"].predict_proba(X)


def precheck(data):
    c = _clean(data)
    for k, opts in [("metal", METALS), ("sector", SECTORS), ("coating", COATINGS), ("collection", COLLECTIONS)]:
        if c[k] not in opts:
            return {"success": False, "error": f"{k} must be one of: {', '.join(opts)}"}
    p = _proba([c])[0]

    # what each fix alone would do, then a greedy plan that applies the best fix first
    singles = []
    for field, val, label, ok in ACTIONS:
        if ok(c):
            singles.append({"field": field, "value": val, "label": label,
                            "gain_pts": round(float(_proba([{**c, field: val}])[0][0] - p[0]) * 100, 1)})
    plan, cur, cur_p = [], dict(c), p[0]
    remaining = [s for s in singles]
    while remaining:
        trials = [(s, _proba([{**cur, s["field"]: s["value"]}])[0][0]) for s in remaining]
        s, new_p = max(trials, key=lambda t: t[1])
        if new_p - cur_p < 0.005:
            break
        cur[s["field"]] = s["value"]
        plan.append({**s, "closed_loop_after": round(float(new_p) * 100, 1)})
        cur_p = new_p
        remaining = [r for r in remaining if r is not s]
    after = _proba([cur])[0]

    barriers = []
    for field, val, label in FIXED:
        if c[field] != val and not (field == "lifetime_years" and c[field] <= 15) and not (field == "distance_km" and c[field] <= 50):
            gain = float(_proba([{**c, field: val}])[0][0] - p[0]) * 100
            if gain > 0.5:
                barriers.append({"label": label, "cost_pts": round(gain, 1), "fixable": False})
    barriers += [{"label": s["label"], "cost_pts": s["gain_pts"], "fixable": True} for s in singles if s["gain_pts"] > 0.5]
    barriers.sort(key=lambda b: -b["cost_pts"])

    future = None
    if c["design_for_disassembly"] == 0:
        f, v, label = FUTURE
        future = {"field": f, "value": v, "label": label,
                  "gain_pts": round(float(_proba([{**cur, f: v}])[0][0] - after[0]) * 100, 1)}

    verdict = ("Likely closed loop" if p[0] >= 0.6 else "At risk of downcycling" if p[0] >= 0.35 else "Unlikely to stay in a closed loop")
    return {"success": True, "inputs": c, "probabilities": dict(zip(CLASSES, [round(float(v), 4) for v in p])),
            "verdict": verdict, "barriers": barriers[:5], "plan": plan, "future": future,
            "after_fixes": dict(zip(CLASSES, [round(float(v), 4) for v in after])), "after_inputs": cur,
            "model": _B["name"]}


def precheck_metrics():
    if not METRICS.exists():
        train()
    return json.loads(METRICS.read_text(encoding="utf-8"))


if __name__ == "__main__":
    train()
