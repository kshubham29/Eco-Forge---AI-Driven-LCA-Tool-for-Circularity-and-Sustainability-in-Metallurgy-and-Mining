// INSIGHTS CARD - rule-based recommendations from the current inputs and results. Each rule fires only when it
// applies and is ranked by the CO2 it could save, so the advice (not only the numbers) changes with the inputs.
import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Brain, CheckCircle, AlertTriangle, Lightbulb, Info } from "lucide-react";
import { lcaEngine, CEA_GRID_FACTOR_TCO2_PER_MWH } from "../data/lcaEngine";
import { findHotspots, hotspotAdvice, ELECTRICITY_MWH, planTarget } from "../data/lifecycle";
import { recycledShare } from "../data/mci";

const t = (kg) => (kg / 1000).toLocaleString("en-IN", { maximumFractionDigits: kg >= 100000 ? 0 : 2 });
const pct = (x) => (x < 0.095 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);

// tips that depend on the metal (cited factors in lcaEngine.js / lifecycle.js)
const METAL_TIPS = {
  Aluminium: [
    "Smelting needs about 15 MWh of electricity per tonne, so clean power is the biggest single lever.",
    "Remelting scrap uses about 92% less energy than making aluminium from ore (12 vs 155 GJ/t).",
    "Keep wrought and cast alloys apart, so scrap can go back into the same products.",
  ],
  Steel: [
    "Scrap-based EAF steel emits about 0.67 t CO₂ per tonne, against 2.19 t for the blast furnace route.",
    "Indian plants use more coal-based DRI, so real plant figures are often higher than the global factor.",
    "Remove copper from steel scrap; copper cannot be refined out and lowers the steel grade.",
  ],
  Copper: [
    "Recycled copper emits about 0.80 t CO₂ per tonne, against 3.83 t from ore.",
    "Cable and wire scrap is easy to recover at high purity; collect it separately.",
    "Lower ore grades need more energy per tonne, so recycling matters more over time.",
  ],
  Magnesium: [
    "The Pidgeon process is coal-heavy (about 28 t CO₂ per tonne); recycled magnesium is about 0.6 t.",
    "Magnesium scrap must be kept clean and dry; mixed or oily scrap is often lost.",
    "Even small amounts of recycled content cut the footprint a lot, because the primary route is so high.",
  ],
};

const GENERAL_TIPS = [
  "Check a scrap batch in the Pre-check tab before buying or melting it.",
  "Use the target planner (Hotspots & optimise tab) to find the scrap and clean-power mix for a CO₂ target.",
  "Save the assessment and track CO₂ per tonne over time on the Reports page.",
];

// Indian reference intensities (t CO2 per t) for a quick comparison
const INDIA_REF = { Steel: [2.54, "Indian steel average (Ministry of Steel, 2023-24)"], Aluminium: [17.01, "Vedanta Aluminium (FY 2024-25)"] };

/**
 * Builds recommendations from the current inputs and results. Each rule fires only when it applies and
 * carries an "impact" (kg CO2 it could save); after the status line they are sorted by impact, so the top
 * three change as the inputs change.
 */
export function buildInsights(inputData, results, focus = null) {
  const k = results?.keyIndicators;
  if (!k) return [];
  const metal = inputData.metal, m = metal.toLowerCase();
  const d = lcaEngine.baseData[metal] || lcaEngine.baseData.Aluminium;
  const wT = inputData.weightKg / 1000;
  if (!(wT > 0)) return [];
  const share = recycledShare(inputData.route, inputData.scrapFraction);
  const sp = Math.round(share * 100);
  const perT = k.totalCO2e / 1000 / wT;
  const primaryKg = d.Primary.co2e * inputData.weightKg;
  const gap = d.Primary.co2e - d.Recycled.co2e;                       // t CO2 saved per tonne moved to scrap
  const trKg = (results.stageBreakdown?.co2e || []).filter((x) => /transport/i.test(x.stage)).reduce((a, x) => a + (x.value || 0), 0);
  const td = inputData.transportDistances || {};
  const km = (td.mineToRefinery || 0) + (td.refineryToSmelter || 0) + (td.smelterToMarket || 0);
  const ef = lcaEngine.transportEmissions;
  const rules = [];
  const add = (type, impact, message, tag = "general") => rules.push({ type, impact, message, tag });

  // status line (always first)
  let status;
  if (share >= 1) status = { type: "positive", message: `Fully recycled ${m}: ${perT.toFixed(2)} t CO₂e per tonne, ${pct(1 - k.totalCO2e / primaryKg)} below the ore route. This order avoids ${t(primaryKg - k.totalCO2e)} t CO₂e.` };
  else if (share >= 0.5) status = { type: "positive", message: `${sp}% scrap: ${perT.toFixed(2)} t CO₂e per tonne, ${pct(1 - k.totalCO2e / primaryKg)} below making it all from ore.` };
  else if (share > 0) status = { type: "warning", message: `Only ${sp}% scrap: ${perT.toFixed(2)} t CO₂e per tonne. Most of the metal still comes from ore (${d.Primary.co2e} t/t).` };
  else status = { type: "warning", message: `Made fully from ore: ${perT.toFixed(2)} t CO₂e per tonne, the highest route for ${m}. From scrap it would be about ${d.Recycled.co2e} t.` };

  // hotspot: impact = what its standard fix could save
  const hot = findHotspots(results.stageBreakdown?.co2e)[0];
  if (hot && hot.share > 0) {
    const adv = hotspotAdvice(hot.stage);
    add("warning", hot.kg * adv.cut, `Biggest hotspot: ${hot.stage}, ${pct(hot.share)} of the CO₂ (${t(hot.kg)} t). ${adv.action} Could save about ${t(hot.kg * adv.cut)} t.`, "metal");
  }

  // scrap: next milestone (50%, then 100%)
  if (share < 1) {
    const next = share < 0.5 ? 0.5 : 1;
    const save = (next - share) * gap * inputData.weightKg;
    add("suggestion", save, next === 0.5
      ? `Raise scrap from ${sp}% to 50%: saves about ${t(save)} t CO₂e on this order (${t(0.1 * gap * inputData.weightKg)} t per extra 10%).`
      : `You are at ${sp}% scrap. Going fully circular (100%) saves about ${t(save)} t CO₂e more.`, "scrap");
  }

  // clean electricity: half renewable
  const elec = ELECTRICITY_MWH[metal];
  if (elec) {
    const mwh = ((1 - share) * elec[0] + share * elec[1]) * wT;
    const save = 0.5 * mwh * CEA_GRID_FACTOR_TCO2_PER_MWH * 1000;
    const mwhTxt = mwh.toLocaleString("en-IN", { maximumFractionDigits: mwh < 10 ? 1 : 0 });
    add("suggestion", save, save > 0.25 * k.totalCO2e
      ? `Electricity is a big lever here: ${mwhTxt} MWh for this order. Half from solar or wind cuts about ${t(save)} t CO₂e.`
      : `This order uses ${mwhTxt} MWh. Half from renewables would cut about ${t(save)} t CO₂e.`, "metal");
  }

  // CO2 target: what it takes to halve the footprint per tonne
  if (share < 1 && elec) {
    const extraT = Math.max(0, perT - ((1 - share) * d.Primary.co2e + share * d.Recycled.co2e));   // ore-route transport on top of the factors
    const plan = planTarget({ metal, currentScrap: share, target: perT / 2, transportT: extraT });
    const [sc, pw, mix] = plan.options || [];
    if (plan.supported && plan.reachable && !plan.alreadyMet) {
      const parts = [];
      if (sc?.feasible) parts.push(`${Math.round(sc.scrap * 100)}% scrap`);
      if (pw?.feasible) parts.push(`${Math.round(pw.renewable * 100)}% renewable power`);
      if (mix?.feasible) parts.push(`${Math.round(mix.scrap * 100)}% scrap + ${Math.round(mix.renewable * 100)}% renewable`);
      if (parts.length) add("suggestion", (perT / 2) * wT * 1000 * 0.6, `To halve CO₂ per tonne (to ${(perT / 2).toFixed(2)} t): ${parts.join(", or ")}.`, "scrap");
    }
  }

  // transport
  if (share < 1) {
    const leg = td.mineToRefinery || 0;
    if (inputData.transportMode === "Truck" && leg > 0) {
      const save = (ef.Truck - ef.Rail) * leg * wT * (1 - share);
      add("info", save, `Transport is ${pct(trKg / k.totalCO2e)} of the total (${t(trKg)} t). Rail for the ${leg} km mine → refinery leg saves about ${t(save)} t CO₂e.`, "transport");
    } else if (leg > 0) {
      add("positive", 0, `${inputData.transportMode} for the mine → refinery leg keeps transport at ${pct(trKg / k.totalCO2e)} of the total (${t(trKg)} t). Truck would emit about ${Math.round(ef.Truck / ef[inputData.transportMode])}× more on that leg.`, "transport");
    }
    if (km > 1500) add("info", 0.4 * trKg, `Long supply route (${km.toLocaleString("en-IN")} km). Sourcing nearer would cut transport CO₂ (now ${t(trKg)} t).`, "transport");
  } else if (share >= 1) {
    add("info", 0, "Distances and transport mode apply to the ore route, so they do not change the recycled result.", "transport");
  }

  // comparison with an Indian reference
  const ref = INDIA_REF[metal];
  if (ref && share < 1) {
    const diff = (perT - ref[0]) / ref[0];
    add("info", 0, `Compared with ${ref[1]} at ${ref[0]} t/t, this is ${Math.abs(Math.round(diff * 100))}% ${diff < 0 ? "lower" : "higher"}.`, "metal");
  }

  // scrap quality reminder when scrap is used
  if (share > 0) {
    add("info", 0, "Scrap quality decides if the metal stays the same grade. Check the batch in the Pre-check tab.", "scrap");
  }

  // order size: make the tonnes concrete
  {
    const avoid = Math.max(0, k.totalCO2e - d.Recycled.co2e * inputData.weightKg);
    if (avoid > 0) add("info", 0, `For ${wT.toLocaleString("en-IN", { maximumFractionDigits: 2 })} t of ${m}, the fully circular route would avoid ${t(avoid)} t CO₂e, about the yearly electricity CO₂ of ${Math.round(avoid / (1.2 * CEA_GRID_FACTOR_TCO2_PER_MWH)).toLocaleString("en-IN")} Indian homes.`, "weight");
    else add("positive", 0, `This ${wT.toLocaleString("en-IN", { maximumFractionDigits: 2 })} t order is already at the recycled-route footprint (${t(k.totalCO2e)} t CO₂e).`, "weight");
  }

  // the input the user just changed decides what comes first; then the biggest saving
  rules.sort((x, y) => (focus && (y.tag === focus) - (x.tag === focus)) || y.impact - x.impact);
  return [status, ...rules];
}

const ICON = {
  positive: <CheckCircle className="h-5 w-5 text-green-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  suggestion: <Lightbulb className="h-5 w-5 text-blue-500" />,
  info: <Info className="h-5 w-5 text-gray-500" />,
};
const BG = {
  positive: "bg-green-50 border-green-200",
  warning: "bg-orange-50 border-orange-200",
  suggestion: "bg-blue-50 border-blue-200",
  info: "bg-gray-50 border-gray-200",
};

const InsightsCard = ({ inputData, results }) => {
  const [showMore, setShowMore] = useState(false);   // tips
  const [showAll, setShowAll] = useState(false);     // all insights
  // which input changed last -> those recommendations come first
  const lastInput = useRef(inputData);
  const [focus, setFocus] = useState(null);
  useEffect(() => {
    const o = lastInput.current, n = inputData;
    let f = null;
    if (o.metal !== n.metal) f = "metal";
    else if (o.route !== n.route || o.scrapFraction !== n.scrapFraction) f = "scrap";
    else if (o.transportMode !== n.transportMode || JSON.stringify(o.transportDistances) !== JSON.stringify(n.transportDistances)) f = "transport";
    else if (o.weightKg !== n.weightKg) f = "weight";
    if (f) setFocus(f);
    lastInput.current = n;
  }, [inputData]);
  const all = buildInsights(inputData, results, focus);
  const insights = showAll ? all : all.slice(0, 3);
  // remember the previous messages so changed ones can flash and hidden changes can be flagged
  const prev = useRef(all.map((x) => x.message));
  const changed = all.map((x, i) => prev.current[i] !== undefined && prev.current[i] !== x.message);
  const hiddenChanged = showAll ? 0 : changed.slice(3).filter(Boolean).length;
  useEffect(() => { prev.current = all.map((x) => x.message); });
  const [, setTick] = useState(0);   // re-render once after a change so the highlight fades
  const anyChanged = changed.some(Boolean);
  useEffect(() => {
    if (!anyChanged) return undefined;
    const id = setTimeout(() => setTick((t) => t + 1), 1500);
    return () => clearTimeout(id);
  }, [anyChanged, results]);
  const tips = METAL_TIPS[inputData.metal] || [];

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2 text-gray-800">
          <Brain className="h-5 w-5 text-purple-600" />
          <span>Insights & Recommendations</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-2.5">
          {insights.map((insight, index) => (
            <div key={insight.message} className={`p-3 rounded-lg border ${BG[insight.type] || BG.info} hover:shadow-md transition-all ${changed[index] ? "animate-in fade-in zoom-in-95 duration-700 ring-2 ring-purple-300" : ""}`}>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">{ICON[insight.type] || ICON.info}</div>
                <p className="flex-1 text-sm text-gray-800 leading-relaxed">{insight.message}</p>
              </div>
            </div>
          ))}
          {insights.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm">Enter a quantity above zero to see recommendations.</p>
            </div>
          )}
        </div>

        {showMore && tips.length > 0 && (
          <div className="mt-3 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
            <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center">
              <Lightbulb className="h-4 w-4 mr-2" />
              Tips for {inputData.metal.toLowerCase()}
            </h4>
            <ul className="text-xs text-indigo-700 space-y-1">
              {tips.map((tip) => <li key={tip}>• {tip}</li>)}
              {GENERAL_TIPS.map((tip) => <li key={tip}>• {tip}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {all.length > 3 && (
            <button onClick={() => setShowAll((v) => !v)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors">
              {showAll ? "Show fewer" : `Show all ${all.length} insights${hiddenChanged ? ` (${hiddenChanged} updated)` : ""}`}
            </button>
          )}
          <button onClick={() => setShowMore((v) => !v)}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-200 transition-colors">
            {showMore ? "Hide tips" : `Tips for ${inputData.metal.toLowerCase()}`}
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InsightsCard;
