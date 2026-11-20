# [37] REPORT FIGURES - redraws the evaluation figures for the report from the saved results
#      (models/model_lab.json, models/precheck_metrics.json, models/gap_filler_metrics.json, validation.run()).
"""
Run after reproduce_results.py:
    python make_report_figures.py            (needs matplotlib; any Python with pandas + matplotlib works)
Output: data/figures/*.png (200 dpi)
"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

BASE = Path(__file__).parent
OUT = BASE / "data" / "figures"
OUT.mkdir(parents=True, exist_ok=True)
plt.rcParams.update({"font.family": "Times New Roman", "font.size": 11, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.color": "#dddddd", "grid.linewidth": 0.6, "axes.axisbelow": True})
BLUE, ORANGE, GREEN, GREY, RED = "#2a78d6", "#e0782b", "#1f9e6e", "#9a9a9a", "#c94040"

lab = json.loads((BASE / "models" / "model_lab.json").read_text(encoding="utf-8"))
pre = json.loads((BASE / "models" / "precheck_metrics.json").read_text(encoding="utf-8"))
gap = json.loads((BASE / "models" / "gap_filler_metrics.json").read_text(encoding="utf-8"))
best = lab["best_model"]


def save(name):
    plt.tight_layout()
    plt.savefig(OUT / f"{name}.png", dpi=200)
    plt.close()
    print("saved", name)


# 1) CV R2 on training rows (selection), with test R2 shown separately
b = sorted(lab["benchmark"], key=lambda x: x["cv_r2_mean"])
fig, ax = plt.subplots(figsize=(6.4, 3.6))
y = np.arange(len(b))
ax.errorbar([x["cv_r2_mean"] for x in b], y, xerr=[x["cv_r2_std"] for x in b], fmt="o", color=GREY, ecolor=GREY, capsize=3)
for i, x in enumerate(b):
    if x["model"] == best:
        ax.errorbar([x["cv_r2_mean"]], [i], xerr=[x["cv_r2_std"]], fmt="o", color=BLUE, ecolor=BLUE, capsize=3)
    ax.text(x["cv_r2_mean"] + 0.004, i + 0.18, f"{x['cv_r2_mean']:.4f}", fontsize=9)
ax.set_yticks(y); ax.set_yticklabels([x["model"] for x in b])
ax.set_xlabel("Mean 5-fold CV R² on the 1,280 training rows (generated data)")
ax.set_xlim(0.75, 1.02)
save("fig10_1_cv_training_rows")

# 2) baselines on the held-out rows
bl = lab["baselines"]
fig, ax = plt.subplots(figsize=(6.4, 2.8))
names = [x["name"].replace(" (deployed ML model)", "\n(deployed model)").replace(" (no noise)", "\n(no noise)")
         .replace(" (grid and ore ignored)", "\n(grid and ore ignored)") for x in bl]
vals = [x["rmse"] for x in bl]
ax.barh(names, vals, color=[GREEN, BLUE, ORANGE])
for i, v in enumerate(vals):
    ax.text(v + 0.02, i, f"RMSE {v:.3f}  ·  R² {bl[i]['r2']:.4f}", va="center", fontsize=9)
ax.invert_yaxis(); ax.set_xlim(0, max(vals) * 1.8)
ax.set_xlabel("RMSE on the 320 held-out generated rows (t CO₂e per tonne)")
save("fig10_2_baselines")

# 3) learning curve (training rows only)
lc = lab["analysis"]["learning_curve"]
fig, ax = plt.subplots(figsize=(6.0, 3.2))
ax.plot(lc["train_sizes"], lc["train_r2"], "o-", color=ORANGE, label="Training score")
ax.plot(lc["train_sizes"], lc["cv_r2"], "o-", color=BLUE, label="Cross-validation score")
ax.set_xlabel("Training rows used"); ax.set_ylabel("R²"); ax.legend(frameon=False)
save("fig10_6_learning_curve")

# 4) benchmark comparison (preliminary, aggregate)
sys.path.insert(0, str(BASE))
try:
    vfile = BASE / "models" / "validation_results.json"     # written by reproduce_results.py
    if vfile.exists():
        val = json.loads(vfile.read_text(encoding="utf-8"))
    else:
        import validation
        val = validation.run()
    rows = val["rows"]
    fig, axes = plt.subplots(1, 2, figsize=(7.2, 3.4), gridspec_kw={"width_ratios": [3, 3]})
    for ax, metal in zip(axes, ["Steel", "Aluminium"]):
        rs = [r for r in rows if r["metal"] == metal]
        x = np.arange(len(rs)); w = 0.27
        ax.bar(x - w, [r["published_t_co2_per_t"] for r in rs], w, color="#3b4a6b", label="Published average")
        ax.bar(x, [r["ecoforge_lca"] for r in rs], w, color=ORANGE, label="EcoForge LCA engine")
        ax.bar(x + w, [r["ecoforge_ml"] for r in rs], w, color=BLUE, label="EcoForge ML")
        short = {"Tata Steel Ltd (India plants)": "Tata Steel\n(India plants)", "Tata Steel NINL (Odisha)": "Tata Steel\nNINL",
                 "India steel sector average": "India steel\naverage (MoS)", "Vedanta Aluminium": "Vedanta",
                 "Hindalco (aluminium)": "Hindalco\n(9 months)", "IAI global primary aluminium": "IAI global\naverage"}
        ax.set_xticks(x); ax.set_xticklabels([short.get(r["benchmark"], r["benchmark"]) for r in rs], fontsize=8)
        ax.set_title(metal, fontsize=11)
        ax.set_ylabel("t CO₂e per tonne")
    for ax in axes:                                      # head-room so the legend never covers a bar
        ax.set_ylim(0, ax.get_ylim()[1] * 1.45)
    axes[0].legend(frameon=False, fontsize=8, loc="upper left")
    save("fig10_7_benchmark_comparison")
except Exception as e:  # validation needs the backend's libraries; skip if not available
    print("skipped fig10_7:", e)

# 5) pre-check confusion matrix (share of each actual class)
cm = np.array(pre["confusion_matrix"], dtype=float)
share = cm / cm.sum(axis=1, keepdims=True)
labels = [c.replace("_", " ") for c in pre["classes"]]
fig, ax = plt.subplots(figsize=(4.6, 3.8))
ax.imshow(share, cmap="Blues", vmin=0, vmax=1)
ax.grid(False)
for i in range(3):
    for j in range(3):
        ax.text(j, i, f"{share[i, j] * 100:.0f}%\n({int(cm[i, j])})", ha="center", va="center", fontsize=9,
                color="white" if share[i, j] > 0.5 else "black")
ax.set_xticks(range(3)); ax.set_xticklabels(labels); ax.set_yticks(range(3)); ax.set_yticklabels(labels)
ax.set_xlabel("Predicted outcome"); ax.set_ylabel("Actual outcome (generated)")
save("fig10_8_confusion_matrix")

# 6) pre-check accuracy against baselines + per-class recall
fig, axes = plt.subplots(1, 2, figsize=(7.2, 3.0))
acc = [("Always 'lost'", pre["baselines"]["majority_accuracy"]), (pre["best_model"], pre["final"]["accuracy"]),
       ("Generating rule\n(reference)", pre["baselines"]["reference_rule_accuracy"])]
axes[0].bar([a for a, _ in acc], [v * 100 for _, v in acc], color=[GREY, BLUE, GREEN])
for i, (_, v) in enumerate(acc):
    axes[0].text(i, v * 100 + 1, f"{v * 100:.2f}%", ha="center", fontsize=9)
axes[0].set_ylim(0, 75); axes[0].set_ylabel("Accuracy on held-out cases (%)"); axes[0].tick_params(axis="x", labelsize=8)
pc = pre["per_class"]
axes[1].bar([c["class"].replace("_", " ") for c in pc], [c["recall"] * 100 for c in pc], color=[RED if c["recall"] < 0.5 else BLUE for c in pc])
for i, c in enumerate(pc):
    axes[1].text(i, c["recall"] * 100 + 1, f"{c['recall'] * 100:.0f}%", ha="center", fontsize=9)
axes[1].set_ylim(0, 100); axes[1].set_ylabel("Recall (%)")
save("fig10_9_precheck_baselines_recall")

# 7) gap-filling R2 by missing-input pattern (heatmap)
cols = ["energy_gj", "electricity_mwh", "water_m3", "gwp_t_co2e", "recycled_content", "grid_intensity_tco2_mwh", "ore_grade_factor"]
nice = {"energy_gj": "Energy", "electricity_mwh": "Electricity", "water_m3": "Water", "gwp_t_co2e": "CO₂",
        "recycled_content": "Scrap %", "grid_intensity_tco2_mwh": "Grid", "ore_grade_factor": "Ore grade"}
pats = gap["patterns"]
M = np.full((len(pats), len(cols)), np.nan)
for i, p in enumerate(pats):
    for j, c in enumerate(cols):
        if c in p["targets"]:
            M[i, j] = p["targets"][c]["r2"]
fig, ax = plt.subplots(figsize=(7.4, 3.4))
cmap = matplotlib.colormaps["RdYlGn"].copy()
cmap.set_bad("#e6e6e6")                                   # grey = value was entered, not estimated
ax.imshow(np.ma.masked_invalid(np.clip(M, 0, 1)), cmap=cmap, vmin=0, vmax=1, aspect="auto")
ax.grid(False)
for i in range(M.shape[0]):
    for j in range(M.shape[1]):
        ax.text(j, i, "known" if np.isnan(M[i, j]) else f"{M[i, j]:.2f}", ha="center", va="center", fontsize=8,
                color="#555555" if np.isnan(M[i, j]) else "black")
ax.set_xticks(range(len(cols))); ax.set_xticklabels([nice[c] for c in cols], fontsize=9)
ax.set_yticks(range(len(pats))); ax.set_yticklabels([p["pattern"] for p in pats], fontsize=8)
ax.set_title("R² of each AI estimate on held-out generated rows (below 0.5 = flagged low reliability)", fontsize=9)
save("fig10_10_gapfill_patterns")
