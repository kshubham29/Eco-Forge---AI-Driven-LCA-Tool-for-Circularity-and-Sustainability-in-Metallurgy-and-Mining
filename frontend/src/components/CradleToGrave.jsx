// [26] SYSTEM BOUNDARY CARD - switch between cradle-to-gate and cradle-to-grave. Cradle-to-grave adds the use
//      phase, end-of-life processing, landfill and the recycling credit (worldsteel net-scrap / EN 15804 Module D).
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Infinity as Loop, Check, Minus } from "lucide-react";
import { cradleToGrave, LIFE_STAGES } from "../data/lifecycle";

const COLORS = { burden: "#eb6834", credit: "#1baf7a", net: "#2a78d6", gate: "#898781" };
const f = (v) => v.toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : Math.abs(v) < 0.1 ? 3 : 2 });

// horizontal waterfall: each row is a bar from the running total before to the running total after
const Waterfall = ({ steps }) => {
  let run = 0;
  const rows = steps.map((s) => {
    if (s.total) return { ...s, from: 0, to: s.value };
    const from = run; run += s.value;
    return { ...s, from, to: run };
  });
  const lo = Math.min(0, ...rows.map((r) => Math.min(r.from, r.to)));
  const hi = Math.max(...rows.map((r) => Math.max(r.from, r.to)), 0.0001);
  const x = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-12 items-center gap-3 text-sm">
          <span className={`col-span-4 ${r.total ? "font-semibold text-gray-900" : "text-gray-700"}`}>{r.label}</span>
          <div className="col-span-6 relative h-4 bg-gray-50 rounded">
            {lo < 0 && <div className="absolute top-0 bottom-0 w-px bg-gray-300" style={{ left: `${x(0)}%` }} />}
            <div className="ef-bar absolute top-0 bottom-0 rounded"
                 style={{ left: `${x(Math.min(r.from, r.to))}%`, width: `${Math.max(0.6, Math.abs(x(r.to) - x(r.from)))}%`, background: r.color }} />
          </div>
          <span className="col-span-2 text-right tabular-nums text-gray-800">{r.value > 0 && !r.total ? "+" : ""}{f(r.value)}</span>
        </div>
      ))}
    </div>
  );
};

const CradleToGrave = ({ results, inputData, lifecycle, setLifecycle }) => {
  const set = (k, v) => setLifecycle((p) => ({ ...p, [k]: v }));
  const grave = lifecycle.boundary === "grave";
  const r = cradleToGrave({ ...inputData, gateKg: results.keyIndicators.totalCO2e, ...lifecycle });

  const steps = [
    { label: "Production (cradle-to-gate)", value: r.production, color: COLORS.gate },
    { label: "Use phase", value: r.use, color: COLORS.burden },
    { label: "End-of-life collection & shredding", value: r.eolProcessing, color: COLORS.burden },
    { label: "Landfill (not collected)", value: r.landfill, color: COLORS.burden },
    { label: "Recycling credit (net scrap)", value: -r.credit, color: r.credit >= 0 ? COLORS.credit : COLORS.burden },
    { label: "Cradle-to-grave total", value: r.net, color: COLORS.net, total: true },
  ];

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-gray-800"><Loop className="h-5 w-5 text-green-600" />System boundary</CardTitle>
          <div className="inline-flex rounded-lg border border-gray-300 p-0.5 text-sm" role="tablist">
            {[["gate", "Cradle-to-gate"], ["grave", "Cradle-to-grave"]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={lifecycle.boundary === k} onClick={() => set("boundary", k)}
                      className={`px-3 py-1.5 rounded-md ${lifecycle.boundary === k ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
        </div>
        {grave && <p className="text-sm text-gray-500">Full life cycle: production, use, end of life and the recycling loop back into new metal.</p>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-1.5 text-xs mb-4">
          {LIFE_STAGES.map((s, i) => {
            const inc = s.gate || grave;
            return (
              <React.Fragment key={s.key}>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${inc ? "border-green-300 bg-green-50 text-green-800" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
                  {inc ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}{s.label}
                </span>
                {i < LIFE_STAGES.length - 1 && <span className="text-gray-300">→</span>}
              </React.Fragment>
            );
          })}
          {grave && <span className="text-green-700 ml-1">↺ scrap returns to production</span>}
        </div>

        {!grave && (
          <p className="text-sm text-gray-700">Cradle-to-gate CO₂: <b>{f(r.production)} t CO₂e</b> for {f(inputData.weightKg / 1000)} t of {inputData.metal.toLowerCase()}.</p>
        )}

        {grave && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                End of life: <b>{Math.round(lifecycle.collection * 100)}%</b> collected, <b>{Math.round(lifecycle.efficiency * 100)}%</b> recycling yield              </div>
              <label className="block text-sm text-gray-700">Use-phase emissions (t CO₂e per tonne of metal)
                <input type="number" min="0" step="0.1" value={lifecycle.useTPerT}
                       onChange={(e) => set("useTPerT", Math.max(0, Number(e.target.value) || 0))}
                       className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />              </label>
            </div>
            <div className="lg:col-span-3">
              <p className="text-xs text-gray-500 mb-2">t CO₂e for {f(inputData.weightKg / 1000)} t of {inputData.metal.toLowerCase()}</p>
              <Waterfall steps={steps} />
              <p className="text-sm text-gray-800 mt-3">
                {r.credit >= 0
                  ? <>Recycling at end of life avoids <b>{f(r.credit)} t CO₂e</b> of new primary metal, so the full life cycle is <b>{Math.round((1 - r.net / r.production) * 100)}% lower</b> than production alone.</>
                  : <>This product uses more scrap ({Math.round(r.Fr * 100)}%) than is collected back ({Math.round(lifecycle.collection * 100)}%), so the net-scrap method adds a burden of <b>{f(-r.credit)} t CO₂e</b>.</>}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CradleToGrave;
