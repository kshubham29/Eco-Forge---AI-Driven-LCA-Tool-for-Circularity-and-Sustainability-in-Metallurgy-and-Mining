// [12] AI & VALIDATION PAGE (route /ai-validation) - kept simple: 1) is EcoForge close to real published data,
//      2) which ML model predicts CO2 and how good it is, 3) the scrap pre-check model, 4) a one-table list of methods (full detail in the Word file "EcoForge Formulas and Algorithms").
//      Every tab starts with an "In simple words" box; detailed tables and charts are behind "Show more".
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { ScanSearch, Trophy, Download, RotateCw, Loader2, AlertTriangle, ShieldCheck, ExternalLink, ChevronDown, ChevronUp, Sigma, Lightbulb } from "lucide-react";
import { Chart } from "../components/Plot";
import { METALS, figActualPred, figImportance, figConfusion, figPrecheckImportance, figGapBars, figModelError } from "../data/modelLabFigures";
import { downloadPredictionReport } from "../data/modelLabReport";
import { CheckYourself, ModelPlayground, PrecheckTry } from "../components/ValidationTools";

// [12b] METHODS TAB - one row per feature: which algorithm or formula it uses (full detail in the Word file)
const METHODS = [
  ["LCA calculator", "Formula", "CO₂ = mass × emission factor of the route + transport (t × km × mode factor)"],
  ["Hybrid route", "Formula", "Mix = (1 − scrap %) × primary + scrap % × recycled"],
  ["CO₂ prediction", "ML", "SVR (Support Vector Regression), best of 7 models compared"],
  ["Missing data fill", "ML", "Random Forest, learns patterns from the other columns"],
  ["Scrap pre-check", "ML", "Logistic Regression, 3 outcomes: closed loop / downcycled / lost"],
  ["Hotspots", "Formula", "Stage share = stage CO₂ ÷ total CO₂"],
  ["Target planner", "Formula", "CO₂ = (1 − s)·Gp + s·Gr − renewable % × energy × 0.7117 + transport"],
  ["Circularity score (MCI)", "Formula", "MCI = 1 − LFI × 0.9 / X  (Ellen MacArthur Foundation)"],
  ["Recycling credit", "Formula", "Credit = (collected − scrap used) × yield × (Gp − Gr) × mass"],
  ["Check vs real data", "Formula", "Gap % = |EcoForge − published| ÷ published × 100"],
];

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const Big = ({ label, value, sub, active, onClick }) => (
  <button type="button" onClick={onClick}
          className={`ef-lift text-left rounded-xl bg-white border-2 p-5 ${active ? "border-green-500" : "border-gray-200 hover:border-green-300"}`}>
    <p className="text-sm font-medium text-gray-600">{label}</p>
    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
  </button>
);

// one plain-words line at the top of each tab: what is being tested and how to read it
const Simple = ({ children }) => (
  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 flex gap-2">
    <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" /><p>{children}</p>
  </div>
);

const Panel = ({ title, note, children, className = "" }) => (
  <Card className={`bg-white shadow-sm border border-gray-200 ${className}`}>
    <CardHeader className="pb-1"><CardTitle className="text-base text-gray-900">{title}</CardTitle>
      {note && <p className="text-sm text-gray-500">{note}</p>}</CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const More = ({ open, onClick, label = "Show more charts and numbers" }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{open ? "Hide details" : label}
  </button>
);

const gapTone = (e) => (Math.abs(e) <= 10 ? "text-green-700" : "text-amber-700");
const signed = (e) => `${e > 0 ? "+" : ""}${e}%`;
const INPUT_NAMES = {
  recycled_content: "Scrap share", grid_intensity_tco2_mwh: "Grid electricity", ore_grade_factor: "Ore quality", transport_km: "Transport distance",
  metal_Aluminium: "Metal: aluminium", metal_Copper: "Metal: copper", metal_Magnesium: "Metal: magnesium", metal_Steel: "Metal: steel",
};

const ModelLab = () => {
  const [lab, setLab] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [model, setModel] = useState(null);
  const [val, setVal] = useState(null);
  const [pre, setPre] = useState(null);   // circularity pre-check classifier metrics
  const [more, setMore] = useState({ val: false, ml: false, pre: false });
  const [tab, setTab] = useState("validation");   // the question tiles and the tab bar share this
  const toggle = (k) => setMore((m) => ({ ...m, [k]: !m[k] }));

  // busy: null | "refresh";  notice: short message shown under the buttons
  const [notice, setNotice] = useState(null);
  const load = async (quiet = false) => {
    setBusy("refresh"); setError(null); setNotice(null);
    try {
      const r = await fetch(`${BACKEND}/api/model-lab`);
      const d = await r.json();
      if (!d.success) { setError(d.error || "Could not load results"); return; }
      setLab(d); setModel((m) => m || d.best_model);
      // validation and pre-check results come from their own endpoints
      const v = await fetch(`${BACKEND}/api/validation`).then((x) => x.json());
      if (v.success) setVal(v);
      const pc = await fetch(`${BACKEND}/api/circularity-precheck/metrics`).then((x) => x.json());
      if (pc.success) setPre(pc);
      const t = new Date().toLocaleTimeString("en-IN");
      if (!quiet) setNotice(`✓ Results refreshed at ${t}.`);
    } catch (e) {
      setError("Backend not reachable. Start the backend (port 8000), then press Refresh.");
    } finally { setBusy(null); }
  };
  useEffect(() => { load(true); }, []);

  const best = lab?.best_model;
  const win = lab?.benchmark?.[0];
  const pred = lab && model ? lab.predictions[model] : null;
  const preBest = pre?.benchmark?.[0];
  const recall = (cls) => pre?.per_class?.find((c) => c.class === cls)?.recall;

  const pdf = async () => {
    setPdfBusy(true);
    try { await downloadPredictionReport(lab, val); } finally { setPdfBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2"><ShieldCheck className="h-7 w-7 text-green-600" />AI & Validation</h1>
            <p className="text-gray-600 max-w-3xl">Can you trust EcoForge? We tested it 3 ways. Click a question.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => load()} disabled={!!busy} title="Reload the latest results from the backend">
              {busy === "refresh" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}Refresh
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={pdf} disabled={!lab || pdfBusy}>
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Download PDF report
            </Button>
          </div>
        </div>

        {notice && !busy && <div className="p-3 mb-6 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">{notice}</div>}
        {error && <div className="p-4 mb-6 rounded-lg bg-red-50 text-red-700 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5" />{error}</div>}
        {!lab && !error && <div className="flex items-center text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading results...</div>}

        {lab && (
          <>
            {/* the three numbers to remember */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Big label="1. Is it close to real companies?" value={val ? `${val.summary.ml.mean_abs_error_pct}% gap` : "…"}
                   sub={val ? `${val.summary.ml.within_10pct} of ${val.summary.ml.count} companies within 10%` : "loading"}
                   active={tab === "validation"} onClick={() => setTab("validation")} />
              <Big label="2. Which AI model is best?" value={`${best} (R² ${win.r2.toFixed(3)})`}
                   sub="best of 7 models · 1.0 = perfect" active={tab === "ml"} onClick={() => setTab("ml")} />
              <Big label="3. Is the scrap AI useful?" value={preBest ? `${(preBest.accuracy * 100).toFixed(1)}% correct` : "…"}
                   sub={pre?.baselines ? `guessing gives ${(pre.baselines.majority_accuracy * 100).toFixed(1)}%` : ""}
                   active={tab === "precheck"} onClick={() => setTab("precheck")} />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 bg-white border border-gray-200 shadow-sm mb-4 p-1">
                {[["validation", "1. Close to real companies?", ShieldCheck], ["ml", "2. Best AI model", Trophy],
                  ["precheck", "3. Scrap AI", ScanSearch], ["methods", "4. Methods", Sigma]].map(([v, l, Icon]) => (
                  <TabsTrigger key={v} value={v} className="gap-1.5 data-[state=active]:bg-green-600 data-[state=active]:text-white"><Icon className="h-4 w-4" />{l}</TabsTrigger>
                ))}
              </TabsList>

              {/* ================= 1. check vs real data ================= */}
              <TabsContent value="validation" className="space-y-6">
                {!val && <div className="flex items-center text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</div>}
                {val && (
                  <>
                    <Simple>Companies like Tata Steel and Hindalco publish how much CO₂ they make per tonne. We ask EcoForge the
                      same question and compare. <b>Gap</b> = how far EcoForge is from the real number. Under 10% (green) is good.</Simple>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Panel title="All 6 published figures" note={`Average gap ${val.summary.ml.mean_abs_error_pct}% · ${val.summary.ml.within_10pct} of ${val.summary.ml.count} within 10%`}>
                      <table className="w-full text-sm tabular-nums">
                        <thead><tr className="text-left text-gray-500 border-b">
                          {["Company / source", "Published", "EcoForge ML", "Gap"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
                        </tr></thead>
                        <tbody>{val.rows.map((r) => (
                          <tr key={r.benchmark} className="border-b last:border-0">
                            <td className="py-2 pr-4 text-gray-900">{r.benchmark}</td>
                            <td className="py-2 pr-4">{r.published_t_co2_per_t.toFixed(2)}</td>
                            <td className="py-2 pr-4">{r.ecoforge_ml.toFixed(2)}</td>
                            <td className={`py-2 pr-4 font-medium ${gapTone(r.error_ml_pct)}`}>{signed(r.error_ml_pct)}</td>
                          </tr>))}</tbody>
                      </table>
                      <p className="text-xs text-gray-500 mt-2">t CO₂ per tonne</p>
                    </Panel>
                    <Panel title="Gap for each company" note="Green = within 10%">
                      <Chart fig={figGapBars(val.rows)} height={290} />
                    </Panel>
                    </div>

                    <CheckYourself rows={val.rows} />

                    <Panel title="Why some gaps are bigger">
                      <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                        <li><b>Steel:</b> Indian plants use more coal-based iron.</li>
                        <li><b>Hindalco:</b> runs on its own coal power. With captive coal: <b>{val.what_if.ecoforge_ml.toFixed(2)}</b>, gap <b>{Math.abs(val.what_if.error_pct)}%</b>.</li>
                        <li><b>IAI:</b> same publisher as our aluminium factor.</li>
                      </ul>
                    </Panel>

                    <More open={more.val} onClick={() => toggle("val")} label="Show full table (period, calculator result, boundaries, sources)" />
                    {more.val && (
                      <Panel title="Full comparison" note={`Primary route, CEA grid ${val.inputs.grid_intensity_tco2_mwh} t CO₂/MWh, ore factor ${val.inputs.ore_grade_factor}, ${val.inputs.transport_km} km truck.`}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm tabular-nums">
                            <thead><tr className="text-left text-gray-500 border-b">
                              {["Benchmark", "Period", "Published", "Calculator", "ML", "Source"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
                            </tr></thead>
                            <tbody>{val.rows.map((r) => (
                              <tr key={r.benchmark} className="border-b last:border-0 align-top">
                                <td className="py-2 pr-4 text-gray-900 min-w-[16rem]">{r.benchmark}
                                  <div className="text-xs text-gray-500">{r.product}{r.unit ? ` · ${r.unit}` : ""}</div>
                                  {r.emissions_boundary && <div className="text-xs text-gray-500"><b className="font-medium">Boundary:</b> {r.emissions_boundary}</div>}
                                  {r.comparability && <div className="text-xs text-gray-500"><b className="font-medium">vs EcoForge:</b> {r.comparability}</div>}
                                </td>
                                <td className="py-2 pr-4 whitespace-nowrap">{r.period}</td>
                                <td className="py-2 pr-4 font-medium">{r.published_t_co2_per_t.toFixed(2)}</td>
                                <td className="py-2 pr-4 whitespace-nowrap">{r.ecoforge_lca.toFixed(2)} <span className={gapTone(r.error_lca_pct)}>({signed(r.error_lca_pct)})</span></td>
                                <td className="py-2 pr-4 whitespace-nowrap">{r.ecoforge_ml.toFixed(2)} <span className={gapTone(r.error_ml_pct)}>({signed(r.error_ml_pct)})</span></td>
                                <td className="py-2 pr-4 text-xs"><a href={r.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline inline-flex items-start gap-1">{r.source}<ExternalLink className="h-3 w-3 mt-0.5 shrink-0" /></a></td>
                              </tr>))}</tbody>
                          </table>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Calculator average gap: {val.summary.lca.mean_abs_error_pct}%. ML average gap: {val.summary.ml.mean_abs_error_pct}%.</p>
                      </Panel>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ================= 2. CO2 prediction model ================= */}
              <TabsContent value="ml" className="space-y-6">
                <Simple>We trained <b>7 different AI models</b> to predict CO₂ per tonne, then tested each on examples it had never
                  seen. <b>SVR</b> made the smallest error, so the app uses it. <b>R²</b> 1.0 = perfect; <b>error</b> = how many tonnes it is off.</Simple>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Panel title="The 7 models" note="1.0 = perfect · error in t CO₂ per tonne">
                    <table className="w-full text-sm tabular-nums">
                      <thead><tr className="text-left text-gray-500 border-b">{["#", "Model", "Score (R²)", "Error"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
                      <tbody>{lab.benchmark.map((b) => (
                        <tr key={b.model} className={`border-b last:border-0 ${b.model === best ? "bg-blue-50 font-medium" : ""}`}>
                          <td className="py-2 pr-4">{b.rank}</td>
                          <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">{b.model}
                            {b.model === best && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white">Winner</span>}</td>
                          <td className="py-2 pr-4">{b.cv_r2_mean.toFixed(3)}</td>
                          <td className="py-2 pr-4">{b.mae.toFixed(2)} t</td>
                        </tr>))}</tbody>
                    </table>
                  </Panel>
                  <Panel title="Average error of each model" note="Lower is better">
                    <Chart fig={figModelError(lab.benchmark, best)} height={290} />
                  </Panel>
                </div>


                <ModelPlayground />

                <More open={more.ml} onClick={() => toggle("ml")} />
                {more.ml && (
                  <div className="space-y-6">
                    <Panel title="Full benchmark table" note="Ranked by cross-validation score on the training rows; test columns measured once afterwards.">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm tabular-nums">
                          <thead><tr className="text-left text-gray-500 border-b">
                            {["Model", "CV R²", "Test R²", "MAE", "RMSE", "MAPE", "Train − test R²", "Train time"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
                          </tr></thead>
                          <tbody>{lab.benchmark.map((b) => (
                            <tr key={b.model} className={`border-b last:border-0 ${b.model === best ? "bg-blue-50" : ""}`}>
                              <td className="py-2 pr-4 whitespace-nowrap">{b.model}</td>
                              <td className="py-2 pr-4">{b.cv_r2_mean.toFixed(4)} ± {b.cv_r2_std.toFixed(4)}</td>
                              <td className="py-2 pr-4">{b.r2.toFixed(4)}</td><td className="py-2 pr-4">{b.mae.toFixed(3)}</td>
                              <td className="py-2 pr-4">{b.rmse.toFixed(3)}</td><td className="py-2 pr-4">{b.mape.toFixed(1)}%</td>
                              <td className="py-2 pr-4">{b.overfit_gap.toFixed(4)}</td><td className="py-2 pr-4">{Math.round(b.train_ms)} ms</td>
                            </tr>))}</tbody>
                        </table>
                      </div>
                    </Panel>
                    {lab.baselines && (
                      <Panel title="Compared with the formula itself" note="Same 320 test rows">
                        <table className="w-full text-sm tabular-nums">
                          <thead><tr className="text-left text-gray-500 border-b">{["Method", "R²", "RMSE", "MAPE"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
                          <tbody>{lab.baselines.map((b) => (
                            <tr key={b.name} className="border-b last:border-0"><td className="py-2 pr-4">{b.name}</td><td className="pr-4">{b.r2.toFixed(4)}</td>
                              <td className="pr-4">{b.rmse.toFixed(3)}</td><td className="pr-4">{b.mape.toFixed(1)}%</td></tr>))}</tbody>
                        </table>
                      </Panel>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-gray-600">Show predictions of:</span>
                      {lab.benchmark.map((b) => (
                        <button key={b.model} onClick={() => setModel(b.model)}
                                className={`px-3 py-1 rounded-full border text-sm ${model === b.model ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                          {b.model}{b.model === best ? " (winner)" : ""}
                        </button>
                      ))}
                    </div>
                    <Panel title="Real vs predicted, by metal" note="Each dot is one test scenario. On the dashed line = perfect.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {METALS.map((m) => (
                          <div key={m}><p className="text-sm font-medium text-gray-700 mb-1">{m}</p>
                            <Chart fig={figActualPred(lab.test_actual, pred, lab.test_metal, m)} height={240} /></div>
                        ))}
                      </div>
                    </Panel>
                    <Panel title="Which input matters most (winner)" note={`Most important: ${INPUT_NAMES[lab.analysis.feature_importance[0].feature] || lab.analysis.feature_importance[0].feature}`}>
                      <Chart fig={figImportance(lab.analysis.feature_importance)} height={300} /></Panel>
                  </div>
                )}
              </TabsContent>

              {/* ================= 3. pre-check model ================= */}
              <TabsContent value="precheck" className="space-y-6">
                {!pre && <div className="flex items-center text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</div>}
                {pre && preBest && (
                  <>
                    <Simple>This AI guesses what happens to a scrap batch: <b>same grade</b>, <b>lower grade</b> or <b>lost</b>.
                      Always guessing "lost" is right {((pre.baselines?.majority_accuracy || 0) * 100).toFixed(1)}% of the time; our model is
                      right {(preBest.accuracy * 100).toFixed(1)}%, and it also gives a fix plan.</Simple>

                    <PrecheckTry />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Panel title="How good is it?">
                        <table className="w-full text-sm tabular-nums">
                          <tbody>
                            <tr className="border-b bg-blue-50 font-medium"><td className="py-2 pr-4">Our model ({pre.best_model})</td><td>{(preBest.accuracy * 100).toFixed(1)}% correct</td></tr>
                            <tr className="border-b"><td className="py-2 pr-4">Always guess "lost"</td><td>{(pre.baselines.majority_accuracy * 100).toFixed(1)}%</td></tr>
                            <tr><td className="py-2 pr-4">Best possible (the rule that made the data)</td><td>{(pre.accuracy_ceiling * 100).toFixed(1)}%</td></tr>
                          </tbody>
                        </table>
                      </Panel>
                      <Panel title="What it catches well and badly">
                        <div className="space-y-3">
                          {[["lost", "Lost batches"], ["closed_loop", "Closed-loop batches"], ["downcycled", "Downcycled batches"]].map(([k, l]) => {
                            const r = recall(k) || 0;
                            return (
                              <div key={k}>
                                <div className="flex justify-between text-sm"><span>{l}</span><b className={r < 0.5 ? "text-amber-700" : "text-green-700"}>{Math.round(r * 100)}%</b></div>
                                <div className="h-2 bg-gray-100 rounded-full mt-1"><div className={`h-2 rounded-full ${r < 0.5 ? "bg-amber-500" : "bg-green-600"}`} style={{ width: `${r * 100}%` }} /></div>
                              </div>
                            );
                          })}
                        </div>
                      </Panel>
                    </div>

                    <More open={more.pre} onClick={() => toggle("pre")} />
                    {more.pre && (
                      <div className="space-y-6">
                        <Panel title="4 classifiers compared" note="Ranked by cross-validated log loss (lower = better chances).">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm tabular-nums">
                              <thead><tr className="text-left text-gray-500 border-b">{["Model", "CV log loss", "Test log loss", "Accuracy", "Macro F1"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
                              <tbody>{pre.benchmark.map((b) => (
                                <tr key={b.model} className={`border-b last:border-0 ${b.model === pre.best_model ? "bg-blue-50" : ""}`}>
                                  <td className="py-2 pr-4">{b.model}</td><td className="pr-4">{b.cv_log_loss != null ? b.cv_log_loss.toFixed(3) : "–"}</td>
                                  <td className="pr-4">{b.log_loss.toFixed(3)}</td><td className="pr-4">{(b.accuracy * 100).toFixed(1)}%</td><td>{b.macro_f1.toFixed(3)}</td>
                                </tr>))}</tbody>
                            </table>
                          </div>
                        </Panel>
                        {pre.per_class && (
                          <Panel title="Per-outcome results">
                            <table className="w-full text-sm tabular-nums">
                              <thead><tr className="text-left text-gray-500 border-b">{["Outcome", "Precision", "Recall", "F1", "Cases"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
                              <tbody>{pre.per_class.map((c) => (
                                <tr key={c.class} className="border-b last:border-0"><td className="py-2 pr-4">{c.class.replace("_", " ")}</td>
                                  <td className="pr-4">{(c.precision * 100).toFixed(1)}%</td><td className="pr-4">{(c.recall * 100).toFixed(1)}%</td>
                                  <td className="pr-4">{c.f1.toFixed(3)}</td><td>{c.support}</td></tr>))}</tbody>
                            </table>
                          </Panel>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <Panel title="Confusion matrix" note="Rows = what really happened, columns = what it predicted."><Chart fig={figConfusion(pre.confusion_matrix, pre.classes)} height={300} /></Panel>
                          <Panel title="What drives the prediction" note="Most important inputs."><Chart fig={figPrecheckImportance(pre.importance)} height={300} /></Panel>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ================= 4. methods ================= */}
              <TabsContent value="methods" className="space-y-6">
                <Simple>Which part of EcoForge uses <b>AI (ML)</b> and which uses a fixed <b>formula</b>.</Simple>
                <Panel title="Algorithms and formulas used" note="Gp = CO₂ of primary metal, Gr = CO₂ of recycled metal, s = scrap share">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-gray-500 border-b">
                        {["Feature", "Type", "Method"].map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
                      </tr></thead>
                      <tbody>{METHODS.map(([f, t, m]) => (
                        <tr key={f} className="border-b last:border-0">
                          <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">{f}</td>
                          <td className="py-2.5 pr-4"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t === "ML" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>{t}</span></td>
                          <td className="py-2.5 pr-4 text-gray-700">{m}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </Panel>
              </TabsContent>

            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelLab;
