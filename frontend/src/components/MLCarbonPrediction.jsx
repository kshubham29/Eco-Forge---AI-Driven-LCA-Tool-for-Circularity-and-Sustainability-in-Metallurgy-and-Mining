// [5] LIVE ML CARD - calls the backend /predict-gwp API and shows the machine-learning carbon prediction.
//     Uses the calculator's metal, route/scrap share and distances, plus two inputs only the ML model has:
//     grid electricity and ore quality (sliders in this card, limited to the model's training range).
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Brain, Loader2 } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const CEA = 0.7117;                       // India grid, t CO2 per MWh (CEA v21.0)
const GRID = [0.43, 0.92];                // training range: 0.6x to 1.3x the CEA value
const ORE = [0.7, 1.3];

const MLCarbonPrediction = ({ inputData, results }) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);   // bump to call the backend again
  const [grid, setGrid] = useState(CEA);
  const [ore, setOre] = useState(1.0);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {          // short wait so moving a slider sends one request
      setLoading(true);
      setError(null);
      try {
        const recycled = inputData.route === "Recycled" ? 1 : inputData.route === "Hybrid" ? (inputData.scrapFraction || 0) / 100 : 0;
        const td = inputData.transportDistances || {};
        const transport_km = (td.mineToRefinery || 0) + (td.refineryToSmelter || 0) + (td.smelterToMarket || 0);
        const res = await fetch(`${BACKEND}/api/predict-gwp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metal: inputData.metal, recycled_content: recycled, transport_km, grid_intensity_tco2_mwh: grid, ore_grade_factor: ore }),
        });
        const data = await res.json();
        if (data.success) setResult(data);
        else setError(data.error || "Prediction failed");
      } catch (e) {
        setError("Backend not reachable");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [inputData, retry, grid, ore]);

  const tonnes = (inputData.weightKg || 0) / 1000;
  const calcPerT = results?.keyIndicators && tonnes > 0 ? results.keyIndicators.totalCO2e / 1000 / tonnes : null;
  const fmt = (v, d = 2) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: d });

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center space-x-2 text-gray-800">
          <Brain className="h-5 w-5 text-purple-600" />
          <span>ML-Predicted Carbon Footprint</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && !loading && (
          <div className="text-sm text-red-600 py-2 flex flex-wrap items-center gap-3">{error}. Start the backend (port 8000).
                <button onClick={() => setRetry((r) => r + 1)} className="px-3 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 text-xs font-medium">Try again</button></div>
        )}

        {!result && !error && <div className="flex items-center text-gray-500 text-sm py-4"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running ML model...</div>}

        {result && !(error && !loading) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-bold text-purple-700">{result.predicted_gwp_t_co2e_per_tonne}</span>
                <span className="text-gray-600 text-sm">t CO₂e / tonne</span>
              </div>
              {result.range_95 && <p className="text-sm text-gray-700 mt-1">Approx. 95% range: {result.range_95[0]} – {result.range_95[1]}</p>}
              {tonnes > 0 && <p className="text-sm text-gray-900 mt-1">For your {fmt(tonnes, 2)} t: <b>{fmt(result.predicted_gwp_t_co2e_per_tonne * tonnes, 1)} t CO₂e</b></p>}
              {calcPerT != null && <p className="text-xs text-gray-500 mt-1">Calculator (grid and ore at default): {fmt(calcPerT)} t CO₂e / tonne</p>}
              {result.warnings?.length > 0 && <p className="text-xs text-amber-700 mt-2">⚠ {result.warnings.join(" ")}</p>}
              <div className="mt-3 inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">{result.model}</div>
            </div>

            <div className="space-y-4 rounded-lg bg-purple-50/50 border border-purple-100 p-3">
              <label className="block text-sm text-gray-800">
                <span className="flex justify-between"><span>Grid electricity</span><b>{grid.toFixed(2)} t CO₂/MWh</b></span>
                <input type="range" min={GRID[0]} max={GRID[1]} step="0.01" value={grid} onChange={(e) => setGrid(Number(e.target.value))} className="w-full accent-purple-600" />
                <span className="flex justify-between text-xs text-gray-500"><span>cleaner</span>
                  <button type="button" onClick={() => setGrid(CEA)} className="underline">India average 0.71</button><span>more coal</span></span>
              </label>
              <label className="block text-sm text-gray-800">
                <span className="flex justify-between"><span>Ore quality factor</span><b>{ore.toFixed(2)}</b></span>
                <input type="range" min={ORE[0]} max={ORE[1]} step="0.05" value={ore} onChange={(e) => setOre(Number(e.target.value))} className="w-full accent-purple-600" />
                <span className="flex justify-between text-xs text-gray-500"><span>richer ore</span>
                  <button type="button" onClick={() => setOre(1)} className="underline">typical 1.0</button><span>poorer ore</span></span>
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MLCarbonPrediction;
