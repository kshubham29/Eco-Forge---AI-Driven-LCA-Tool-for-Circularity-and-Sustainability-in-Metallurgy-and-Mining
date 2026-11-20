// [43] ROUTE PICKER (left panel) - switch "Real places in India" on, pick mine -> refinery -> smelter/plant -> market,
//      and the three distance boxes fill themselves (see data/routePlaces.js).
import React from "react";
import { MapPin } from "lucide-react";
import { ROUTE_STAGES, MARKETS, optionsFor, hasRealPlaces } from "../data/routePlaces";

const sel = "w-full h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500";

const RoutePicker = ({ metal, places, setPlaces, sites, error }) => {
  const on = !!places.on;
  const supported = hasRealPlaces(metal);
  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 p-2.5 space-y-2">
      <label className={`flex items-center gap-2 text-xs font-medium ${supported ? "text-green-800 cursor-pointer" : "text-gray-400"}`}>
        <input type="checkbox" className="accent-green-600 h-4 w-4" checked={on && supported} disabled={!supported}
               onChange={(e) => setPlaces({ on: e.target.checked })} />
        <MapPin className="h-3.5 w-3.5" />Real places in India
      </label>
      {!supported && <p className="text-[11px] text-gray-500">No Indian {metal.toLowerCase()} sites in our data. Type the km below.</p>}
      {on && supported && error && <p className="text-[11px] text-red-700">{error}</p>}
      {on && supported && !error && !sites.length && <p className="text-[11px] text-gray-500">Loading sites...</p>}
      {on && supported && sites.length > 0 && (
        <div className="space-y-1.5">
          {ROUTE_STAGES[metal].map(([key, label, re]) => (
            <label key={key} className="block text-[11px] text-gray-600">{label}
              <select className={sel} value={places[key] || ""} onChange={(e) => setPlaces((p) => ({ ...p, [key]: e.target.value }))}>
                {optionsFor(metal, re, sites).map((s) => <option key={s.name} value={s.name}>{s.name} ({s.state})</option>)}
              </select>
            </label>
          ))}
          <label className="block text-[11px] text-gray-600">Market city
            <select className={sel} value={places.market || "Delhi"} onChange={(e) => setPlaces((p) => ({ ...p, market: e.target.value }))}>
              {MARKETS.map((m) => <option key={m.name}>{m.name}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
};

export default RoutePicker;
