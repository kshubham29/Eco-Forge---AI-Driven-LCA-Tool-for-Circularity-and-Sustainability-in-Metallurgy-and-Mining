// Numerical tests for the LCA engine: units, route mixing, stage totals and the circularity formulas.
// Run: npx craco test --watchAll=false
import { lcaEngine as calc } from "../lcaEngine";
import { computeMCI, MCI_DEFAULTS } from "../mci";
import { cradleToGrave, planTarget, gwpAt } from "../lifecycle";
import { roadKm, routeDistances, defaultPlaces } from "../routePlaces";

const TD = { mineToRefinery: 500, refineryToSmelter: 300, smelterToMarket: 200 };
const run = (o) => calc.calculate({ metal: "Aluminium", route: "Primary", scrapFraction: 0, weightKg: 1000,
  transportDistances: TD, transportMode: "Truck", ...o });
const sum = (arr) => arr.reduce((a, s) => a + s.value, 0);
const METALS = ["Aluminium", "Copper", "Magnesium", "Steel"];

// transport for the default legs: chosen mode for mine→refinery, sea for refinery→smelter, truck for smelter→market
const transportKgPerT = (mode = "Truck") => 500 * calc.transportEmissions[mode] + 300 * 0.015 + 200 * 0.062;

describe("units and cited totals", () => {
  test.each(METALS)("1 t primary %s = cited CO2 factor (t/t) x 1000 + transport, in kg", (metal) => {
    const k = run({ metal }).keyIndicators;
    const cited = calc.baseData[metal].Primary.co2e;
    expect(k.totalCO2e).toBeCloseTo(cited * 1000 + transportKgPerT(), 3);
  });

  test("headline: 1 t primary aluminium = 16,147.9 kg CO2e (16.1 t cited + 47.9 kg transport)", () => {
    expect(run().keyIndicators.totalCO2e).toBeCloseTo(16147.9, 1);
  });

  test.each(METALS)("1 t recycled %s = cited recycled factor (no extra transport)", (metal) => {
    const k = run({ metal, route: "Recycled" }).keyIndicators;
    expect(k.totalCO2e).toBeCloseTo(calc.baseData[metal].Recycled.co2e * 1000, 6);
    expect(k.totalEnergy).toBeCloseTo(calc.baseData[metal].Recycled.energy, 6);
  });

  test("results scale linearly with mass (kg in, kg/GJ/m3 out)", () => {
    const a = run({ weightKg: 1000 }).keyIndicators, b = run({ weightKg: 2500 }).keyIndicators;
    ["totalCO2e", "totalEnergy", "totalWater", "totalWaste"].forEach((k) => expect(b[k]).toBeCloseTo(a[k] * 2.5, 6));
  });

  test("water uses m3 per tonne x tonnes", () => {
    expect(run({ metal: "Steel" }).keyIndicators.totalWater).toBeCloseTo(calc.baseData.Steel.Primary.water, 6);
  });

  test("100 km more by truck on the first leg adds 100 x 0.062 kg per tonne", () => {
    const base = run().keyIndicators.totalCO2e;
    const more = run({ transportDistances: { ...TD, mineToRefinery: 600 } }).keyIndicators.totalCO2e;
    expect(more - base).toBeCloseTo(6.2, 6);
  });

  test("transport mode only changes the mine→refinery leg (documented assumption)", () => {
    const truck = run({ transportMode: "Truck" }).keyIndicators.totalCO2e;
    const rail = run({ transportMode: "Rail" }).keyIndicators.totalCO2e;
    expect(truck - rail).toBeCloseTo(500 * (0.062 - 0.022), 6);
  });
});

describe("route mixing", () => {
  test.each(METALS)("hybrid at 0%% scrap equals primary and at 100%% equals recycled (%s)", (metal) => {
    const p = run({ metal, route: "Primary" }).keyIndicators, r = run({ metal, route: "Recycled" }).keyIndicators;
    const h0 = run({ metal, route: "Hybrid", scrapFraction: 0 }).keyIndicators;
    const h100 = run({ metal, route: "Hybrid", scrapFraction: 100 }).keyIndicators;
    ["totalCO2e", "totalEnergy", "totalWater", "totalWaste"].forEach((k) => {
      expect(h0[k]).toBeCloseTo(p[k], 6);
      expect(h100[k]).toBeCloseTo(r[k], 6);
    });
  });

  test("hybrid 50% is the mass-weighted average of primary and recycled", () => {
    const p = run({ route: "Primary" }).keyIndicators.totalCO2e, r = run({ route: "Recycled" }).keyIndicators.totalCO2e;
    expect(run({ route: "Hybrid", scrapFraction: 50 }).keyIndicators.totalCO2e).toBeCloseTo((p + r) / 2, 6);
  });

  test("scrap fraction outside 0-100 is clamped", () => {
    expect(run({ route: "Hybrid", scrapFraction: 140 }).keyIndicators.totalCO2e)
      .toBeCloseTo(run({ route: "Recycled" }).keyIndicators.totalCO2e, 6);
  });
});

describe("stage breakdown adds up to the key indicators", () => {
  const cases = [];
  METALS.forEach((m) => ["Primary", "Recycled", "Hybrid"].forEach((r) => cases.push([m, r])));
  test.each(cases)("%s %s", (metal, route) => {
    const res = run({ metal, route, scrapFraction: 40 });
    const k = res.keyIndicators;
    // stage values are rounded to 1 kg / 0.1 GJ each, so allow a small rounding margin
    expect(Math.abs(sum(res.stageBreakdown.co2e) - k.totalCO2e)).toBeLessThan(6);
    expect(Math.abs(sum(res.stageBreakdown.energy) - k.totalEnergy)).toBeLessThan(1);
    expect(Math.abs(sum(res.stageBreakdown.waste) - k.totalWaste)).toBeLessThan(6);
  });

  test("calibration: primary process stages add up to the cited factor exactly", () => {
    const st = calc.calculatePrimaryRoute(1000, TD, "Truck", "Steel").stages.filter((s) => !s.stage.startsWith("Transport"));
    expect(st.reduce((a, s) => a + s.co2e, 0)).toBeCloseTo(2190, 6);   // regression: was ~8x too high before calibration
  });
});

describe("circularity formulas", () => {
  test("MCI: primary aluminium 0.35, fully recycled 0.79 (UNEP 60% collection, 92% yield)", () => {
    const { collection, efficiency } = MCI_DEFAULTS.Aluminium;
    expect(computeMCI({ Fr: 0, Cr: collection, Ec: efficiency, Ef: efficiency }).MCI).toBeCloseTo(0.35, 2);
    expect(computeMCI({ Fr: 1, Cr: collection, Ec: efficiency, Ef: efficiency }).MCI).toBeCloseTo(0.79, 2);
  });

  test("MCI stays within 0..1", () => {
    expect(computeMCI({ Fr: 1, Cr: 1, Ec: 1, Ef: 1 }).MCI).toBeLessThanOrEqual(1);
    expect(computeMCI({ Fr: 0, Cr: 0 }).MCI).toBeGreaterThanOrEqual(0);
  });

  test("cradle-to-grave net-scrap credit: 1 t primary aluminium 16.15 → 7.58 t", () => {
    const g = cradleToGrave({ metal: "Aluminium", route: "Primary", scrapFraction: 0, weightKg: 1000,
      gateKg: 16147.9, collection: 0.6, efficiency: 0.92 });
    expect(g.credit).toBeCloseTo(0.6 * 0.92 * (16.1 - 0.55), 6);
    expect(g.net).toBeCloseTo(7.58, 2);
  });

  test("no double credit: recycled input collected at the same rate earns nothing", () => {
    const g = cradleToGrave({ metal: "Steel", route: "Hybrid", scrapFraction: 80, weightKg: 1000, gateKg: 1000,
      collection: 0.8, efficiency: 0.9 });
    expect(g.credit).toBeCloseTo(0, 9);
  });

  test("target planner: halving aluminium CO2 needs 52% scrap or 76% renewable power", () => {
    const now = gwpAt("Aluminium", 0, 0);
    const plan = planTarget({ metal: "Aluminium", currentScrap: 0, target: now / 2 });
    const [scrap, power, mix] = plan.options;
    expect(scrap.scrap).toBeCloseTo(0.52, 2);
    expect(power.renewable).toBeCloseTo(0.76, 2);
    expect(mix.scrap).toBeCloseTo(0.36, 2);
    plan.options.forEach((o) => expect(o.gwp).toBeLessThanOrEqual(now / 2 + 1e-9));
  });
});

describe("real route places", () => {
  const sites = [
    { name: "Mine A", metal: "Aluminium", type: "Bauxite mine", lat: 18.8, lon: 82.98 },
    { name: "Refinery A", metal: "Aluminium", type: "Alumina refinery", lat: 18.76, lon: 82.92 },
    { name: "Smelter A", metal: "Aluminium", type: "Aluminium smelter", lat: 20.82, lon: 85.08 },
    { name: "Iron Mine", metal: "Steel", type: "Iron ore mine", lat: 18.6, lon: 81.22 },
    { name: "Plant", metal: "Steel", type: "Integrated steel plant", lat: 19.16, lon: 82.08 },
  ];
  test("road distance is symmetric, zero for the same place and rounded to 5 km", () => {
    const a = { lat: 28.61, lon: 77.21 }, b = { lat: 19.08, lon: 72.88 };   // Delhi - Mumbai
    expect(roadKm(a, b)).toBe(roadKm(b, a));
    expect(roadKm(a, a)).toBe(0);
    expect(roadKm(a, b) % 5).toBe(0);
    expect(roadKm(a, b)).toBeGreaterThan(1300);   // ~1,150 km straight x 1.3
    expect(roadKm(a, b)).toBeLessThan(1600);
  });
  test("aluminium uses all three legs; steel has no separate refinery leg", () => {
    const al = routeDistances("Aluminium", defaultPlaces("Aluminium", sites), sites);
    expect(al.mineToRefinery).toBeGreaterThan(0);
    expect(al.refineryToSmelter).toBeGreaterThan(0);
    const st = routeDistances("Steel", defaultPlaces("Steel", sites), sites);
    expect(st.refineryToSmelter).toBe(0);
    expect(st.mineToRefinery).toBeGreaterThan(0);
  });
  test("metals without Indian sites give no route", () => {
    expect(defaultPlaces("Magnesium", sites)).toBeNull();
  });
});
