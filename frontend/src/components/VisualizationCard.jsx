// [6b] MATERIAL & ENERGY FLOW (primary and hybrid routes) - drawn from the calculator's stage results for the
//      chosen metal: ore chain (mining -> refining -> smelting -> casting) and, for hybrid, the scrap chain
//      (collection -> remelting) joining at casting. Line width = energy of the stage; grey lines = waste.
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Workflow } from "lucide-react";
import { stageGroup } from "../data/lifecycle";

const COL = { ore: "#2a78d6", scrap: "#1baf7a", market: "#52514e", waste: "#898781", hot: "#d03b3b" };
// fixed layout in a 680 x 265 viewBox (labels sit 32 px below each node), so nothing is ever cut off
const POS = {
  Mining: [60, 60], Refining: [200, 60], Smelting: [340, 60], "Casting & fabrication": [480, 100], Market: [620, 100],
  "Scrap collection": [200, 165], "Remelting (scrap)": [340, 165], Waste: [480, 210],
};
const LABEL = { "Casting & fabrication": "Casting", "Scrap collection": "Scrap", "Remelting (scrap)": "Remelting" };

const VisualizationCard = ({ stageBreakdown, inputData }) => {
  const groups = useMemo(() => {
    const g = {};
    const add = (list, key) => (list || []).forEach(({ stage, value }) => {
      const k = stageGroup(stage);
      g[k] = g[k] || { energy: 0, co2: 0, waste: 0 };
      g[k][key] += value || 0;
    });
    add(stageBreakdown?.energy, "energy"); add(stageBreakdown?.co2e, "co2"); add(stageBreakdown?.waste, "waste");
    return g;
  }, [stageBreakdown]);

  const has = (k) => groups[k] && (groups[k].energy > 0 || groups[k].co2 > 0);
  const flows = [
    ["Mining", "Refining"], ["Refining", "Smelting"], ["Smelting", "Casting & fabrication"],
    ["Scrap collection", "Remelting (scrap)"], ["Remelting (scrap)", "Casting & fabrication"],
    ["Casting & fabrication", "Market"],
  ].filter(([a, b]) => has(a) && (has(b) || b === "Market"));
  const nodes = [...new Set(flows.flat())];
  const wasteFrom = nodes.filter((k) => groups[k]?.waste > 0);
  const maxE = Math.max(...nodes.map((k) => groups[k]?.energy || 0), 1e-9);
  const maxW = Math.max(...wasteFrom.map((k) => groups[k].waste), 1e-9);
  const hot = nodes.filter((k) => groups[k]).sort((a, b) => groups[b].co2 - groups[a].co2)[0];
  const isScrap = (k) => k === "Scrap collection" || k === "Remelting (scrap)";
  const path = ([x1, y1], [x2, y2]) => `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
  const tons = (kg) => (kg / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const rows = Object.entries(groups).filter(([, v]) => v.energy > 0 || v.co2 > 0).sort((a, b) => b[1].co2 - a[1].co2);
  const totalCo2 = rows.reduce((s, [, v]) => s + v.co2, 0) || 1;

  const [showTable, setShowTable] = useState(false);

  return (
    <Card className="bg-white shadow-lg border-0 h-fit">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><Workflow className="h-5 w-5 text-blue-600" />Material & energy flow</CardTitle>
        <p className="text-sm text-gray-500">{inputData.metal}, {inputData.route.toLowerCase()} route. Line width = energy used; grey = waste. Hover for values.</p>
      </CardHeader>
      <CardContent>
        <svg viewBox="0 0 680 265" className="w-full h-auto max-h-[300px]" role="img" aria-label="Material and energy flow diagram">
          {flows.map(([a, b]) => (
            <path key={a + b} d={path(POS[a], POS[b])} fill="none" strokeLinecap="round" opacity="0.55"
                  stroke={isScrap(a) ? COL.scrap : COL.ore} strokeWidth={Math.max(2, ((groups[a]?.energy || 0) / maxE) * 26)}>
              <title>{`${LABEL[a] || a} → ${LABEL[b] || b}\nEnergy: ${(groups[a]?.energy || 0).toFixed(1)} GJ\nCO₂: ${tons(groups[a]?.co2 || 0)} t`}</title>
            </path>
          ))}
          {wasteFrom.map((k) => (
            <path key={"w" + k} d={path(POS[k], POS.Waste)} fill="none" stroke={COL.waste} opacity="0.35" strokeLinecap="round"
                  strokeWidth={Math.max(1.5, (groups[k].waste / maxW) * 12)}>
              <title>{`${LABEL[k] || k} → waste: ${tons(groups[k].waste)} t`}</title>
            </path>
          ))}
          {[...nodes, ...(wasteFrom.length ? ["Waste"] : [])].map((k) => {
            const [x, y] = POS[k];
            const fill = k === "Waste" ? COL.waste : k === "Market" ? COL.market : isScrap(k) ? COL.scrap : COL.ore;
            const g = groups[k];
            return (
              <g key={k}>
                <circle cx={x} cy={y} r="16" fill={fill} stroke={k === hot ? COL.hot : "#fff"} strokeWidth={k === hot ? 4 : 2}>
                  <title>{g ? `${LABEL[k] || k}\nEnergy: ${g.energy.toFixed(1)} GJ\nCO₂: ${tons(g.co2)} t\nWaste: ${tons(g.waste)} t` : k}</title>
                </circle>
                <text x={x} y={y + 32} textAnchor="middle" fontSize="12" fill="#0b0b0b" fontWeight="500">{LABEL[k] || k}</text>
                {k === hot && <text x={x} y={y - 24} textAnchor="middle" fontSize="11" fill={COL.hot} fontWeight="600">CO₂ hotspot</text>}
              </g>
            );
          })}
        </svg>

        <button onClick={() => setShowTable((v) => !v)} className="mt-1 text-sm font-medium text-blue-700 hover:underline">
          {showTable ? "Hide stage table" : "Show stage table"}
        </button>
        {showTable && <table className="w-full text-sm tabular-nums mt-2">
          <thead><tr className="text-left text-gray-500 border-b">{["Stage", "Energy GJ", "CO₂ t", "Share", "Waste t"].map((h) => <th key={h} className="py-1.5 font-medium">{h}</th>)}</tr></thead>
          <tbody>{rows.map(([k, v]) => (
            <tr key={k} className="border-b last:border-0">
              <td className={`py-1.5 ${k === hot ? "text-red-700 font-medium" : "text-gray-800"}`}>{k}</td>
              <td>{v.energy.toFixed(1)}</td><td>{tons(v.co2)}</td><td>{Math.round((v.co2 / totalCo2) * 100)}%</td><td>{tons(v.waste)}</td>
            </tr>
          ))}</tbody>
        </table>}
      </CardContent>
    </Card>
  );
};

export default VisualizationCard;
