// [35] INDIA PAGE - only the main things: three key numbers (national output,
//      its CO2, and what 10% more scrap would save) and the map of the 44 biggest plants and mines.
import React, { useEffect, useState } from "react";
import { MapPin, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import Num from "../components/Num";
import { lcaEngine } from "../data/lcaEngine";
import IndiaMap from "./IndiaMap";
import RefreshButton from "../components/RefreshButton";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const n = (v, d = 1) => Number(v).toLocaleString("en-IN", { maximumFractionDigits: d });
const INDIA_STEEL_AVG = 2.54;   // t CO2 per t crude steel, Ministry of Steel, Rajya Sabha Q.1429 (06-12-2024)

const Tile = ({ label, value, sub }) => (
  <div className="ef-lift rounded-xl bg-white border border-gray-200 p-4">
    <p className="text-xs font-medium text-gray-500">{label}</p>
    <p className="text-2xl font-semibold text-gray-900">{value}</p>
    <p className="text-xs text-gray-500">{sub}</p>
  </div>
);

const SectionTitle = ({ children }) => <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-2">{children}</h2>;

const India = () => {
  const [prod, setProd] = useState([]);
  const [error, setError] = useState(null);
  const [mapKey, setMapKey] = useState(0);   // bump to reload the embedded map
  const [share, setShare] = useState(10);      // % more output from scrap, set with the slider
  const [trend, setTrend] = useState(false);   // national production trend charts, folded by default
  const loadAll = async () => {
    try {
      const p = await fetch(`${BACKEND}/api/india-production`).then((r) => r.json());
      if (p.success) setProd(p.rows);
      setError(null);
      return true;
    } catch (e) {
      setError("Backend not reachable, so production data is missing. Start the backend, then press Refresh.");
      return false;
    }
  };
  useEffect(() => { loadAll(); }, []);
  const refresh = async () => { const ok = await loadAll(); setMapKey((k) => k + 1); return ok; };

  const latest = (metal) => { const rows = prod.filter((r) => r.metal === metal); return rows[rows.length - 1]; };
  const lastFull = (metal) => { const rows = prod.filter((r) => r.metal === metal && !r.fiscal_year.includes("(")); return rows[rows.length - 1]; };
  const steel = latest("Crude Steel"), alu = lastFull("Aluminium (Primary)");
  const b = lcaEngine.baseData;
  // CO2 avoided if this share of national output came from scrap instead of ore
  const cut = (rows, metal) => (rows ? (share / 100) * rows.production_million_tonnes * (b[metal].Primary.co2e - b[metal].Recycled.co2e) : 0);
  const totalNow = steel && alu ? steel.production_million_tonnes * INDIA_STEEL_AVG + alu.production_million_tonnes * b.Aluminium.Primary.co2e : 0;
  const saved = cut(steel, "Steel") + cut(alu, "Aluminium");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2"><MapPin className="h-7 w-7 text-green-600" />India: metals, emissions and circularity</h1>
            <p className="text-gray-600 max-w-3xl">National footprint, plants and mines, and what would cut it.</p>
          </div>
          <RefreshButton onRefresh={refresh} />
        </div>
        {error && <div className="p-3 mb-6 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <Tile label={`Steel made ${steel ? steel.fiscal_year : ""}`} value={steel ? <><Num value={steel.production_million_tonnes} format={(v) => n(v)} /> Mt</> : "–"}
                sub={steel ? `≈ ${n(steel.production_million_tonnes * INDIA_STEEL_AVG, 0)} Mt CO₂ (× ${INDIA_STEEL_AVG} t/t, Ministry of Steel)` : ""} />
          <Tile label={`Aluminium made ${alu ? alu.fiscal_year : ""}`} value={alu ? <><Num value={alu.production_million_tonnes} format={(v) => n(v, 2)} /> Mt</> : "–"}
                sub={alu ? `≈ ${n(alu.production_million_tonnes * b.Aluminium.Primary.co2e, 0)} Mt CO₂ (× 16.1 t/t, IAI)` : ""} />
          {/* what-if tile: drag the slider and the national saving rolls to the new value */}
          <div className="ef-lift rounded-xl bg-green-50 border border-green-200 p-4">
            <p className="text-xs font-medium text-green-800">If <b>{share}%</b> more came from scrap</p>
            <p className="text-2xl font-semibold text-green-800">{steel && alu ? <>−<Num value={saved} format={(v) => n(v, 0)} /> Mt CO₂/yr</> : "–"}</p>
            <input type="range" min="0" max="50" step="5" value={share} onChange={(e) => setShare(Number(e.target.value))}
                   className="w-full mt-2" aria-label="Share of output from scrap" />
            <p className="text-xs text-green-800/80 mt-1">{steel && alu ? <>steel {n(cut(steel, "Steel"), 0)} + aluminium {n(cut(alu, "Aluminium"), 1)} Mt · {totalNow ? Math.round((saved / totalNow) * 100) : 0}% of their CO₂</> : ""}</p>
          </div>
        </div>

        <SectionTitle>Where the plants and mines are</SectionTitle>
        <IndiaMap key={mapKey} embedded showTrend={trend} />

        <button type="button" onClick={() => setTrend((t) => !t)}
                className="mt-6 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100">
          <TrendingUp className="h-4 w-4" />{trend ? "Hide national production trend" : "Show national production trend"}
          {trend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

      </div>
    </div>
  );
};

export default India;
