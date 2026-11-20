// [25] HOTSPOT FINDER - shows which life-cycle stage causes most of the CO2 for the current inputs,
//      the top contributors, and what to change to cut it.
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Flame, Lightbulb } from "lucide-react";
import { findHotspots, hotspotAdvice } from "../data/lifecycle";

const kgOrT = (kg) => (kg >= 1000 ? `${(kg / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} t` : `${Math.round(kg).toLocaleString("en-IN")} kg`);

const HotspotFinder = ({ results, inputData }) => {
  const [picked, setPicked] = useState(null);   // stage the user clicked; default = the biggest one
  const groups = findHotspots(results.stageBreakdown?.co2e).filter((g) => g.kg > 0);   // hide stages not used by this route
  if (!groups.length) return null;
  const top = groups.find((g) => g.stage === picked) || groups[0];
  const advice = hotspotAdvice(top.stage);
  const saving = top.kg * advice.cut;

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><Flame className="h-5 w-5 text-red-600" />Emission hotspots</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`rounded-xl border p-4 mb-4 ${top === groups[0] ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"}`}>
          <p className="text-gray-900" title={advice.why}>
            <span className="font-semibold">{top.stage}</span> = <span className="font-semibold">{Math.round(top.share * 100)}%</span> of
            the CO₂ <span className="text-gray-600">({kgOrT(top.kg)} of {kgOrT(groups.reduce((a, g) => a + g.kg, 0))})</span>
          </p>
        </div>

        <div className="space-y-1">
          {groups.map((g, i) => (
            <button key={g.stage} type="button" onClick={() => setPicked(g.stage)} title="Click to see how to cut this stage"
                    className={`w-full grid grid-cols-12 items-center gap-3 text-sm text-left rounded-lg px-2 py-1 -mx-2 transition-colors ${g === top ? "bg-gray-100" : "hover:bg-gray-50"}`}>
              <span className={`col-span-4 sm:col-span-3 ${g === top ? "font-semibold text-gray-900" : "text-gray-700"}`}>{g.stage}</span>
              <div className="col-span-6 sm:col-span-7 h-3 rounded-full bg-gray-100 overflow-hidden" role="img" aria-label={`${g.stage} ${Math.round(g.share * 100)}%`}>
                <div className="ef-bar h-full rounded-full" style={{ width: `${Math.max(1, g.share * 100)}%`, background: i === 0 ? "#d03b3b" : "#2a78d6" }} />
              </div>
              <span className="col-span-2 text-right tabular-nums text-gray-700">{Math.round(g.share * 100)}%</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-900">
            <p className="flex items-start gap-1.5"><Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
              <span><b>Fix:</b> {advice.action.replace(/\.$/, "")} <b className="whitespace-nowrap">→ save ≈ {kgOrT(saving)}</b></span></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HotspotFinder;
