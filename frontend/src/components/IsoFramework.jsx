// [28] ISO 14040/14044 CARD - lays the current calculation out in the four ISO phases (goal & scope, inventory,
//      impact assessment, interpretation) and downloads it as a structured LCA report (PDF).
import React from "react";
import { jsPDF } from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { ClipboardList, Download } from "lucide-react";
import { findHotspots, hotspotAdvice, cradleToGrave, scrapLever } from "../data/lifecycle";
import { computeMCI, mciBand } from "../data/mci";
import { CEA_GRID_FACTOR_TCO2_PER_MWH } from "../data/lcaEngine";
import { PROBLEM_STATEMENT } from "../data/project";

const n = (v, d = 1) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: d });

// everything the card and the PDF need, built once from the calculator state
export function buildIsoReport(inputData, results, lifecycle) {
  const t = inputData.weightKg / 1000;
  const k = results.keyIndicators;
  const grave = lifecycle.boundary === "grave";
  const cg = cradleToGrave({ ...inputData, gateKg: k.totalCO2e, ...lifecycle });
  const hot = findHotspots(results.stageBreakdown?.co2e);
  const top = hot[0];
  const mci = computeMCI({ Fr: cg.Fr, Cr: lifecycle.collection, Ec: lifecycle.efficiency, Ef: lifecycle.efficiency }).MCI;
  const td = inputData.transportDistances;
  const km = td.mineToRefinery + td.refineryToSmelter + td.smelterToMarket;
  const routeText = inputData.route === "Hybrid" ? `hybrid route (${inputData.scrapFraction}% scrap)` : `${inputData.route.toLowerCase()} route`;
  const gwp = grave ? cg.net : cg.production;

  return {
    phases: [
      { title: "1. Goal & scope", items: [
        ["Goal", `Carbon, energy and water footprint of ${n(t, 2)} t of ${inputData.metal.toLowerCase()} made by the ${routeText}, and how to make it more circular.`],
        ["Functional unit", "1 tonne of finished metal (results also shown for the whole order)"],
        ["System boundary", grave ? "Cradle-to-grave: extraction → processing → manufacturing → distribution → use → end of life & recycling" : "Cradle-to-gate: extraction → processing → manufacturing → distribution"],
        ["End-of-life method", "worldsteel net-scrap method (EN 15804 Module D)"],
      ] },
      { title: "2. Life cycle inventory (LCI)", items: [
        ["Energy", `${n(k.totalEnergy)} GJ (${n(k.totalEnergy / t)} GJ/t)`],
        ["Water", `${n(k.totalWater ?? 0, 1)} m³ (${n((k.totalWater ?? 0) / t)} m³/t)`],
        ["Solid waste", `${n(k.totalWaste / 1000, 2)} t`],
        ["Transport", `${n(km, 0)} km, mine→refinery by ${inputData.transportMode.toLowerCase()}`],
        ["Electricity factor", `${CEA_GRID_FACTOR_TCO2_PER_MWH} t CO₂/MWh (CEA v21.0, FY2024-25)`],
        ["Data sources", "IAI, worldsteel, ICA, Ehrenberger 2013, DEFRA/GLEC, CEA"],
      ] },
      { title: "3. Impact assessment (LCIA)", items: [
        ["Climate change (GWP100)", `${n(gwp, 2)} t CO₂e (${n(gwp / t, 2)} t CO₂e per tonne)`],
        ...(grave ? [["Of which production", `${n(cg.production, 2)} t CO₂e; recycling credit −${n(cg.credit, 2)} t`]] : []),
        ["Energy demand", `${n(k.totalEnergy / t)} GJ per tonne`],
        ["Water use", `${n((k.totalWater ?? 0) / t)} m³ per tonne`],
        ["Circularity (MCI)", `${mci.toFixed(2)} (${mciBand(mci).label.toLowerCase()})`],
      ] },
      { title: "4. Interpretation", items: [
        ["Hotspot", top ? `${top.stage}: ${Math.round(top.share * 100)}% of production CO₂` : "-"],
        ["Main recommendation", top ? hotspotAdvice(top.stage).action : "-"],
        ["Circular lever", `Each +10% scrap saves about ${n(scrapLever(inputData.metal, inputData.weightKg) / 1000, 2)} t CO₂e for this order.`],
        ["Data quality", "Preliminary comparison with published Tata Steel, Vedanta, Hindalco, Ministry of Steel and IAI averages (average gap 8.8%, see AI & Validation)."],
        ["Limitations", "Global average factors with India's grid; plant-specific data will improve accuracy."],
      ] },
    ],
    stages: hot, grave, cg, mci, t,
  };
}

function downloadPdf(inputData, rep) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16;
  let y = M;
  const line = (txt, size = 10, bold = false, color = 60) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color);
    const lines = doc.splitTextToSize(txt, W - 2 * M);
    if (y + lines.length * size * 0.45 > 285) { doc.addPage(); y = M; }
    doc.text(lines, M, y); y += lines.length * size * 0.45 + 1.5;
  };
  const clean = (s) => s.replace(/₂/g, "2").replace(/³/g, "3").replace(/→/g, "->").replace(/−/g, "-");

  line("EcoForge - Life Cycle Assessment Report", 18, true, 20);
  line(PROBLEM_STATEMENT, 10, false, 90);
  line(`Prepared to the ISO 14040/14044 structure  |  ${new Date().toLocaleString("en-IN")}`, 9, false, 110);
  y += 3;
  rep.phases.forEach((p) => {
    y += 2; line(p.title, 13, true, 20);
    p.items.forEach(([k, v]) => line(`${k}: ${clean(v)}`, 10));
  });
  y += 3; line("Production CO2 by life-cycle stage", 13, true, 20);
  rep.stages.forEach((s) => line(`${s.stage}: ${(s.kg / 1000).toFixed(3)} t CO2e (${Math.round(s.share * 100)}%)`, 10));
  if (rep.grave) {
    y += 3; line("Cradle-to-grave breakdown (t CO2e)", 13, true, 20);
    const c = rep.cg;
    [["Production", c.production], ["Use phase", c.use], ["End-of-life collection & shredding", c.eolProcessing],
     ["Landfill", c.landfill], ["Recycling credit (net scrap)", -c.credit], ["Total", c.net]]
      .forEach(([k, v]) => line(`${k}: ${v.toFixed(3)}`, 10));
  }
  y += 4;
  line("Method: process-based LCA, functional unit 1 t of metal. Factors: IAI 2022, worldsteel 2021, ICA 2021, Ehrenberger 2013; " +
       "freight DEFRA/GLEC; India grid CEA v21.0. Circularity: Ellen MacArthur Foundation MCI.", 8, false, 120);
  doc.save(`EcoForge_LCA_${inputData.metal}_${inputData.route}.pdf`);
}

const IsoFramework = ({ inputData, results, lifecycle }) => {
  const rep = buildIsoReport(inputData, results, lifecycle);
  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-gray-800"><ClipboardList className="h-5 w-5 text-green-600" />ISO 14040/14044 assessment</CardTitle>
          <Button onClick={() => downloadPdf(inputData, rep)} className="bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" />Download LCA report (PDF)
          </Button>
        </div>
        <p className="text-sm text-gray-500">Your result in the four ISO phases.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {rep.phases.map((p, i) => (
            <div key={p.title} className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-green-700">Phase {i + 1} of 4</p>
              <p className="font-semibold text-gray-900 mb-2">{p.title.slice(3)}</p>
              <dl className="space-y-1.5 text-sm">
                {p.items.map(([k, v]) => (
                  <div key={k}><dt className="text-gray-500 text-xs">{k}</dt><dd className="text-gray-800">{v}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default IsoFramework;
