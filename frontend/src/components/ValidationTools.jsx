// VALIDATION TOOLS (AI & Validation page) - three things a user can try live:
//   CheckYourself   - compare EcoForge's ML prediction with any published figure (6 benchmarks or your own plant)
//   ModelPlayground - move the inputs and compare the ML model with the formula that generated its data
//   PrecheckTry     - run the circularity pre-check model on example scrap batches
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Loader2, CheckCircle2, AlertTriangle, FlaskConical, Play, ScanSearch } from "lucide-react";
import { lcaEngine, CEA_GRID_FACTOR_TCO2_PER_MWH } from "../data/lcaEngine";
import { PRESETS, pctHalf } from "./CircularityPrecheck";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const METALS = ["Aluminium", "Copper", "Magnesium", "Steel"];
const GRID = [0.43, 0.925];         // model training range (0.6x to 1.3x the CEA value 0.7117)
const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

// live call to the deployed CO2 model, debounced while sliders move
function usePrediction(body) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const key = JSON.stringify(body);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true); setError(null);
      try {
        const d = await fetch(`${BACKEND}/api/predict-gwp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: key }).then((r) => r.json());
        if (d.success) setRes(d); else setError(d.error || "Prediction failed");
      } catch { setError("Backend not reachable. Start it (port 8000)."); }
      finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [key]);
  return { res, busy, error };
}

const Range = ({ label, value, min, max, step, onChange, fmt, ends }) => (
  <label className="block text-sm text-gray-800">
    <span className="flex justify-between"><span>{label}</span><b className="tabular-nums">{fmt(value)}</b></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-green-600" />
    {ends && <span className="flex justify-between text-xs text-gray-500"><span>{ends[0]}</span><span>{ends[1]}</span></span>}
  </label>
);

// ------------------------------------------------------------------ 1. check against a published figure
export const CheckYourself = ({ rows = [] }) => {
  const [pick, setPick] = useState("0");
  const [metal, setMetal] = useState(rows[0]?.metal || "Steel");
  const [published, setPublished] = useState(rows[0]?.published_t_co2_per_t ?? 2.46);
  const [grid, setGrid] = useState(CEA_GRID_FACTOR_TCO2_PER_MWH);
  const [scrap, setScrap] = useState(0);
  const choose = (v) => {
    setPick(v);
    if (v !== "own") { const r = rows[Number(v)]; setMetal(r.metal); setPublished(r.published_t_co2_per_t); setGrid(CEA_GRID_FACTOR_TCO2_PER_MWH); setScrap(0); }
  };
  const { res, busy, error } = usePrediction({ metal, recycled_content: scrap / 100, grid_intensity_tco2_mwh: grid, ore_grade_factor: 1, transport_km: 200 });
  const pred = res?.predicted_gwp_t_co2e_per_tonne;
  const gap = pred && published > 0 ? ((pred - published) / published) * 100 : null;

  return (
    <Card className="bg-white shadow-sm border border-green-300">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Play className="h-4 w-4 text-green-600" />Check it yourself</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="block text-sm text-gray-700">Compare with
            <select className={inputCls} value={pick} onChange={(e) => choose(e.target.value)}>
              {rows.map((r, i) => <option key={r.benchmark} value={String(i)}>{r.benchmark} ({r.period})</option>)}
              <option value="own">My own plant (enter its figure)</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-gray-700">Metal
              <select className={inputCls} value={metal} disabled={pick !== "own"} onChange={(e) => setMetal(e.target.value)}>{METALS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            <label className="block text-sm text-gray-700">Published CO₂ (t per t)
              <input type="number" step="0.01" min="0" className={inputCls} value={published} disabled={pick !== "own"} onChange={(e) => setPublished(Number(e.target.value) || 0)} />
            </label>
          </div>
          <Range label="Power used by the plant" value={grid} min={GRID[0]} max={GRID[1]} step={0.01} onChange={setGrid}
                 fmt={(v) => `${Math.round(v * 1000) % 10 ? v.toFixed(3) : v.toFixed(2)} t CO₂/MWh`} ends={["cleaner", "coal-heavy (captive)"]} />
          <div className="flex gap-2 text-xs">
            <button onClick={() => setGrid(CEA_GRID_FACTOR_TCO2_PER_MWH)} className="px-2.5 py-1 rounded-full border border-gray-300 hover:bg-gray-50">India grid 0.71</button>
            <button onClick={() => setGrid(GRID[1])} className="px-2.5 py-1 rounded-full border border-gray-300 hover:bg-gray-50">Captive coal 0.925</button>
          </div>
          <Range label="Scrap share" value={scrap} min={0} max={100} step={5} onChange={setScrap} fmt={(v) => `${v}%`} />
        </div>

        <div className="rounded-xl bg-gray-50 p-4 flex flex-col justify-center">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!error && !res && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Predicting…</p>}
          {!error && res && (
            <>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div><p className="text-xs text-gray-500">Published</p><p className="text-3xl font-bold text-gray-900 tabular-nums">{Number(published).toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-500 flex items-center justify-center gap-1">EcoForge ML {busy && <Loader2 className="h-3 w-3 animate-spin" />}</p>
                  <p className="text-3xl font-bold text-purple-700 tabular-nums">{pred.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">range {res.range_95[0]} – {res.range_95[1]}</p></div>
              </div>
              {gap != null && (
                <div className={`mt-4 rounded-lg p-3 text-sm flex items-start gap-2 ${Math.abs(gap) <= 10 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                  {Math.abs(gap) <= 10 ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertTriangle className="h-4 w-4 mt-0.5" />}
                  <span>Gap <b>{gap > 0 ? "+" : ""}{gap.toFixed(1)}%</b> · {Math.abs(gap) <= 10 ? "within 10%" : "more than 10%"}
                    {Math.abs(gap) > 10 && grid < 0.8 && metal === "Aluminium" ? " · try Captive coal" : ""}</span>
                </div>
              )}
              {res.warnings?.length > 0 && <p className="text-xs text-amber-700 mt-2">⚠ {res.warnings.join(" ")}</p>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ------------------------------------------------------------------ 2. ML model vs the formula
const formula = (metal, r, g, o, d) => {
  const b = lcaEngine.baseData[metal];
  return ((1 - r) * b.Primary.co2e + r * b.Recycled.co2e) * (0.75 * g / CEA_GRID_FACTOR_TCO2_PER_MWH + 0.25 * o) + 0.062 * d / 1000;
};

export const ModelPlayground = () => {
  const [metal, setMetal] = useState("Aluminium");
  const [scrap, setScrap] = useState(0);
  const [grid, setGrid] = useState(CEA_GRID_FACTOR_TCO2_PER_MWH);
  const [ore, setOre] = useState(1);
  const [km, setKm] = useState(500);
  const { res, busy, error } = usePrediction({ metal, recycled_content: scrap / 100, grid_intensity_tco2_mwh: grid, ore_grade_factor: ore, transport_km: km });
  const f = formula(metal, scrap / 100, grid, ore, km);
  const pred = res?.predicted_gwp_t_co2e_per_tonne;
  const diff = pred != null ? ((pred - f) / f) * 100 : null;

  return (
    <Card className="bg-white shadow-sm border border-green-300">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FlaskConical className="h-4 w-4 text-green-600" />Try the model</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {METALS.map((m) => (
              <button key={m} onClick={() => setMetal(m)}
                      className={`px-3 py-1.5 rounded-full border text-sm ${metal === m ? "bg-green-600 text-white border-green-600" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{m}</button>
            ))}
          </div>
          <Range label="Scrap share" value={scrap} min={0} max={100} step={5} onChange={setScrap} fmt={(v) => `${v}%`} />
          <Range label="Grid electricity" value={grid} min={GRID[0]} max={GRID[1]} step={0.01} onChange={setGrid} fmt={(v) => `${v.toFixed(2)} t CO₂/MWh`} ends={["cleaner", "more coal"]} />
          <Range label="Ore quality factor" value={ore} min={0.7} max={1.3} step={0.05} onChange={setOre} fmt={(v) => v.toFixed(2)} ends={["richer ore", "poorer ore"]} />
          <Range label="Transport distance" value={km} min={100} max={2000} step={50} onChange={setKm} fmt={(v) => `${v} km`} />
        </div>
        <div className="rounded-xl bg-gray-50 p-4 flex flex-col justify-center">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!error && !res && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Predicting…</p>}
          {!error && res && (
            <>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div><p className="text-xs text-gray-500 flex items-center justify-center gap-1">ML model (SVR) {busy && <Loader2 className="h-3 w-3 animate-spin" />}</p>
                  <p className="text-3xl font-bold text-purple-700 tabular-nums">{pred.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">range {res.range_95[0]} – {res.range_95[1]}</p></div>
                <div><p className="text-xs text-gray-500">Formula (made the training data)</p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">{f.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">t CO₂e per tonne</p></div>
              </div>
              <div className={`mt-4 rounded-lg p-3 text-sm ${Math.abs(diff) <= 5 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                ML vs formula: <b>{diff > 0 ? "+" : ""}{diff.toFixed(1)}%</b>
              </div>
              {res.warnings?.length > 0 && <p className="text-xs text-amber-700 mt-2">⚠ {res.warnings.join(" ")}</p>}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ------------------------------------------------------------------ 3. pre-check on example batches
export const PrecheckTry = () => {
  const names = Object.keys(PRESETS);
  const [name, setName] = useState("Painted car aluminium");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    (async () => {
      setBusy(true); setError(null);
      try {
        const d = await fetch(`${BACKEND}/api/circularity-precheck`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(PRESETS[name]) }).then((r) => r.json());
        if (d.success) setRes(d); else setError(d.error);
      } catch { setError("Backend not reachable. Start it (port 8000)."); }
      finally { setBusy(false); }
    })();
  }, [name]);
  const p = res?.probabilities;
  const OUT = [["closed_loop", "Same grade (closed loop)", "#1baf7a"], ["downcycled", "Lower grade (downcycled)", "#e09a00"], ["lost", "Lost", "#e04f4f"]];

  return (
    <Card className="bg-white shadow-sm border border-green-300">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ScanSearch className="h-4 w-4 text-green-600" />Try it</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {names.map((n) => (
            <button key={n} onClick={() => setName(n)}
                    className={`px-3 py-1.5 rounded-full border text-sm ${name === n ? "bg-green-600 text-white border-green-600" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{n}</button>
          ))}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {!error && p && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-2.5">
              {OUT.map(([k, l, c]) => (
                <div key={k}>
                  <div className="flex justify-between text-sm"><span>{l}</span><b className="tabular-nums">{pctHalf(p[k])}%</b></div>
                  <div className="h-2.5 bg-gray-100 rounded-full mt-1"><div className="h-2.5 rounded-full transition-all" style={{ width: `${p[k] * 100}%`, background: c }} /></div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
              <p className="font-semibold flex items-center gap-2">{res.verdict} {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}</p>
              {res.plan?.length > 0
                ? <p className="mt-1">Fix plan ({res.plan.length} steps): <b>{pctHalf(p.closed_loop)}%</b> → <b>{pctHalf(res.after_fixes.closed_loop)}%</b></p>
                : <p className="mt-1">No quick fixes left: this batch is already handled the best way.</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
