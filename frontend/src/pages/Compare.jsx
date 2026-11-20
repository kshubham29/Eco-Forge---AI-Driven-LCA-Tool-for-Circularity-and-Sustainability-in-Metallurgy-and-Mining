// [22] COMPARE PAGE - conventional (primary) vs hybrid vs fully circular (recycled) route, side by side:
//      energy, CO2, water, waste and circularity score (MCI).
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { GitCompare, Leaf, Zap, Cloud, Droplets, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { lcaEngine } from "../data/lcaEngine";
import { computeMCI, MCI_DEFAULTS } from "../data/mci";
import { Gauge } from "../components/CircularityScore";
import { C } from "../components/Plot";
import Num from "../components/Num";

const METALS = ["Aluminium", "Copper", "Magnesium", "Steel"];
const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

const n = (v, d = 1) => v.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
const METAL_DOT = { Aluminium: "#9ca3af", Copper: "#c2410c", Magnesium: "#a3a3a3", Steel: "#475569" };
// the indicators the bar race can show
const PICK = [
  { k: "co2", label: "CO₂", unit: "t CO₂e", d: 1, Icon: Cloud },
  { k: "energy", label: "Energy", unit: "GJ", d: 0, Icon: Zap },
  { k: "water", label: "Water", unit: "m³", d: 0, Icon: Droplets },
  { k: "waste", label: "Waste", unit: "t", d: 1, Icon: Trash2 },
];

const Compare = () => {
  const [metal, setMetal] = useState("Aluminium");
  const [tonnes, setTonnes] = useState(1000);
  const [scrap, setScrap] = useState(50);
  const [mode, setMode] = useState("Truck");
  const [collection, setCollection] = useState(MCI_DEFAULTS.Aluminium.collection);
  useEffect(() => setCollection(MCI_DEFAULTS[metal].collection), [metal]);
  const [showTable, setShowTable] = useState(false);   // exact-numbers table is folded until asked for
  const [pick, setPick] = useState("co2");   // indicator shown in the bar race (also set by clicking a table row)

  const scenarios = useMemo(() => {
    const td = { mineToRefinery: 500, refineryToSmelter: 300, smelterToMarket: 200 };
    const eff = MCI_DEFAULTS[metal].efficiency;
    return [
      { key: "conv", name: "Conventional", sub: "100% primary ore", color: C.orange, route: "Primary", share: 0 },
      { key: "hyb", name: "Hybrid", sub: `${scrap}% scrap`, color: C.blue, route: "Hybrid", share: scrap / 100 },
      { key: "circ", name: "Circular", sub: "100% recycled", color: C.aqua, route: "Recycled", share: 1 },
    ].map((s) => {
      const k = lcaEngine.calculate({ metal, route: s.route, scrapFraction: scrap, weightKg: tonnes * 1000, transportDistances: td, transportMode: mode }).keyIndicators;
      return {
        ...s, energy: k.totalEnergy, co2: k.totalCO2e / 1000, water: k.totalWater, waste: k.totalWaste / 1000,
        mci: computeMCI({ Fr: s.share, Cr: collection, Ec: eff, Ef: eff }).MCI,
      };
    });
  }, [metal, tonnes, scrap, mode, collection]);

  const [conv, , circ] = scenarios;
  // CO2 saved by going fully circular, for every metal at the same settings -> "which metal gains most"
  const byMetal = useMemo(() => METALS.map((m) => {
    const td = { mineToRefinery: 500, refineryToSmelter: 300, smelterToMarket: 200 };
    const co2 = (route) => lcaEngine.calculate({ metal: m, route, scrapFraction: 0, weightKg: tonnes * 1000, transportDistances: td, transportMode: mode }).keyIndicators.totalCO2e / 1000;
    const p = co2("Primary"), r = co2("Recycled");
    return { metal: m, pct: p > 0 ? ((p - r) / p) * 100 : 0, saved: p - r };
  }), [tonnes, mode]);
  const cur = PICK.find((x) => x.k === pick);
  const maxPick = Math.max(...scenarios.map((s) => s[pick]), 1e-9);
  const saving = (k) => (conv[k] > 0 ? ((conv[k] - circ[k]) / conv[k]) * 100 : 0);

  const rows = [
    { label: "Energy", unit: "GJ", k: "energy", d: 0, lower: true },
    { label: "Carbon footprint", unit: "t CO₂e", k: "co2", d: 1, lower: true },
    { label: "Water use", unit: "m³", k: "water", d: 0, lower: true },
    { label: "Solid waste", unit: "t", k: "waste", d: 1, lower: true },
    { label: "Circularity score (MCI)", unit: "0–1", k: "mci", d: 2 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2"><GitCompare className="h-7 w-7 text-green-600" />Conventional vs Circular</h1>
          <p className="text-gray-600 max-w-3xl">The same order made from ore, from a mix, and from scrap.</p>
        </div>

        <Card className="bg-white shadow-sm border border-gray-200 mb-6">
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-sm text-gray-700 col-span-2 md:col-span-1">Metal
              <div className="mt-1 grid grid-cols-2 gap-1">
                {METALS.map((m) => (
                  <button key={m} type="button" onClick={() => setMetal(m)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${metal === m ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-green-50"}`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: metal === m ? "#fff" : METAL_DOT[m] }} />{m}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-sm text-gray-700">Quantity (tonnes)
              <input type="number" min="1" className={inputCls} value={tonnes} onChange={(e) => setTonnes(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label className="text-sm text-gray-700">Hybrid scrap share: {scrap}%
              <input type="range" min="5" max="95" step="5" className="w-full accent-green-600 mt-2" value={scrap} onChange={(e) => setScrap(Number(e.target.value))} />
            </label>
            <label className="text-sm text-gray-700">Transport mode
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>{["Truck", "Rail", "Sea"].map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            <label className="text-sm text-gray-700">End-of-life collection: {Math.round(collection * 100)}%
              <input type="range" min="0" max="1" step="0.01" className="w-full accent-green-600 mt-2" value={collection} onChange={(e) => setCollection(Number(e.target.value))} />
            </label>
          </CardContent>
        </Card>

        {/* headline */}
        <div className="rounded-2xl bg-green-50 border border-green-200 p-5 mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <Leaf className="h-10 w-10 text-green-600 shrink-0 ef-float" />
          <div>
            <p className="text-lg text-gray-900">
              Making {n(tonnes, 0)} t of {metal.toLowerCase()} the circular way saves <b className="text-green-700"><Num value={conv.co2 - circ.co2} format={(v) => n(v)} /> t CO₂e ({saving("co2").toFixed(0)}%)</b>,{" "}
              <b><Num value={conv.energy - circ.energy} format={(v) => n(v, 0)} /> GJ of energy ({saving("energy").toFixed(0)}%)</b> and <b><Num value={conv.water - circ.water} format={(v) => n(v, 0)} /> m³ of water ({saving("water").toFixed(0)}%)</b>.
            </p>
            <p className="text-sm text-gray-600 mt-1">≈ yearly electricity CO₂ of <Num value={(conv.co2 - circ.co2) / (1.2 * 0.7117)} format={(v) => n(v, 0)} /> Indian homes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* bar race: one indicator, three ways of making the order */}
          <Card className="bg-white shadow-sm border border-gray-200 lg:col-span-2">
            <CardHeader className="pb-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">See the difference</CardTitle>
                <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
                  {PICK.map(({ k, label, Icon }) => (
                    <button key={k} type="button" onClick={() => setPick(k)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${pick === k ? "bg-green-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-2">
              {scenarios.map((s) => {
                const share = (s[pick] / maxPick) * 100;
                return (
                  <div key={s.key}>
                    <div className="flex items-baseline justify-between text-sm mb-0.5">
                      <span className="font-medium text-gray-900">{s.name} <span className="text-xs font-normal text-gray-500">{s.sub}</span></span>
                      <span className="tabular-nums font-semibold text-gray-900"><Num value={s[pick]} format={(v) => n(v, cur.d)} /> <span className="text-xs font-normal text-gray-500">{cur.unit}</span></span>
                    </div>
                    <div className="h-5 rounded-md bg-gray-100 overflow-hidden">
                      <div className="ef-bar h-full rounded-md flex items-center justify-end pr-2 text-[11px] font-semibold text-white"
                           style={{ width: `${Math.max(2, share)}%`, background: s.color }}>
                        {share >= 12 ? `${Math.round(share)}%` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-1.5">
                Circular uses <b>{Math.round(saving(pick))}% less {cur.label === "CO₂" ? "CO₂" : cur.label.toLowerCase()}</b> than conventional for the same {n(tonnes, 0)} t.
              </p>
            </CardContent>
          </Card>

          {/* which metal gains most: click a metal to switch */}
          <Card className="bg-white shadow-sm border border-gray-200">
            <CardHeader className="pb-1"><CardTitle className="text-base">Which metal gains most?</CardTitle>
              <p className="text-xs text-gray-500">CO₂ cut by going 100% recycled. Click a metal.</p></CardHeader>
            <CardContent className="space-y-1 pt-1">
              {[...byMetal].sort((a, b) => b.pct - a.pct).map((m) => (
                <button key={m.metal} type="button" onClick={() => setMetal(m.metal)}
                        className={`w-full text-left rounded-lg px-2 py-1 transition-colors ${metal === m.metal ? "bg-green-50 ring-1 ring-green-300" : "hover:bg-gray-50"}`}>
                  <div className="flex justify-between text-sm"><span className={metal === m.metal ? "font-semibold text-gray-900" : "text-gray-700"}>{m.metal}</span>
                    <span className="tabular-nums font-semibold text-green-700">−{Math.round(m.pct)}%</span></div>
                  <div className="h-2 mt-0.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="ef-bar h-full rounded-full bg-green-600" style={{ width: `${m.pct}%` }} />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* circularity score: the three gauges side by side in one short row */}
        <Card className="bg-white shadow-sm border border-gray-200 mb-6">
          <CardHeader className="pb-0"><CardTitle className="text-base">Circularity score (MCI)</CardTitle>
            <p className="text-xs text-gray-500">0 = fully linear, 1 = fully circular. End-of-life collection {Math.round(collection * 100)}%.</p></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 pt-2 pb-4">
            {scenarios.map((s) => (
              <div key={s.key} className="text-center">
                <div className="mx-auto w-full max-w-[150px]"><Gauge value={s.mci} size={150} /></div>
                <p className="font-medium text-gray-900 text-sm flex items-center justify-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</p>
                <p className="text-xs text-gray-500">{s.sub}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-white shadow-sm border border-gray-200 lg:col-span-3 h-fit">
            <CardHeader className="pb-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Side-by-side results</CardTitle>
                <button type="button" onClick={() => setShowTable((v) => !v)}
                        className="flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100">
                  {showTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{showTable ? "Hide exact numbers" : "Show exact numbers"}
                </button>
              </div>
              {showTable && <p className="text-xs text-gray-500">Click a row to show it in the bars above.</p>}
              {!showTable && <p className="text-sm text-gray-600">Circular vs conventional: energy <b className="text-green-700">−{Math.round(saving("energy"))}%</b> · CO₂ <b className="text-green-700">−{Math.round(saving("co2"))}%</b> · water <b className="text-green-700">−{Math.round(saving("water"))}%</b> · waste <b className="text-green-700">−{Math.round(saving("waste"))}%</b></p>}
            </CardHeader>
            {showTable && <CardContent className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-medium">Indicator</th>
                  {scenarios.map((s) => (
                    <th key={s.key} className="py-2 pr-3 font-medium">
                      <span className="flex items-center gap-1.5 text-gray-900"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                      <span className="text-xs font-normal">{s.sub}</span>
                    </th>
                  ))}
                  <th className="py-2 font-medium">Circular vs conventional</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const diff = r.lower ? -saving(r.k) : circ[r.k] - conv[r.k];
                    return (
                      <tr key={r.k} onClick={() => PICK.some((x) => x.k === r.k) && setPick(r.k)}
                          className={`border-b last:border-0 ${PICK.some((x) => x.k === r.k) ? "cursor-pointer" : ""} ${pick === r.k ? "bg-green-50/70" : ""}`}>
                        <td className="py-2 pr-3 text-gray-700">{r.label} <span className="text-gray-400">({r.unit})</span></td>
                        {scenarios.map((s) => <td key={s.key} className={`py-2 pr-3 ${s.key === "circ" ? "font-semibold text-green-800 bg-green-50/60" : ""}`}><Num value={s[r.k]} format={(v) => n(v, r.d)} /></td>)}
                        <td className={`py-2 font-medium ${(r.lower ? diff < 0 : diff > 0) ? "text-green-700" : "text-gray-600"}`}>
                          {r.lower ? `${diff.toFixed(0)}%` : `${diff >= 0 ? "+" : ""}${n(diff, r.d)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-3">Cradle-to-gate, cited factors.</p>
            </CardContent>}
          </Card>

        </div>

      </div>
    </div>
  );
};

export default Compare;
