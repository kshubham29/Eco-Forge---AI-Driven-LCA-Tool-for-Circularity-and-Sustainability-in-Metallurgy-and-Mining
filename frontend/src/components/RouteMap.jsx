// [44] ROUTE MAP (Results tab) - draws the chosen real route on the India map: mine -> refinery -> smelter/plant -> market,
//      with the km of each leg and the transport CO2 those km cause. Shown only when "Real places in India" is on.
import React, { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Route, ZoomIn, ZoomOut, Crosshair, Map as MapIcon } from "lucide-react";
import india from "../data/india_states.json";
import { placePoints, roadKm, DETOUR } from "../data/routePlaces";
import { lcaEngine } from "../data/lcaEngine";

const W = 480, H = 440;
const STAGE_COLOR = { mine: "#b45309", refinery: "#7c3aed", smelter: "#dc2626", market: "#2563eb" };

// d3 needs clockwise outer rings (same fix as the India page map)
const rewound = {
  ...india,
  features: india.features.map((f) => ({
    ...f,
    geometry: {
      ...f.geometry,
      coordinates: f.geometry.coordinates.map((poly) =>
        d3.geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly),
    },
  })),
};

// "NALCO Damanjodi Refinery" -> "Damanjodi": drop company and facility words for the map label
const DROP = /^(nalco|hindalco|vedanta|sail|nmdc|jsw|tata|balco|utkal|indian|birla|kutch|sterlite|am\/ns|jspl|rinl|bauxite|iron|ore|copper|alumina|aluminium|steel|mine|mines|mining|belt|refinery|smelter|plant|complex|works|\(.*\))$/i;
const shortName = (n) => n.split(/\s+/).filter((w) => !DROP.test(w)).slice(0, 2).join(" ") || n;

const RouteMap = ({ metal, places, sites, inputData }) => {
  const pts = useMemo(() => placePoints(metal, places, sites), [metal, places, sites]);
  // zoom: view = "route" (fit the route) or "india" (whole country); k = extra zoom from the + / - buttons
  const [view, setView] = useState({ mode: "route", k: 1 });
  const routeKey = pts.map((p) => p.name).join(">");
  useEffect(() => setView({ mode: "route", k: 1 }), [routeKey]);   // new route -> fit it again
  if (!places.on || pts.length < 2) return null;

  // zoom to the route (with padding), so short legs like mine -> refinery are still visible
  const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat);
  const cx = (Math.min(...lons) + Math.max(...lons)) / 2, cy = (Math.min(...lats) + Math.max(...lats)) / 2;
  const routeHalf = Math.max(4, (Math.max(...lons) - Math.min(...lons)) * 0.65, (Math.max(...lats) - Math.min(...lats)) * 0.65);
  const [mx, my, baseHalf] = view.mode === "india" ? [82.8, 22.5, 16] : [cx, cy, routeHalf];
  const half = baseHalf / view.k;
  const zoomBy = (f) => setView((v) => ({ ...v, k: Math.min(8, Math.max(baseHalf / 20, v.k * f)) }));
  const projection = d3.geoMercator().fitExtent([[16, 16], [W - 16, H - 16]],
    { type: "MultiPoint", coordinates: [[mx - half, my - half], [mx + half, my + half]] });
  const pathGen = d3.geoPath(projection);
  const onRoute = new Set(rewound.features.filter((f) => pts.some((p) => d3.geoContains(f, [p.lon, p.lat]))).map((f) => f));
  const real = pts.map((p) => projection([p.lon, p.lat]));
  // pins that sit on top of each other are moved apart, with a thin line back to the true spot
  const xy = [];
  real.forEach((r, i) => {
    let q = [...r];
    while (xy.some((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) < 24)) q = [q[0] - 18, q[1] + 18];
    xy.push(q);
  });
  const legs = pts.slice(1).map((p, i) => ({ from: pts[i], to: p, km: roadKm(pts[i], p), a: xy[i], b: xy[i + 1] }));
  // shorten each leg so its arrow stops at the edge of the next pin
  const trim = (a, b, r) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [b[0] - ((b[0] - a[0]) * r) / d, b[1] - ((b[1] - a[1]) * r) / d]; };
  const totalKm = legs.reduce((s, l) => s + l.km, 0);
  // transport CO2 straight from the engine: this order minus the same order with 0 km (so it always matches Results)
  const zero = { mineToRefinery: 0, refineryToSmelter: 0, smelterToMarket: 0 };
  const transportT = (lcaEngine.calculate(inputData).keyIndicators.totalCO2e
    - lcaEngine.calculate({ ...inputData, transportDistances: zero }).keyIndicators.totalCO2e) / 1000;
  const recycled = inputData.route === "Recycled";

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><Route className="h-5 w-5 text-green-600" />Your route on the map</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
        <div className="md:col-span-3 relative w-full max-w-[520px] mx-auto">
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          {[[ZoomIn, "Zoom in", () => zoomBy(1.5)], [ZoomOut, "Zoom out", () => zoomBy(1 / 1.5)],
            [Crosshair, "Fit the route", () => setView({ mode: "route", k: 1 })], [MapIcon, "All India", () => setView({ mode: "india", k: 1 })]].map(([Icon, t, fn]) => (
            <button key={t} type="button" onClick={fn} title={t} aria-label={t}
                    className="h-8 w-8 rounded-lg bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-700 hover:bg-green-50 hover:text-green-700">
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-gray-200 bg-sky-50/60" role="img"
             aria-label={`Route: ${pts.map((p) => p.name).join(" to ")}, ${totalKm} km`}>
          <defs>
            <marker id="ef-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#15803d" />
            </marker>
            <clipPath id="ef-route-clip"><rect x="0" y="0" width={W} height={H} rx="12" /></clipPath>
          </defs>
          <g clipPath="url(#ef-route-clip)">
            {rewound.features.map((f, i) => (
              <path key={i} d={pathGen(f)} fill={onRoute.has(f) ? "#dcfce7" : "#f8fafc"} stroke="#94a3b8" strokeWidth="0.9" />
            ))}
            {rewound.features.filter((f) => onRoute.has(f)).map((f, i) => {
              const c = pathGen.centroid(f);
              return Number.isFinite(c[0]) && <text key={`s${i}`} x={c[0]} y={c[1]} textAnchor="middle" fontSize="11" fill="#166534" opacity="0.55" fontStyle="italic">{f.properties.name || ""}</text>;
            })}
            {legs.map((l, i) => (
              <g key={i}>
                <line x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#bbf7d0" strokeWidth="9" strokeLinecap="round" />
                <line x1={l.a[0]} y1={l.a[1]} x2={trim(l.a, l.b, 14)[0]} y2={trim(l.a, l.b, 14)[1]} stroke="#15803d" strokeWidth="3.5"
                      strokeDasharray="8 5" className="ef-dash" markerEnd="url(#ef-arrow)" />
                <text x={(l.a[0] + l.b[0]) / 2 + 8} y={(l.a[1] + l.b[1]) / 2 - 6} fontSize="12" fontWeight="700" fill="#15803d"
                      paintOrder="stroke" stroke="#fff" strokeWidth="4">{l.km.toLocaleString("en-IN")} km</text>
              </g>
            ))}
            {pts.map((p, i) => {
              const [x, y] = xy[i], moved = Math.hypot(x - real[i][0], y - real[i][1]) > 1, left = x > W - 150;
              return (
                <g key={p.key}>
                  {moved && <><line x1={real[i][0]} y1={real[i][1]} x2={x} y2={y} stroke="#64748b" strokeWidth="1" />
                    <circle cx={real[i][0]} cy={real[i][1]} r="2.5" fill="#64748b" /></>}
                  <circle cx={x} cy={y} r="11" fill={STAGE_COLOR[p.key]} stroke="#fff" strokeWidth="2.5" className="drop-shadow" />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{i + 1}</text>
                  <text x={x + (left ? -16 : 16)} y={y + 4} textAnchor={left ? "end" : "start"} fontSize="13" fontWeight="700" fill="#111827"
                        paintOrder="stroke" stroke="#fff" strokeWidth="4">{shortName(p.name)}</text>
                </g>
              );
            })}
          </g>
        </svg>
        </div>

        <div className="md:col-span-2 space-y-3">
          <ol className="space-y-2">
            {pts.map((p, i) => (
              <li key={p.key} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 shrink-0 rounded-full text-[11px] font-semibold text-white flex items-center justify-center" style={{ background: STAGE_COLOR[p.key] }}>{i + 1}</span>
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="text-xs text-gray-500">{p.label}{p.state ? ` · ${p.state}` : ""}</span>
                </div>
                {i < legs.length && <p className="ml-7 mt-1 text-xs text-green-700">↓ {legs[i].km.toLocaleString("en-IN")} km</p>}
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div><p className="text-xs text-gray-500">Total distance</p><p className="text-lg font-semibold text-gray-900">{totalKm.toLocaleString("en-IN")} km</p></div>
            <div><p className="text-xs text-gray-500">Transport CO₂ ({inputData.transportMode.toLowerCase()})</p>
              <p className="text-lg font-semibold text-gray-900">{recycled ? "not used" : transportT >= 1 ? `${transportT.toLocaleString("en-IN", { maximumFractionDigits: 1 })} t` : `${Math.round(transportT * 1000).toLocaleString("en-IN")} kg`}</p></div>
          </div>
          <p className="text-[11px] text-gray-400">Straight-line distance × {DETOUR} for roads and rail.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteMap;
