// [15] MODEL LAB CHARTS - builds every Model Lab chart (benchmark, prediction analysis, heatmaps).
//      Used by the page and by the PDF report, so both always show the same charts.
import { C, SEQ, DIV, axis, layout } from "../components/Plot";
import { lcaEngine } from "./lcaEngine";

export const METALS = ["Aluminium", "Copper", "Magnesium", "Steel"];

const NICE = {
  recycled_content: "Recycled content", grid_intensity_tco2_mwh: "Grid intensity",
  ore_grade_factor: "Ore grade factor", transport_km: "Transport distance",
  gwp_t_co2e_per_tonne: "GWP (target)",
};
export const nice = (f) => NICE[f] || f.replace(/^metal_/, "Metal = ").replace(/^is_/, "Is ");

const winnerColors = (rows, best) => rows.map((b) => (b.model === best ? C.blue : C.gray));

// 5-fold CV R2 with +/- std, as a dot plot (no zero baseline needed for dots)
export const figCv = (bench, best) => {
  const rows = [...bench].reverse();
  return {
    data: [{
      type: "scatter", mode: "markers", orientation: "h",
      x: rows.map((b) => b.cv_r2_mean), y: rows.map((b) => b.model),
      error_x: { type: "data", array: rows.map((b) => b.cv_r2_std), color: C.ink2, thickness: 1.5, width: 4 },
      marker: { size: 12, color: winnerColors(rows, best), line: { color: "#fff", width: 2 } },
      hovertemplate: "%{y}<br>CV R² = %{x:.4f}<extra></extra>",
    }],
    layout: layout({ margin: { l: 130, r: 24, t: 8, b: 44 }, xaxis: axis("5-fold cross-validation R² (higher is better)"), yaxis: axis() }),
  };
};

// RMSE bars from zero (lower is better)
export const figRmse = (bench, best) => {
  const rows = [...bench].sort((a, b) => b.rmse - a.rmse);
  return {
    data: [{
      type: "bar", orientation: "h", x: rows.map((b) => b.rmse), y: rows.map((b) => b.model),
      marker: { color: winnerColors(rows, best) }, text: rows.map((b) => b.rmse.toFixed(3)),
      textposition: "outside", cliponaxis: false, textfont: { color: C.ink2, size: 11 },
      hovertemplate: "%{y}<br>RMSE = %{x:.3f} t CO₂e/t<extra></extra>",
    }],
    layout: layout({ margin: { l: 130, r: 48, t: 8, b: 44 }, xaxis: axis("Test RMSE, t CO₂e per tonne (lower is better)", { rangemode: "tozero" }), yaxis: axis() }),
  };
};

// model x metric heatmap; colour = score scaled 0..1 per column (1 = best), text = real value
export const figBenchHeat = (bench) => {
  const cols = [
    { k: "r2", label: "Test R²", hi: true, f: (v) => v.toFixed(4) },
    { k: "cv_r2_mean", label: "CV R²", hi: true, f: (v) => v.toFixed(4) },
    { k: "mae", label: "MAE", hi: false, f: (v) => v.toFixed(3) },
    { k: "rmse", label: "RMSE", hi: false, f: (v) => v.toFixed(3) },
    { k: "mape", label: "MAPE %", hi: false, f: (v) => v.toFixed(1) },
    { k: "overfit_gap", label: "Overfit gap", hi: false, f: (v) => v.toFixed(4) },
  ];
  const rows = [...bench].reverse();
  const z = rows.map((b) => cols.map((c) => {
    const vals = bench.map((x) => x[c.k]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const s = hi === lo ? 1 : (b[c.k] - lo) / (hi - lo);
    return c.hi ? s : 1 - s;
  }));
  const text = rows.map((b) => cols.map((c) => c.f(b[c.k])));
  return {
    data: [{
      type: "heatmap", z, x: cols.map((c) => c.label), y: rows.map((b) => b.model), text,
      texttemplate: "%{text}", textfont: { size: 11 }, colorscale: SEQ, zmin: 0, zmax: 1, xgap: 2, ygap: 2,
      colorbar: { title: { text: "score", side: "right" }, thickness: 10, tickvals: [0, 1], ticktext: ["worst", "best"] },
      hovertemplate: "%{y} · %{x}: %{text}<extra></extra>",
    }],
    layout: layout({ margin: { l: 130, r: 16, t: 8, b: 40 }, xaxis: axis(null, { side: "bottom", gridcolor: "rgba(0,0,0,0)" }), yaxis: axis(null, { gridcolor: "rgba(0,0,0,0)" }) }),
  };
};

const diagonal = (lo, hi) => ({
  type: "scatter", mode: "lines", x: [lo, hi], y: [lo, hi], hoverinfo: "skip",
  line: { color: C.ink2, width: 1.5, dash: "dash" },
});

// actual vs predicted for one metal (small multiples: one chart per metal)
export const figActualPred = (actual, pred, metals, metal) => {
  const idx = actual.map((_, i) => i).filter((i) => !metal || metals[i] === metal);
  const xs = idx.map((i) => actual[i]), ys = idx.map((i) => pred[i]);
  const lo = Math.min(...xs, ...ys), hi = Math.max(...xs, ...ys), pad = (hi - lo) * 0.05;
  return {
    data: [diagonal(lo - pad, hi + pad), {
      type: "scatter", mode: "markers", x: xs, y: ys,
      marker: { size: 8, color: C.blue, opacity: 0.65, line: { color: "#fff", width: 1 } },
      hovertemplate: "actual %{x:.2f}<br>predicted %{y:.2f} t CO₂e/t<extra></extra>",
    }],
    layout: layout({
      margin: { l: 52, r: 12, t: 8, b: 44 },
      xaxis: axis("Actual (t CO₂e/t)", { range: [lo - pad, hi + pad] }),
      yaxis: axis("Predicted", { range: [lo - pad, hi + pad] }),
    }),
  };
};

export const figResiduals = (pred, resid) => ({
  data: [{
    type: "scatter", mode: "markers", x: pred, y: resid,
    marker: { size: 7, color: C.blue, opacity: 0.6, line: { color: "#fff", width: 1 } },
    hovertemplate: "predicted %{x:.2f}<br>error %{y:.3f}<extra></extra>",
  }],
  layout: layout({
    xaxis: axis("Predicted GWP (t CO₂e/t)"), yaxis: axis("Error = actual − predicted", { zeroline: true, zerolinewidth: 1.5 }),
  }),
});

export const figResidHist = (hist) => {
  const mids = hist.counts.map((_, i) => (hist.edges[i] + hist.edges[i + 1]) / 2);
  return {
    data: [{
      type: "bar", x: mids, y: hist.counts, marker: { color: C.blue },
      hovertemplate: "error ≈ %{x:.2f}<br>%{y} predictions<extra></extra>",
    }],
    layout: layout({ bargap: 0.08, xaxis: axis("Prediction error (t CO₂e/t)"), yaxis: axis("Number of test rows") }),
  };
};

export const figImportance = (imp) => {
  const rows = [...imp].reverse();
  return {
    data: [{
      type: "bar", orientation: "h", x: rows.map((d) => d.permutation), y: rows.map((d) => nice(d.feature)),
      error_x: { type: "data", array: rows.map((d) => d.permutation_std), color: C.ink2, thickness: 1.2, width: 3 },
      marker: { color: C.blue },
      hovertemplate: "%{y}<br>drop in R² when shuffled: %{x:.3f}<extra></extra>",
    }],
    layout: layout({ margin: { l: 150, r: 24, t: 8, b: 44 }, xaxis: axis("Drop in R² when the feature is shuffled", { rangemode: "tozero" }), yaxis: axis() }),
  };
};

export const figLearning = (lc) => {
  const line = (y, name, color) => ({
    type: "scatter", mode: "lines+markers", x: lc.train_sizes, y, name,
    line: { color, width: 2 }, marker: { size: 8, color, line: { color: "#fff", width: 2 } },
    hovertemplate: `${name}: %{y:.4f}<br>%{x} training rows<extra></extra>`,
  });
  return {
    data: [line(lc.train_r2, "Training score", C.orange), line(lc.cv_r2, "Validation score", C.blue)],
    layout: layout({
      showlegend: true, legend: { orientation: "h", y: 1.12, x: 0 }, margin: { l: 56, r: 16, t: 28, b: 48 },
      xaxis: axis("Training rows used"), yaxis: axis("R²"),
    }),
  };
};

export const figPerMetal = (perMetal) => ({
  data: [{
    type: "bar", x: perMetal.map((m) => m.metal), y: perMetal.map((m) => m.mape), marker: { color: C.blue },
    text: perMetal.map((m) => m.mape.toFixed(1) + "%"), textposition: "outside", cliponaxis: false,
    textfont: { color: C.ink2 }, hovertemplate: "%{x}<br>average error %{y:.2f}%<extra></extra>",
  }],
  layout: layout({ margin: { l: 56, r: 16, t: 20, b: 40 }, yaxis: axis("Mean absolute % error", { rangemode: "tozero" }), xaxis: axis() }),
});

// correlation heatmap (diverging: red negative, gray zero, blue positive)
export const figCorr = (corr) => {
  const labels = corr.labels.map(nice);
  return {
    data: [{
      type: "heatmap", z: corr.matrix, x: labels, y: labels, zmin: -1, zmax: 1, colorscale: DIV,
      text: corr.matrix.map((r) => r.map((v) => v.toFixed(2))), texttemplate: "%{text}", textfont: { size: 10 },
      xgap: 2, ygap: 2, colorbar: { thickness: 10, title: { text: "r", side: "right" } },
      hovertemplate: "%{y} vs %{x}<br>r = %{z:.3f}<extra></extra>",
    }],
    layout: layout({
      margin: { l: 130, r: 16, t: 8, b: 110 },
      xaxis: axis(null, { tickangle: -40, gridcolor: "rgba(0,0,0,0)" }),
      yaxis: axis(null, { autorange: "reversed", gridcolor: "rgba(0,0,0,0)" }),
    }),
  };
};

// metal x life-cycle stage CO2 (primary route, 1 tonne, default transport) from the LCA engine
const STAGES = ["Mining", "Refining", "Smelting", "Casting & fabrication", "Transport"];
const stageOf = (s) => (/transport/i.test(s) ? "Transport" : /mining/i.test(s) ? "Mining" : /refin/i.test(s) ? "Refining"
  : /smelt/i.test(s) ? "Smelting" : "Casting & fabrication");

export const stageMatrix = () => {
  const td = { mineToRefinery: 500, refineryToSmelter: 300, smelterToMarket: 200 };
  return METALS.map((m) => {
    const out = Object.fromEntries(STAGES.map((s) => [s, 0]));
    lcaEngine.calculatePrimaryRoute(1000, td, "Truck", m).stages.forEach((s) => { out[stageOf(s.stage)] += s.co2e / 1000; });
    return STAGES.map((s) => out[s]);
  });
};

export const figStageHeat = () => {
  const z = stageMatrix();
  return {
    data: [{
      type: "heatmap", z, x: STAGES, y: METALS, colorscale: SEQ, xgap: 2, ygap: 2,
      text: z.map((r) => r.map((v) => v.toFixed(2))), texttemplate: "%{text}", textfont: { size: 11 },
      colorbar: { thickness: 10, title: { text: "t CO₂e", side: "right" } },
      hovertemplate: "%{y} · %{x}<br>%{z:.2f} t CO₂e per tonne<extra></extra>",
    }],
    layout: layout({ margin: { l: 90, r: 16, t: 8, b: 48 }, xaxis: axis(null, { gridcolor: "rgba(0,0,0,0)" }), yaxis: axis(null, { autorange: "reversed", gridcolor: "rgba(0,0,0,0)" }) }),
  };
};

// published figure vs EcoForge (LCA engine and ML model), one chart per metal so the scales stay readable
export const figValidation = (rows, metal) => {
  const rs = rows.filter((r) => r.metal === metal).reverse();
  const y = rs.map((r) => r.benchmark);
  const dot = (x, name, color, symbol, extra = {}) => ({
    type: "scatter", mode: "markers", name, x, y,
    marker: { size: 12, color, symbol, line: { color: "#fff", width: 2 } },
    hovertemplate: `${name}: %{x:.2f} t CO₂e/t<extra>%{y}</extra>`, ...extra,
  });
  return {
    data: [
      // thin line from published to ML value shows the gap
      ...rs.map((r) => ({ type: "scatter", mode: "lines", x: [r.published_t_co2_per_t, r.ecoforge_ml], y: [r.benchmark, r.benchmark],
        line: { color: C.gray, width: 2 }, hoverinfo: "skip", showlegend: false })),
      dot(rs.map((r) => r.published_t_co2_per_t), "Published (real)", C.ink, "circle"),
      dot(rs.map((r) => r.ecoforge_lca), "EcoForge LCA engine", C.orange, "diamond"),
      dot(rs.map((r) => r.ecoforge_ml), "EcoForge ML model", C.blue, "square"),
    ],
    layout: layout({
      // legend is drawn in HTML above the charts so it never covers the dots on narrow screens
      margin: { l: 190, r: 16, t: 8, b: 44 },
      xaxis: axis("t CO₂e per tonne of " + metal.toLowerCase()), yaxis: axis(),
    }),
  };
};

// ---------- circularity pre-check classifier ----------
const OUTCOME_LABEL = { closed_loop: "Closed loop", downcycled: "Downcycled", lost: "Lost" };
const FEATURE_LABEL = {
  alloy_mix: "Alloy mixing", attachments_pct: "Attached plastic / rubber", oil: "Oil / grease", corrosion: "Corrosion",
  design_for_disassembly: "Design for disassembly", distance_km: "Distance to recycler", lifetime_years: "Product lifetime",
  metal: "Metal", sector: "Product sector", coating: "Coating", collection: "Collection route",
};

// confusion matrix as row shares: of the batches that really ended in X, how many did the model call Y
export const figConfusion = (cm, classes) => {
  const labels = classes.map((c) => OUTCOME_LABEL[c] || c);
  const z = cm.map((row) => { const s = row.reduce((a, b) => a + b, 0) || 1; return row.map((v) => v / s); });
  return {
    data: [{
      type: "heatmap", z, x: labels, y: labels, zmin: 0, zmax: 1, colorscale: SEQ, xgap: 2, ygap: 2,
      text: z.map((r, i) => r.map((v, j) => `${Math.round(v * 100)}% (${cm[i][j]})`)), texttemplate: "%{text}", textfont: { size: 12 },
      colorbar: { thickness: 10, tickformat: ".0%" },
      hovertemplate: "Actual %{y} → predicted %{x}<br>%{text}<extra></extra>",
    }],
    layout: layout({
      margin: { l: 100, r: 16, t: 8, b: 56 },
      xaxis: axis("Predicted outcome", { gridcolor: "rgba(0,0,0,0)" }),
      yaxis: axis("Actual outcome", { autorange: "reversed", gridcolor: "rgba(0,0,0,0)" }),
    }),
  };
};

export const figPrecheckImportance = (imp) => {
  const rows = [...imp].filter((d) => d.importance > 0).reverse();
  return {
    data: [{
      type: "bar", orientation: "h", x: rows.map((d) => d.importance), y: rows.map((d) => FEATURE_LABEL[d.feature] || d.feature),
      marker: { color: C.blue }, hovertemplate: "%{y}<br>log-loss increase when shuffled: %{x:.3f}<extra></extra>",
    }],
    layout: layout({ margin: { l: 170, r: 16, t: 8, b: 44 }, xaxis: axis("How much worse the model gets when this input is shuffled", { rangemode: "tozero" }), yaxis: axis() }),
  };
};

// metal x production route (cited factors): primary, 50/50 hybrid, recycled
export const figRouteHeat = () => {
  const routes = ["Primary", "Hybrid (50%)", "Recycled"];
  const z = METALS.map((m) => {
    const d = lcaEngine.baseData[m];
    return [d.Primary.co2e, (d.Primary.co2e + d.Recycled.co2e) / 2, d.Recycled.co2e];
  });
  return {
    data: [{
      type: "heatmap", z, x: routes, y: METALS, colorscale: SEQ, xgap: 2, ygap: 2,
      text: z.map((r) => r.map((v) => v.toFixed(2))), texttemplate: "%{text}", textfont: { size: 12 },
      colorbar: { thickness: 10, title: { text: "t CO₂e/t", side: "right" } },
      hovertemplate: "%{y} · %{x}<br>%{z:.2f} t CO₂e per tonne<extra></extra>",
    }],
    layout: layout({ margin: { l: 90, r: 16, t: 8, b: 40 }, xaxis: axis(null, { gridcolor: "rgba(0,0,0,0)" }), yaxis: axis(null, { autorange: "reversed", gridcolor: "rgba(0,0,0,0)" }) }),
  };
};

// gap of the ML result vs each published figure, as horizontal bars with the ±10% band shaded
const SHORT = { "Tata Steel Ltd (India plants)": "Tata Steel", "Tata Steel NINL (Odisha)": "Tata NINL",
  "India steel sector average": "India steel avg", "Vedanta Aluminium": "Vedanta", "Hindalco (aluminium)": "Hindalco",
  "IAI global primary aluminium": "IAI global" };
export const figGapBars = (rows) => {
  const r = [...rows].reverse();
  const lim = Math.max(25, ...r.map((x) => Math.abs(x.error_ml_pct) + 6));
  return {
    data: [{
      type: "bar", orientation: "h", x: r.map((x) => x.error_ml_pct), y: r.map((x) => SHORT[x.benchmark] || x.benchmark),
      marker: { color: r.map((x) => (Math.abs(x.error_ml_pct) <= 10 ? C.aqua : C.orange)) },
      text: r.map((x) => `${x.error_ml_pct > 0 ? "+" : ""}${x.error_ml_pct}%`), textposition: "outside", cliponaxis: false,
      textfont: { color: C.ink2, size: 12 },
      customdata: r.map((x) => [x.published_t_co2_per_t, x.ecoforge_ml]),
      hovertemplate: "%{y}<br>Published %{customdata[0]:.2f} · EcoForge %{customdata[1]:.2f} t/t<br>Gap %{x}%<extra></extra>",
    }],
    layout: layout({
      margin: { l: 110, r: 40, t: 26, b: 44 },
      xaxis: axis("Gap vs published figure (%)", { range: [-lim, lim], zeroline: true, ticksuffix: "%" }), yaxis: axis(),
      shapes: [{ type: "rect", xref: "x", yref: "paper", x0: -10, x1: 10, y0: 0, y1: 1, fillcolor: "rgba(27,175,122,0.10)", line: { width: 0 }, layer: "below" }],
      annotations: [{ xref: "x", yref: "paper", x: 0, y: 1.0, yanchor: "bottom", text: "within ±10%", showarrow: false, font: { size: 11, color: C.aqua } }],
    }),
  };
};

// average error (MAE) of each model, lower is better; winner highlighted
export const figModelError = (bench, best) => {
  const rows = [...bench].sort((a, b) => b.mae - a.mae);
  return {
    data: [{
      type: "bar", orientation: "h", x: rows.map((b) => b.mae), y: rows.map((b) => b.model),
      marker: { color: winnerColors(rows, best) }, text: rows.map((b) => `${b.mae.toFixed(2)} t`),
      textposition: "outside", cliponaxis: false, textfont: { color: C.ink2, size: 12 },
      hovertemplate: "%{y}<br>Average error %{x:.3f} t CO₂ per tonne<extra></extra>",
    }],
    layout: layout({ margin: { l: 130, r: 56, t: 8, b: 44 }, xaxis: axis("Average error, t CO₂ per tonne (lower is better)", { rangemode: "tozero" }), yaxis: axis() }),
  };
};
