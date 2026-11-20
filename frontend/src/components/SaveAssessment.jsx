// [31] SAVE ASSESSMENT - saves the current Calculator result to the backend (/api/assessments) so it can be
//      tracked over time on the Reports page.
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Save, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { findHotspots, cradleToGrave } from "../data/lifecycle";
import { computeMCI } from "../data/mci";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const SaveAssessment = ({ inputData, results, lifecycle }) => {
  const [title, setTitle] = useState("");
  const [state, setState] = useState(null);   // null | saving | saved | error
  const [msg, setMsg] = useState("");

  const save = async () => {
    setState("saving");
    const k = results.keyIndicators;
    const td = inputData.transportDistances;
    const cg = cradleToGrave({ ...inputData, gateKg: k.totalCO2e, ...lifecycle });
    const top = findHotspots(results.stageBreakdown?.co2e)[0];
    const body = {
      title: title.trim(), metal: inputData.metal, route: inputData.route,
      scrap_pct: inputData.route === "Recycled" ? 100 : inputData.route === "Hybrid" ? inputData.scrapFraction : 0,
      weight_kg: inputData.weightKg, transport_km: td.mineToRefinery + td.refineryToSmelter + td.smelterToMarket,
      transport_mode: inputData.transportMode, boundary: lifecycle.boundary,
      energy_gj: k.totalEnergy, co2_kg: k.totalCO2e, co2_grave_kg: lifecycle.boundary === "grave" ? cg.net * 1000 : null,
      water_m3: k.totalWater ?? 0, waste_kg: k.totalWaste, recyclability: k.recyclability, closed_loop: k.closedLoopPotential,
      mci: computeMCI({ Fr: cg.Fr, Cr: lifecycle.collection, Ec: lifecycle.efficiency, Ef: lifecycle.efficiency }).MCI,
      hotspot: top?.stage || "", hotspot_share: top?.share || 0,
    };
    try {
      const r = await fetch(`${BACKEND}/api/assessments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
      if (r.success) { setState("saved"); setMsg(r.assessment.title); setTitle(""); } else { setState("error"); setMsg(r.error || "Could not save"); }
    } catch (e) {
      setState("error"); setMsg("Backend not reachable. Start the backend to save assessments.");
    }
  };

  return (
    <div className="flex flex-col items-stretch md:items-end gap-1.5">
      <div className="flex gap-2">
        <input value={title} onChange={(e) => { setTitle(e.target.value); setState(null); }} placeholder="Name this assessment (optional)"
               className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <Button onClick={save} disabled={state === "saving"} className="bg-green-600 hover:bg-green-700">
          {state === "saving" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save assessment
        </Button>
      </div>
      {state === "saved" && <p className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Saved “{msg}”. <Link to="/reports" className="underline">Track it in Reports</Link></p>}
      {state === "error" && <p className="text-xs text-red-700 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{msg}</p>}
    </div>
  );
};

export default SaveAssessment;
