// [30] CO2 TARGET PLANNER - the "optimise" step: the user sets a CO2 target per tonne and the tool works out
//      three ways to reach it (more scrap, renewable power, or a balanced mix) from the current inputs.
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Target, CheckCircle2, XCircle } from "lucide-react";
import { planTarget } from "../data/lifecycle";
import { recycledShare } from "../data/mci";
import { lcaEngine } from "../data/lcaEngine";

const pct = (v) => `${Math.round(v * 100)}%`;

// one labelled bar (0-100%) inside an option card
const Bar = ({ label, v, color }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-16 text-gray-600">{label}</span>
    <div className="flex-1 h-2.5 rounded-full bg-white border border-gray-200 overflow-hidden">
      <div className="ef-bar h-full rounded-full" style={{ width: `${Math.round(v * 100)}%`, background: color }} />
    </div>
    <span className="w-9 text-right tabular-nums font-medium text-gray-800">{pct(v)}</span>
  </div>
);

const TargetPlanner = ({ results, inputData }) => {
  const t = inputData.weightKg / 1000;
  const s0 = recycledShare(inputData.route, inputData.scrapFraction);
  const nowGuess = results.keyIndicators.totalCO2e / 1000 / Math.max(t, 1e-6);
  // transport added on top of the cited route factors (ore-route legs only; the recycled factor already includes its own)
  const d = lcaEngine.baseData[inputData.metal];
  const transportT = d ? Math.max(0, nowGuess - ((1 - s0) * d.Primary.co2e + s0 * d.Recycled.co2e)) : 0;
  const [target, setTarget] = useState(() => +(nowGuess * 0.5).toFixed(2));
  // default target = half of the current footprint; reset whenever the inputs change it
  useEffect(() => { setTarget(+(nowGuess * 0.5).toFixed(2)); }, [nowGuess]);

  const plan = planTarget({ metal: inputData.metal, currentScrap: s0, target, transportT });
  if (!plan.supported) {
    return (
      <Card className="bg-white shadow-lg border-0">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-gray-800"><Target className="h-5 w-5 text-green-600" />Optimise: reach a CO₂ target</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-amber-700">The target planner is available for aluminium, copper, magnesium and steel.</p></CardContent>
      </Card>
    );
  }
  const cut = plan.now > 0 ? (1 - target / plan.now) * 100 : 0;

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><Target className="h-5 w-5 text-green-600" />Optimise: reach a CO₂ target</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Now ({pct(s0)} scrap, grid power)</p>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">{plan.now.toFixed(2)}</p>
            <p className="text-xs text-gray-500">t CO₂e per tonne</p>
          </div>
          <label className="block text-sm text-gray-700 md:col-span-2">
            <span className="flex justify-between"><span>Target: <b className="tabular-nums">{target.toFixed(2)}</b> t CO₂e per tonne</span>
              <span className="text-gray-500">{cut > 0 ? `${Math.round(cut)}% lower` : "no cut"}</span></span>
            <input type="range" min={Math.max(0.05, +(plan.best * 0.8).toFixed(2))} max={+(plan.now * 1.05).toFixed(2)} step="0.01" value={target}
                   onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-green-600" />
            <span className="text-xs text-gray-500">Best possible (100% scrap + 100% renewable): {plan.best.toFixed(2)}</span>
          </label>
        </div>

        {plan.alreadyMet && <p className="mt-4 text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Your current inputs already meet this target.</p>}
        {!plan.alreadyMet && !plan.reachable && (
          <p className="mt-4 text-sm text-amber-700 flex items-center gap-2"><XCircle className="h-4 w-4" />
            Not reachable with scrap and renewable power alone (best {plan.best.toFixed(2)}). The rest needs process changes such as inert anodes or hydrogen.</p>
        )}

        {!plan.alreadyMet && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {plan.options.map((o) => (
              <div key={o.name} className={`rounded-xl border p-4 ${o.feasible ? "border-green-200 bg-green-50/60" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{o.name}</p>
                  {o.feasible && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-600 text-white">−{Math.round((1 - o.gwp / plan.now) * 100)}%</span>}
                </div>
                {o.feasible ? (
                  <>
                    <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{o.gwp.toFixed(2)} <span className="text-xs font-normal text-gray-500">t CO₂e/t</span></p>
                    <div className="mt-2 space-y-1.5">
                      <Bar label="Scrap" v={o.scrap} color="#1baf7a" />
                      <Bar label="Renewable" v={o.renewable} color="#e0a100" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">saves {((plan.now - o.gwp) * t).toLocaleString("en-IN", { maximumFractionDigits: 1 })} t on this order</p>
                  </>
                ) : <p className="text-sm text-gray-500 mt-2">Can’t reach it this way alone.</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TargetPlanner;
