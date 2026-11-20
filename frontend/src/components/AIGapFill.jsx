// [21] AI GAP-FILLING CARD - the user enters only the plant data they know; the backend ML imputer
//      (/api/estimate-missing) estimates the rest and marks each value "AI-estimated" with a 95% range.
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Sparkles, Loader2, Eraser, AlertTriangle } from "lucide-react";
import { recycledShare } from "../data/mci";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

// key, label, unit, scale (screen value = model value x scale), placeholder
const FIELDS = [
  ["recycled_content", "Recycled content", "%", 100, "e.g. 30"],
  ["energy_gj", "Total energy", "GJ / t", 1, "unknown"],
  ["electricity_mwh", "Electricity", "MWh / t", 1, "unknown"],
  ["water_m3", "Water use", "m³ / t", 1, "unknown"],
  ["gwp_t_co2e", "Carbon footprint", "t CO₂e / t", 1, "unknown"],
  ["ore_grade_factor", "Ore / process factor", "1 = typical", 1, "unknown"],
  ["grid_intensity_tco2_mwh", "Grid emission factor", "t CO₂ / MWh", 1, "0.7117 India"],
  ["transport_km", "Total transport", "km", 1, "500"],
];

const fromCalculator = (inputData) => {
  const td = inputData.transportDistances || {};
  return {
    recycled_content: String(Math.round(recycledShare(inputData.route, inputData.scrapFraction) * 100)),
    grid_intensity_tco2_mwh: "0.7117",
    transport_km: String((td.mineToRefinery || 0) + (td.refineryToSmelter || 0) + (td.smelterToMarket || 0)),
  };
};

const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

const AIGapFill = ({ inputData }) => {
  const [vals, setVals] = useState(() => fromCalculator(inputData));
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // calculator inputs changed (metal, route, scrap share or distances) = start again from them
  const calcKey = inputData.metal + JSON.stringify(fromCalculator(inputData));
  useEffect(() => { setVals(fromCalculator(inputData)); setRes(null); setError(null); }, [calcKey]);

  const set = (k, v) => { setVals((p) => ({ ...p, [k]: v })); setRes(null); };

  const run = async () => {
    setBusy(true); setError(null);
    const values = {};
    FIELDS.forEach(([k, , , scale]) => {
      const v = vals[k];
      values[k] = v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v) / scale;
    });
    try {
      const r = await fetch(`${BACKEND}/api/estimate-missing`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metal: inputData.metal, values }),
      });
      const d = await r.json();
      if (d.success) setRes(d); else setError(d.error);
    } catch (e) {
      setError("Backend not reachable. Make sure the backend is running on port 8000.");
    } finally { setBusy(false); }
  };

  const tonnes = (inputData.weightKg || 1000) / 1000;
  const g = res?.values?.gwp_t_co2e;

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><Sparkles className="h-5 w-5 text-purple-600" />Plant data with AI gap-filling</CardTitle>
      </CardHeader>
      <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FIELDS.map(([k, label, unit, scale, ph]) => {
                const r = res?.values?.[k];
                const est = r?.estimated;
                return (
                  <label key={k} className="block">
                    <span className="text-xs text-gray-600">{label} <span className="text-gray-400">({unit})</span></span>
                    <input
                      type="number" step="any" value={est ? "" : vals[k] ?? ""} placeholder={est ? fmt(r.value * scale) : ph}
                      onChange={(e) => set(k, e.target.value)}
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                        est ? (r.low_reliability ? "border-amber-300 bg-amber-50 placeholder:text-amber-800 placeholder:font-medium" : "border-purple-300 bg-purple-50 placeholder:text-purple-800 placeholder:font-medium") : "border-gray-300"}`}
                    />
                    {est && (
                      <span className="text-[11px] text-purple-700">
                        AI-estimated · approx. 95% range {fmt(r.range[0] * scale)}–{fmt(r.range[1] * scale)}{r.low_reliability ? " · low reliability" : ""}
                      </span>
                    )}
                    {r?.default && <span className="text-[11px] text-gray-500">default used (distance can’t be predicted)</span>}
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={run} disabled={busy} className="bg-purple-600 hover:bg-purple-700">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}Fill missing values with AI
              </Button>
              <Button variant="outline" onClick={() => { setVals(fromCalculator(inputData)); setRes(null); }}>
                <Eraser className="h-4 w-4 mr-2" />Reset to calculator inputs
              </Button>
            </div>

            {error && <p className="mt-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5" />{error}</p>}

            {res && (
              <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                <p className="text-sm text-gray-800">
                  The AI estimated <b>{res.n_estimated}</b> of {FIELDS.length} values.
                  {g && <> Carbon footprint for your {tonnes.toLocaleString("en-IN")} t: <b>{fmt(g.value * tonnes)} t CO₂e</b>
                    {g.estimated && <> (approx. 95% range {fmt(g.range[0] * tonnes)}–{fmt(g.range[1] * tonnes)})</>}.</>}
                </p>
                {res.warnings?.length > 0 && <p className="text-xs text-amber-700 mt-2">⚠ {res.warnings.join(" ")}</p>}
                <p className="text-xs text-gray-500 mt-2">
                  Method: {res.method}. On held-out generated scenarios: energy, electricity and water stay within about 3–7% for every
                  missing-input pattern tested; CO₂ is within about 5% when one value is missing but about 16–17% when only one input is known;
                  ore grade and grid intensity cannot be estimated reliably from the other values. {res.range_note}
                </p>
              </div>
            )}
      </CardContent>
    </Card>
  );
};

export default AIGapFill;
