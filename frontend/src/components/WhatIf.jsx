// [39] WHAT IF? - one-click changes to the current inputs. Each chip shows the CO2 it would save (worked out with the
//      same lcaEngine before clicking); clicking applies it, and Undo puts the previous inputs back.
import React, { useState } from "react";
import { Wand2, Undo2 } from "lucide-react";
import { lcaEngine } from "../data/lcaEngine";

const OPTIONS = [
  ["Use 100% scrap", (d) => ({ ...d, route: "Recycled", scrapFraction: 0 })],
  ["Hybrid 50% scrap", (d) => ({ ...d, route: "Hybrid", scrapFraction: 50 })],
  ["Rail instead of truck", (d) => ({ ...d, transportMode: "Rail" })],
  ["Ship by sea", (d) => ({ ...d, transportMode: "Sea" })],
  ["Halve the distances", (d) => ({ ...d, transportDistances: Object.fromEntries(Object.entries(d.transportDistances).map(([k, v]) => [k, Math.round((Number(v) || 0) / 2)])) })],
];

const tonnesText = (kg) => (Math.abs(kg) >= 1000 ? `${(kg / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} t` : `${Math.round(kg).toLocaleString("en-IN")} kg`);

const WhatIf = ({ inputData, results, setInputData, lockDistances = false }) => {
  const [undo, setUndo] = useState(null);   // { prev, applied }: Undo shows only while the applied inputs are still in use
  const prev = undo && undo.applied === inputData ? undo.prev : null;
  const now = results.keyIndicators.totalCO2e;
  // with real places on, the distances come from the map, so the "halve the distances" idea is left out
  const chips = OPTIONS.filter(([label]) => !(lockDistances && label === "Halve the distances")).map(([label, change]) => {
    const next = change(inputData);
    const saved = now - lcaEngine.calculate(next).keyIndicators.totalCO2e;
    return { label, next, saved };
  }).filter((c) => c.saved >= 0.01 * now);   // only changes that cut CO2 by at least 1%

  if (!chips.length && !prev) return null;
  return (
    <div className="rounded-xl bg-white shadow-lg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mr-1"><Wand2 className="h-4 w-4 text-green-600" />What if?</span>
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={() => { setUndo({ prev: inputData, applied: c.next }); setInputData(c.next); }}
                  className="ef-lift flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-900 hover:bg-green-100">
            {c.label}<span className="font-semibold text-green-700">−{Math.round((c.saved / now) * 100)}%</span>
            <span className="text-xs text-green-700/80">({tonnesText(c.saved)})</span>
          </button>
        ))}
        {!chips.length && <span className="text-sm text-gray-500">Already the lowest-CO₂ choice here.</span>}
        {prev && (
          <button type="button" onClick={() => { setInputData(prev); setUndo(null); }}
                  className="flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 ml-auto">
            <Undo2 className="h-4 w-4" />Undo
          </button>
        )}
      </div>
    </div>
  );
};

export default WhatIf;
