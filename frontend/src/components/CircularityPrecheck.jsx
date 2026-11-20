// [37] CIRCULARITY PRE-CHECK - describe a scrap batch or end-of-life product BEFORE processing; the ML classifier
//      (/api/circularity-precheck) predicts closed loop / downcycled / lost, the barriers, and a step-by-step fix plan.
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { ScanSearch, Loader2, AlertTriangle, RotateCcw, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const OUT = [
  { key: "closed_loop", label: "Closed loop (same grade)", color: "#1baf7a" },
  { key: "downcycled", label: "Downcycled (lower grade)", color: "#eda100" },
  { key: "lost", label: "Lost (landfill / burnt)", color: "#e34948" },
];
const SECTORS = ["Construction", "Automotive", "Machinery & equipment", "Electrical & electronics", "Packaging", "Consumer goods"];
const COATINGS = ["none", "paint", "galvanised / plated", "plastic laminate"];
const COLLECTIONS = ["organised recycler", "informal scrap dealer", "mixed municipal waste"];

// chance as a percent rounded to the nearest 0.5 (matches the fix plan: 42.54% -> 42.5, 5.11% -> 5)
export const pctHalf = (x) => String(Math.round(x * 200) / 2);

export const PRESETS = {
  "Factory copper offcuts": { metal: "Copper", sector: "Machinery & equipment", alloy_mix: 0, coating: "none", attachments_pct: 0, oil: 0, corrosion: 0, collection: "organised recycler", design_for_disassembly: 0, distance_km: 50, lifetime_years: 2 },
  "Construction steel beams": { metal: "Steel", sector: "Construction", alloy_mix: 0, coating: "none", attachments_pct: 0, oil: 0, corrosion: 1, collection: "organised recycler", design_for_disassembly: 0, distance_km: 200, lifetime_years: 40 },
  "Painted car aluminium": { metal: "Aluminium", sector: "Automotive", alloy_mix: 2, coating: "paint", attachments_pct: 10, oil: 1, corrosion: 1, collection: "informal scrap dealer", design_for_disassembly: 0, distance_km: 400, lifetime_years: 15 },
  "E-waste copper in mixed waste": { metal: "Copper", sector: "Electrical & electronics", alloy_mix: 1, coating: "plastic laminate", attachments_pct: 30, oil: 0, corrosion: 0, collection: "mixed municipal waste", design_for_disassembly: 0, distance_km: 600, lifetime_years: 8 },
};

const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

const Segmented = ({ value, options, onChange }) => (
  <div className="grid gap-1 rounded-lg border border-gray-300 p-0.5 text-xs" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map(([v, l]) => (
      <button key={l} type="button" onClick={() => onChange(v)}
              className={`px-2 py-1.5 rounded-md ${value === v ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>{l}</button>
    ))}
  </div>
);

const Field = ({ label, children }) => <label className="block text-sm text-gray-700 space-y-1"><span>{label}</span>{children}</label>;

const OutcomeBar = ({ p }) => (
  <div className="flex h-9 w-full overflow-hidden rounded-lg" role="img" aria-label={OUT.map((o) => `${o.label} ${pctHalf(p[o.key])}%`).join(", ")}>
    {OUT.map((o) => (
      <div key={o.key} style={{ width: `${p[o.key] * 100}%`, background: o.color }} className="ef-bar flex items-center justify-center text-xs font-semibold text-white border-r-2 border-white last:border-r-0">
        {p[o.key] >= 0.08 ? `${pctHalf(p[o.key])}%` : ""}
      </div>
    ))}
  </div>
);

const CircularityPrecheck = ({ metal }) => {
  const [form, setForm] = useState(() => ({ ...PRESETS["Painted car aluminium"], metal: ["Aluminium", "Copper", "Magnesium", "Steel"].includes(metal) ? metal : "Aluminium" }));
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);   // bump to call the backend again
  const [more, setMore] = useState(false);  // less important inputs stay folded
  const timer = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  // follow the metal picked in the left panel
  useEffect(() => { if (["Aluminium", "Copper", "Magnesium", "Steel"].includes(metal)) setForm((f) => (f.metal === metal ? f : { ...f, metal })); }, [metal]);

  // live prediction, debounced while sliders move
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setBusy(true); setError(null);
      try {
        const r = await fetch(`${BACKEND}/api/circularity-precheck`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then((x) => x.json());
        if (r.success) setRes(r); else setError(r.error);
      } catch (e) { setError("Backend not reachable. Make sure the backend is running on port 8000."); }
      finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [form, retry]);

  const p = res?.probabilities;
  const verdictTone = !p ? "" : p.closed_loop >= 0.6 ? "bg-green-50 border-green-200 text-green-900" : p.closed_loop >= 0.35 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-red-50 border-red-200 text-red-900";

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><ScanSearch className="h-5 w-5 text-green-600" />Circularity pre-check</CardTitle>
        <p className="text-sm text-gray-500">
          Will this scrap come back as the same grade, be downcycled, or be lost?
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-5 text-sm">
          <span className="text-gray-500">Examples:</span>
          {Object.keys(PRESETS).map((k) => (
            <button key={k} onClick={() => setForm({ ...PRESETS[k] })} className="px-3 py-1 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">{k}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* ---------- inputs ---------- */}
          <div className="xl:col-span-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Metal">
                <select className={inputCls} value={form.metal} onChange={(e) => set("metal", e.target.value)}>
                  {["Aluminium", "Copper", "Magnesium", "Steel"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Product sector">
                <select className={inputCls} value={form.sector} onChange={(e) => set("sector", e.target.value)}>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
            </div>
            <Field label="Alloys in the batch"><Segmented value={form.alloy_mix} onChange={(v) => set("alloy_mix", v)} options={[[0, "Single alloy"], [1, "A few"], [2, "Mixed / unknown"]]} /></Field>
            <Field label="Coating">
              <select className={inputCls} value={form.coating} onChange={(e) => set("coating", e.target.value)}>{COATINGS.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label={`Plastic, rubber or glass attached: ${form.attachments_pct}%`}>
              <input type="range" min="0" max="40" step="1" value={form.attachments_pct} onChange={(e) => set("attachments_pct", Number(e.target.value))} className="w-full accent-green-600" />
            </Field>
            <Field label="Collected by">
              <Segmented value={form.collection} onChange={(v) => set("collection", v)} options={[["organised recycler", "Organised recycler"], ["informal scrap dealer", "Informal dealer"], ["mixed municipal waste", "Mixed waste"]]} />
            </Field>
            <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 text-sm text-green-700 hover:text-green-800">
              {more ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{more ? "Fewer details" : "More details (oil, rust, distance, lifetime)"}
            </button>
            {more && (
              <div className="space-y-3">
                <Field label="Oil / grease"><Segmented value={form.oil} onChange={(v) => set("oil", v)} options={[[0, "None"], [1, "Light"], [2, "Heavy"]]} /></Field>
                <Field label="Corrosion / rust"><Segmented value={form.corrosion} onChange={(v) => set("corrosion", v)} options={[[0, "None"], [1, "Surface"], [2, "Heavy"]]} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Distance to recycler: ${form.distance_km} km`}>
                    <input type="range" min="5" max="1500" step="5" value={form.distance_km} onChange={(e) => set("distance_km", Number(e.target.value))} className="w-full accent-green-600" />
                  </Field>
                  <Field label={`Product lifetime: ${form.lifetime_years} yr`}>
                    <input type="range" min="1" max="60" step="1" value={form.lifetime_years} onChange={(e) => set("lifetime_years", Number(e.target.value))} className="w-full accent-green-600" />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.design_for_disassembly === 1} onChange={(e) => set("design_for_disassembly", e.target.checked ? 1 : 0)} className="accent-green-600" />
                  Designed for easy disassembly
                </label>
              </div>
            )}
          </div>

          {/* ---------- prediction ---------- */}
          <div className="xl:col-span-3 space-y-4">
            {error && (
              <div className="text-sm text-red-700 flex flex-wrap items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}
                <button onClick={() => setRetry((r) => r + 1)} className="px-3 py-1 rounded-md border border-red-300 hover:bg-red-50 text-xs font-medium">Try again</button>
              </div>
            )}
            {!res && !error && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Predicting...</p>}
            {res && (
              <>
                <div className={`rounded-xl border p-4 ${verdictTone}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-semibold">{res.verdict}</p>
                    {busy && <Loader2 className="h-4 w-4 animate-spin opacity-60" />}
                  </div>
                  <p className="text-sm mt-0.5">Chance this metal returns as the same grade: <b>{pctHalf(p.closed_loop)}%</b></p>
                </div>

                <div>
                  <OutcomeBar p={p} />
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-gray-700">
                    {OUT.map((o) => <span key={o.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />{o.label}</span>)}
                  </div>
                </div>

                {res.plan.length > 0 ? (
                  <div className="rounded-xl border border-green-200 bg-green-50/60 p-4">
                    <p className="text-sm font-medium text-gray-900 mb-3">Fix plan</p>
                    <ol className="space-y-2.5">
                      <li className="grid grid-cols-12 items-center gap-2 text-sm">
                        <span className="col-span-6 text-gray-500">Now</span>
                        <div className="col-span-4 h-2.5 rounded-full bg-white overflow-hidden"><div className="ef-bar h-full bg-[#1baf7a]" style={{ width: `${p.closed_loop * 100}%` }} /></div>
                        <span className="col-span-2 text-right tabular-nums">{pctHalf(p.closed_loop)}%</span>
                      </li>
                      {res.plan.map((s, i) => (
                        <li key={s.label} className="grid grid-cols-12 items-center gap-2 text-sm">
                          <span className="col-span-6 text-gray-800">{i + 1}. {s.label}</span>
                          <div className="col-span-4 h-2.5 rounded-full bg-white overflow-hidden"><div className="ef-bar h-full bg-[#1baf7a]" style={{ width: `${s.closed_loop_after}%` }} /></div>
                          <span className="col-span-2 text-right tabular-nums font-medium">{s.closed_loop_after.toFixed(1)}%</span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                      <p className="text-sm text-green-900">Same grade: {pctHalf(p.closed_loop)}% → <b>{pctHalf(res.after_fixes.closed_loop)}%</b></p>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setForm({ ...res.after_inputs, design_for_disassembly: form.design_for_disassembly })}>
                        <Sparkles className="h-4 w-4 mr-1.5" />Apply these fixes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-green-800">No quick fixes left for this batch: it is already handled the best way.</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Model: {res.model} · 8,000 generated cases</span>
                  <button onClick={() => setForm({ ...PRESETS["Painted car aluminium"] })} className="flex items-center gap-1 hover:text-gray-700 shrink-0 ml-2"><RotateCcw className="h-3 w-3" />Reset</button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CircularityPrecheck;
