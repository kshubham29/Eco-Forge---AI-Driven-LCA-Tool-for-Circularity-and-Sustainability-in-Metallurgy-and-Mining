// [16] PREDICTION ANALYSIS REPORT - builds the downloadable PDF (benchmark, accuracy, errors, feature importance).
import { jsPDF } from "jspdf";
import { Plotly } from "../components/Plot";
import { PROBLEM_STATEMENT } from "./project";
import { figCv, figRmse, figActualPred, figResiduals, figResidHist, figImportance, figLearning, figPerMetal, figValidation, nice } from "./modelLabFigures";

const W = 210, M = 16;

const chartImage = async (fig, w = 900, h = 420) =>
  Plotly.toImage({ data: fig.data, layout: { ...fig.layout, width: w, height: h, paper_bgcolor: "#ffffff" } },
                 { format: "jpeg", width: w, height: h, scale: 2 });   // JPEG keeps the PDF small

export async function downloadPredictionReport(lab, val) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const a = lab.analysis, best = lab.best_model, win = lab.benchmark[0];
  let y = M;

  const heading = (t) => { if (y > 255) { doc.addPage(); y = M; } doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(20); doc.text(t, M, y); y += 7; };
  const para = (t) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(60);
    const lines = doc.splitTextToSize(t, W - 2 * M);
    if (y + lines.length * 5 > 285) { doc.addPage(); y = M; }
    doc.text(lines, M, y); y += lines.length * 5 + 2;
  };
  const table = (cols, rows, widths) => {
    doc.setFontSize(9);
    const row = (cells, bold) => {
      if (y > 280) { doc.addPage(); y = M; }
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(bold ? 20 : 60);
      let x = M; cells.forEach((c, i) => { doc.text(String(c), x, y); x += widths[i]; });
      y += 5.5;
    };
    row(cols, true); doc.setDrawColor(200); doc.line(M, y - 4, W - M, y - 4);
    rows.forEach((r) => row(r)); y += 3;
  };
  const image = async (fig, h = 80) => {
    if (y + h > 285) { doc.addPage(); y = M; }
    const px = Math.round((900 * h) / (W - 2 * M));   // same aspect ratio as the space on the page
    doc.addImage(await chartImage(fig, 900, px), "JPEG", M, y, W - 2 * M, h); y += h + 4;
  };

  // ---- title ----
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20);
  doc.text("EcoForge - Prediction Analysis Report", M, y); y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90);
  const ps = doc.splitTextToSize(PROBLEM_STATEMENT, W - 2 * M);
  doc.text(ps, M, y); y += ps.length * 4.5 + 1;
  doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, M, y); y += 5;
  doc.text(`Model run: ${lab.generated_at}`, M, y); y += 9;

  heading("1. Summary");
  para(`Seven machine-learning algorithms were compared on ${lab.dataset.rows} GENERATED production scenarios (built from cited factors, not plant measurements). ` +
       `${lab.protocol || ""} ` +
       `${best} was selected (CV R² = ${win.cv_r2_mean.toFixed(4)} on the training rows) and, on the held-out rows, reached R² = ${win.r2.toFixed(4)} on generated scenarios ` +
       `(test RMSE = ${win.rmse.toFixed(3)} t CO2e per tonne); ${a.within_10pct}% of its test predictions are within ±10% of the generated value. ` +
       (lab.baselines ? `For comparison, the generating equation itself scores R² = ${lab.baselines[0].r2.toFixed(4)} and the plain calculator R² = ${lab.baselines[lab.baselines.length - 1].r2.toFixed(4)}. ` : "") +
       (lab.interval_coverage ? `The approximate 95% range covered ${lab.interval_coverage.overall_pct}% of held-out generated cases; it has not been verified on real plants.` : ""));

  heading("2. Dataset");
  para(`Target: cradle-to-gate GWP (t CO2e per tonne of metal). Inputs: ${lab.dataset.features.map(nice).join(", ")}. ` +
       `Rows per metal: ${Object.entries(lab.dataset.per_metal).map(([k, v]) => `${k} ${v}`).join(", ")}. ` +
       `Split: ${lab.dataset.split}; validation: ${lab.dataset.cv}. The data is a parametric dataset built from cited LCA factors (IAI, worldsteel, ICA) and the CEA India grid factor 0.7117 t CO2/MWh.`);

  heading("3. Model benchmark");
  table(["#", "Model", "Test R²", "MAE", "RMSE", "MAPE", "CV R² train rows", "Train ms"],
        lab.benchmark.map((b) => [b.rank, b.model, b.r2.toFixed(4), b.mae.toFixed(3), b.rmse.toFixed(3), b.mape.toFixed(1) + "%",
                                   `${b.cv_r2_mean.toFixed(4)} ± ${b.cv_r2_std.toFixed(4)}`, Math.round(b.train_ms)]),
        [8, 38, 20, 16, 16, 18, 40, 20]);
  await image(figCv(lab.benchmark, best), 70);
  await image(figRmse(lab.benchmark, best), 70);

  heading(`4. Prediction analysis - ${best}`);
  para(`Actual vs predicted: points close to the dashed line mean accurate predictions. Mean error = ${a.residual_mean.toFixed(3)}, ` +
       `standard deviation = ${a.residual_std.toFixed(3)}, largest error = ${a.max_abs_error} t CO2e per tonne.`);
  await image(figActualPred(lab.test_actual, lab.predictions[best], lab.test_metal, null), 85);
  await image(figResiduals(lab.predictions[best], a.residuals), 70);
  await image(figResidHist(a.residual_hist), 65);

  heading("5. Error by metal");
  table(["Metal", "Test rows", "R²", "MAE", "RMSE", "MAPE", "Mean GWP"],
        a.per_metal.map((m) => [m.metal, m.n, m.r2.toFixed(4), m.mae.toFixed(3), m.rmse.toFixed(3), m.mape.toFixed(2) + "%", m.mean_actual]),
        [30, 22, 22, 22, 22, 22, 30]);
  await image(figPerMetal(a.per_metal), 60);

  heading("6. Feature importance (permutation)");
  para("Each input is shuffled in turn; the bigger the drop in accuracy, the more the model depends on that input.");
  await image(figImportance(a.feature_importance), 75);

  heading("7. Learning curve");
  para("Training and validation scores meet at a high value, so the model is not overfitting and more data would add little.");
  await image(figLearning(a.learning_curve), 70);

  if (val) {
    heading("8. Validation against published data");
    para(`EcoForge was run with its default India inputs (primary route, CEA grid ${val.inputs.grid_intensity_tco2_mwh} t CO2/MWh, ` +
         `${val.inputs.transport_km} km truck) and compared with figures published by companies, the Ministry of Steel and the IAI. Nothing was tuned. ` +
         `The ML model's average error is ${val.summary.ml.mean_abs_error_pct}% (${val.summary.ml.within_10pct} of ${val.summary.ml.count} within ±10%); ` +
         `the LCA engine's is ${val.summary.lca.mean_abs_error_pct}%.`);
    const pct = (e) => `${e > 0 ? "+" : ""}${e}%`;
    table(["Benchmark", "Period", "Published", "EcoForge LCA", "EcoForge ML"],
          val.rows.map((r) => [r.benchmark, r.period, r.published_t_co2_per_t.toFixed(2),
                               `${r.ecoforge_lca.toFixed(2)} (${pct(r.error_lca_pct)})`, `${r.ecoforge_ml.toFixed(2)} (${pct(r.error_ml_pct)})`]),
          [58, 30, 22, 34, 34]);
    await image(figValidation(val.rows, "Steel"), 55);
    await image(figValidation(val.rows, "Aluminium"), 55);
    para(`What if: ${val.what_if.benchmark} with ${val.what_if.input_changed} gives ${val.what_if.ecoforge_ml.toFixed(2)} ` +
         `(${pct(val.what_if.error_pct)}), so most of that gap comes from the power source.`);
    para(val.notes.join(" "));
    para("Sources: " + val.rows.map((r) => `${r.benchmark}: ${r.source}`).join("; ") + ".");
  }

  heading(val ? "9. Conclusion" : "8. Conclusion");
  para(`${best} is the most accurate and stable of the seven algorithms on this dataset and is used for live prediction. ` +
       "Linear Regression performs worst because CO2 depends on its inputs in a multiplied (non-linear) way. Tree models are accurate but give step-like outputs, " +
       "while smooth models such as SVR (RBF kernel) follow the continuous relation closely. Limitation: the dataset is parametric (built from cited factors), so results should be re-validated on measured plant data when available.");

  doc.save("EcoForge_Prediction_Analysis_Report.pdf");
}
