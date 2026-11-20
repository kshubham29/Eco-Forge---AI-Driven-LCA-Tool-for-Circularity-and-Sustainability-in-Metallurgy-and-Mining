// [24] LIFE-CYCLE HELPERS - hotspot finder, cradle-to-grave extension (use phase, end of life, recycling credit)
//      and the reduction advice used by the Calculator cards and the ISO 14040 report.
import { lcaEngine } from "./lcaEngine";
import { CEA_GRID_FACTOR_TCO2_PER_MWH } from "./lcaEngine";

// ---------------- hotspots ----------------

// group the calculator's stage list into life-cycle stages ("Transport Mine→Refinery (Primary)" -> "Transport")
export const stageGroup = (name) => {
  const s = name.toLowerCase();
  if (s.includes("transport")) return "Transport";
  if (s.includes("mining")) return "Mining";
  if (s.includes("refin")) return "Refining";
  if (s.includes("smelt")) return "Smelting";
  if (s.includes("remelt")) return "Remelting (scrap)";
  if (s.includes("scrap collection")) return "Scrap collection";
  return "Casting & fabrication";
};

/** stageCo2 = results.stageBreakdown.co2e ([{stage, value kg}]) -> groups sorted by share */
export function findHotspots(stageCo2 = []) {
  const totals = {};
  stageCo2.forEach(({ stage, value }) => { const g = stageGroup(stage); totals[g] = (totals[g] || 0) + (value || 0); });
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals)
    .map(([stage, kg]) => ({ stage, kg, share: kg / sum }))
    .sort((a, b) => b.kg - a.kg);
}

// what each stage can do, and roughly how much it saves (share of that stage's CO2)
const ADVICE = {
  Smelting: { action: "Run the smelter on renewable power (solar/wind PPA) and raise the scrap share.", cut: 0.6,
    why: "Smelting uses most of the electricity, and India's grid is coal-heavy (0.7117 t CO₂/MWh)." },
  Refining: { action: "Add heat recovery and switch refinery fuel from coal/oil to natural gas or biomass.", cut: 0.25,
    why: "Refining burns a lot of fossil fuel for heat." },
  Mining: { action: "Use higher-grade ore, electric haul trucks and beneficiation near the mine.", cut: 0.3,
    why: "Low-grade ore means more rock moved and crushed per tonne of metal." },
  "Casting & fabrication": { action: "Use near-net-shape casting, insulated furnaces and recycle in-plant scrap.", cut: 0.2,
    why: "Re-heating and yield losses add energy at the end of the process." },
  Transport: { action: "Shift road freight to rail (0.022 vs 0.062 kg CO₂ per t-km) or coastal shipping.", cut: 0.6,
    why: "Trucks emit about 3× more per tonne-km than rail." },
  "Remelting (scrap)": { action: "Use efficient induction or regenerative furnaces on renewable power.", cut: 0.4,
    why: "Remelting scrap is the main energy use of the recycled route." },
  "Scrap collection": { action: "Collect and sort scrap locally to cut handling and transport.", cut: 0.3,
    why: "Scattered collection adds trips and sorting energy." },
};

export const hotspotAdvice = (stage) => ADVICE[stage] || ADVICE["Casting & fabrication"];

// CO2 saved per +10 percentage points of scrap, for this metal (cited primary vs recycled factors)
export function scrapLever(metal, weightKg) {
  const d = lcaEngine.baseData[metal] || lcaEngine.baseData.Aluminium;
  return 0.1 * (d.Primary.co2e - d.Recycled.co2e) * weightKg; // kg CO2e
}

// ---------------- cradle-to-grave ----------------

// indicative end-of-life factors (t CO2e per tonne of metal handled)
export const EOL = {
  collectionKm: 100,                                   // scrap collection by truck
  truckKgPerTkm: 0.062,                                // DEFRA/GLEC
  shreddingKwhPerT: 30,                                // shredding + sorting electricity
  landfillTPerT: 0.005,                                // handling an inert metal in landfill
};

/**
 * Cradle-to-grave = production (cradle-to-gate) + use phase + end-of-life processing + landfill - recycling credit.
 * Recycling credit uses the worldsteel "net scrap" method (also EN 15804 Module D):
 *   credit = (Cr - Fr) x E x (GWP_primary - GWP_recycled) x mass
 * so scrap that was already used as input is not credited twice.
 */
export function cradleToGrave({ metal, route, scrapFraction, weightKg, gateKg, collection, efficiency, useTPerT = 0 }) {
  const t = weightKg / 1000;
  const d = lcaEngine.baseData[metal] || lcaEngine.baseData.Aluminium;
  const Fr = route === "Recycled" ? 1 : route === "Hybrid" ? (scrapFraction || 0) / 100 : 0;
  const production = gateKg / 1000;                                            // t CO2e
  const use = useTPerT * t;
  const eolProcessing = collection * t * (EOL.collectionKm * EOL.truckKgPerTkm / 1000 + EOL.shreddingKwhPerT / 1000 * CEA_GRID_FACTOR_TCO2_PER_MWH);
  const landfill = (1 - collection) * t * EOL.landfillTPerT;
  const credit = (collection - Fr) * efficiency * (d.Primary.co2e - d.Recycled.co2e) * t;   // positive = avoided
  const net = production + use + eolProcessing + landfill - credit;
  return { production, use, eolProcessing, landfill, credit, net, Fr };
}

// ---------------- optimiser: reach a CO2 target ----------------

// electricity per tonne, primary / recycled route (indicative: IAI, worldsteel, ICA, literature; same as backend/gap_filler.py)
export const ELECTRICITY_MWH = { Aluminium: [15.0, 0.7], Copper: [3.5, 0.9], Magnesium: [7.0, 0.5], Steel: [0.6, 0.65] };

/**
 * CO2 per tonne for a given scrap share s and renewable-power share p:
 *   GWP(s, p) = (1 - s) x GWPp + s x GWPr - p x E(s) x grid + transport,   E(s) = (1 - s) x Ep + s x Er
 * Renewable power removes the grid-electricity part only; process (fuel, anode, chemistry) emissions stay.
 */
export function gwpAt(metal, s, p, transportT = 0) {
  const d = lcaEngine.baseData[metal];
  const [ep, er] = ELECTRICITY_MWH[metal] || [0, 0];
  const elec = (1 - s) * ep + s * er;
  const gross = (1 - s) * d.Primary.co2e + s * d.Recycled.co2e;
  return Math.max(gross - p * elec * CEA_GRID_FACTOR_TCO2_PER_MWH, 0.02) + transportT;
}

/** Three ways to reach `target` (t CO2e/t) starting from the current scrap share: more scrap, renewable power, or both. */
export function planTarget({ metal, currentScrap, target, transportT = 0 }) {
  if (!ELECTRICITY_MWH[metal]) return { supported: false };
  const s0 = Math.max(0, Math.min(1, currentScrap));
  const now = gwpAt(metal, s0, 0, transportT);
  const best = gwpAt(metal, 1, 1, transportT);
  const steps = Array.from({ length: 101 }, (_, i) => i / 100);
  const meet = (s, p) => gwpAt(metal, s, p, transportT) <= target + 1e-9;

  const scrapOnly = steps.find((s) => s >= s0 && meet(s, 0));
  const powerOnly = steps.find((p) => meet(s0, p));
  // balanced: share the effort - the smallest "largest single change" (extra scrap or renewable share), ties -> smaller total
  let balanced = null;
  steps.forEach((s) => {
    if (s < s0) return;
    const p = steps.find((q) => meet(s, q));
    if (p === undefined) return;
    const worst = Math.max(s - s0, p), total = (s - s0) + p;
    if (!balanced || worst < balanced.worst - 1e-9 || (Math.abs(worst - balanced.worst) < 1e-9 && total < balanced.total)) balanced = { s, p, worst, total };
  });
  const option = (name, s, p, note) => (s === undefined || p === undefined ? { name, feasible: false, note }
    : { name, feasible: true, scrap: s, renewable: p, gwp: gwpAt(metal, s, p, transportT), note });

  return {
    supported: true, now, best, target, reachable: best <= target + 1e-9, alreadyMet: now <= target + 1e-9,
    options: [
      option("More scrap", scrapOnly, scrapOnly === undefined ? undefined : 0, "Raise the recycled share, no change to power."),
      option("Renewable power", powerOnly === undefined ? undefined : s0, powerOnly, "Keep the scrap share, switch electricity to solar/wind."),
      option("Balanced mix", balanced?.s, balanced?.p, "Shares the effort between more scrap and renewable power."),
    ],
  };
}

export const LIFE_STAGES = [
  { key: "extraction", label: "Raw material extraction", gate: true },
  { key: "processing", label: "Processing & refining", gate: true },
  { key: "manufacturing", label: "Smelting & manufacturing", gate: true },
  { key: "distribution", label: "Distribution (transport)", gate: true },
  { key: "use", label: "Use phase", gate: false },
  { key: "eol", label: "End of life & recycling loop", gate: false },
];
