// [13] INDIA MAP (shown inside the India page) - major steel, aluminium and copper plants and mining regions of India,
//      with estimated CO2 per plant, state totals, recycling savings and national production trends.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { MapPin, Loader2, AlertTriangle, RotateCcw, Factory, Pickaxe, ZoomIn, ZoomOut } from "lucide-react";
import { Chart, C, axis, layout } from "../components/Plot";
import india from "../data/india_states.json";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const W = 560, H = 640;
const METAL_COLOR = { Steel: C.blue, Aluminium: C.orange, Copper: C.aqua };
const LOW = "#cfe0f5", HIGH = "#123f86";   // state CO2 colour scale
// primary vs recycled cradle-to-gate t CO2e per tonne (data/lca_emission_factors.csv)
const GWP = { Steel: [2.19, 0.67], Aluminium: [16.1, 0.55], Copper: [3.83, 0.8] };
const STATE_NAME = {
  "Arunanchal Pradesh": "Arunachal Pradesh", "Andaman & Nicobar Island": "Andaman & Nicobar Islands",
  "Jammu & Kashmir": "Jammu & Kashmir and Ladakh", "Dadara & Nagar Havelli": "Dadra & Nagar Haveli",
};
const isMine = (s) => /mine/i.test(s.type);

// d3 needs clockwise outer rings; flip any polygon that would otherwise cover the whole globe
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
const projection = d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], rewound);
const pathGen = d3.geoPath(projection);

const Stat = ({ label, value, sub }) => (
  <div className="rounded-xl bg-white border border-gray-200 p-3">
    <p className="text-xs font-medium text-gray-500">{label}</p>
    <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
    {sub && <p className="text-xs text-gray-500">{sub}</p>}
  </div>
);

// defined once at module level: a component created inside render would remount the map on every update
const PageFrame = ({ children }) => (
  <div className="min-h-screen bg-gray-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div></div>
);

const IndiaMap = ({ embedded = false, showTrend = true }) => {
  const [sites, setSites] = useState([]);
  const [prod, setProd] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metals, setMetals] = useState({ Steel: true, Aluminium: true, Copper: true });
  const kind = "all";     // plants and mines both shown
  const shade = true;     // states always shaded by CO2
  const [selected, setSelected] = useState(null);
  const [pickedState, setPickedState] = useState(null);   // state clicked on the map or in the table
  const [siteScrap, setSiteScrap] = useState(30);          // % scrap used in the selected site's what-if
  const [allStates, setAllStates] = useState(false);       // state table: top 5 or all
  const [hover, setHover] = useState(null);
  const [t, setT] = useState(d3.zoomIdentity);
  const svgRef = useRef(null), boxRef = useRef(null), zoomRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch(`${BACKEND}/api/india-sites`).then((r) => r.json()),
          fetch(`${BACKEND}/api/india-production`).then((r) => r.json()),
        ]);
        if (a.success) setSites(a.sites); else setError(a.error);
        if (b.success) setProd(b.rows);
      } catch (e) {
        setError("Backend not reachable. Make sure the backend is running on port 8000.");
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const zoom = d3.zoom().scaleExtent([1, 8]).translateExtent([[0, 0], [W, H]]).on("zoom", (e) => setT(e.transform));
    zoomRef.current = zoom;
    d3.select(svgRef.current).call(zoom);
  }, []);
  // instant (no d3 transition): the animated version could stall and leave the map zoomed
  const resetZoom = () => {
    if (svgRef.current && zoomRef.current) d3.select(svgRef.current).call(zoomRef.current.transform, d3.zoomIdentity);
    setSelected(null); setHover(null); setPickedState(null);
    setMetals({ Steel: true, Aluminium: true, Copper: true });   // all metals back on
  };
  const zoomBy = (f) => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).call(zoomRef.current.scaleBy, f); };

  const shown = useMemo(() => sites.filter((s) => metals[s.metal] && (kind === "all" || (kind === "mines") === isMine(s))), [sites, metals, kind]);

  const byState = useMemo(() => {
    const m = {};
    shown.forEach((s) => {
      m[s.state] = m[s.state] || { state: s.state, sites: 0, co2: 0 };
      m[s.state].sites += 1; m[s.state].co2 += s.est_co2_mt || 0;
    });
    return Object.values(m).sort((a, b) => b.co2 - a.co2 || b.sites - a.sites);
  }, [shown]);
  const stateCo2 = useMemo(() => Object.fromEntries(byState.map((s) => [s.state, s.co2])), [byState]);
  const maxCo2 = Math.max(1, ...byState.map((s) => s.co2));
  const fill = d3.scaleSequential(d3.interpolateRgb(LOW, HIGH)).domain([0, Math.sqrt(maxCo2)]);   // sqrt so mid states are visible too

  const totalCo2 = shown.reduce((a, s) => a + (s.est_co2_mt || 0), 0);

  const radius = (s) => (isMine(s) ? 5 : 3.5 + Math.sqrt(s.capacity_mtpa || 0.3) * 2.1);
  const markers = useMemo(() => [...shown].sort((a, b) => radius(b) - radius(a)), [shown]);

  const tip = (e, s) => {
    const r = boxRef.current.getBoundingClientRect();
    setHover({ s, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const prodFig = (metal, label) => {
    const rows = prod.filter((r) => r.metal === metal);
    return {
      data: [{
        // "2025-26 (Apr-Feb)" -> "FY26*"
        type: "bar", x: rows.map((r) => `FY${r.fiscal_year.slice(5, 7)}${r.fiscal_year.includes("(") ? "*" : ""}`), y: rows.map((r) => r.production_million_tonnes),
        marker: { color: C.blue }, customdata: rows.map((r) => [r.fiscal_year, r.source]),
        hovertemplate: `%{customdata[0]}<br>%{y:.1f} Mt ${label}<br>%{customdata[1]}<extra></extra>`,
      }],
      layout: layout({ margin: { l: 48, r: 8, t: 8, b: 36 }, xaxis: axis(null, { type: "category" }), yaxis: axis("Million tonnes", { rangemode: "tozero" }) }),
    };
  };

  const sel = selected;
  const saving = sel && GWP[sel.metal] && sel.est_co2_mt ? sel.capacity_mtpa * (siteScrap / 100) * (GWP[sel.metal][0] - GWP[sel.metal][1]) : null;
  const stateRow = pickedState && byState.find((s) => s.state === pickedState);
  const stateSites = pickedState ? shown.filter((s) => s.state === pickedState).sort((a, b) => (b.est_co2_mt || 0) - (a.est_co2_mt || 0)) : [];

  // embedded = shown inside the India page, which supplies the page frame and title
  const Frame = embedded ? React.Fragment : PageFrame;

  return (
    <Frame>
      <div>
        <div className="mb-6">
          {!embedded && <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2"><MapPin className="h-7 w-7 text-green-600" />India Metals Map</h1>}
          {!embedded && <p className="text-gray-600 max-w-3xl">States shaded by estimated plant CO₂.</p>}
        </div>

        {/* filters in one row */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          {Object.keys(METAL_COLOR).map((m) => (
            <button key={m} onClick={() => setMetals((p) => ({ ...p, [m]: !p[m] }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${metals[m] ? "bg-white border-gray-400 text-gray-900" : "bg-gray-100 border-gray-200 text-gray-400"}`}>
              <span className="h-3 w-3 rounded-full" style={{ background: metals[m] ? METAL_COLOR[m] : "#d4d4d0" }} />{m}
            </button>
          ))}
        </div>

        {error && <div className="p-4 mb-4 rounded-lg bg-red-50 text-red-700 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5" />{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-white shadow-sm border border-gray-200 lg:col-span-2 h-fit">
            <CardContent className="p-3 relative" >
              {/* legend (above the map, always visible) */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-700 mb-2 px-1">
                <span className="flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" />circle = plant (size = capacity)</span>
                <span className="flex items-center gap-1.5"><Pickaxe className="h-3.5 w-3.5" />diamond = mine</span>
                <span className="flex items-center gap-1.5">state CO₂: 0
                  <span className="h-2.5 w-20 rounded" style={{ background: `linear-gradient(90deg,${LOW},${HIGH})` }} />{maxCo2.toFixed(0)} Mt/yr</span>
              </div>
              <div ref={boxRef} className="relative">
                {loading && <div className="absolute inset-0 flex items-center justify-center text-gray-500"><Loader2 className="h-5 w-5 mr-2 animate-spin" />Loading sites...</div>}
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mx-auto block cursor-grab active:cursor-grabbing select-none" style={{ maxHeight: "62vh" }} onMouseLeave={() => setHover(null)}>
                  <g transform={t.toString()}>
                    {rewound.features.map((f) => {
                      const name = f.properties.name, co2 = stateCo2[name] || 0;
                      return (
                        <path key={name} d={pathGen(f)} fill={shade && co2 > 0 ? fill(Math.sqrt(co2)) : "#eef1ec"}
                              stroke={pickedState === name ? "#16a34a" : "#8f9a92"} strokeWidth={(pickedState === name ? 2.5 : 0.6) / t.k} strokeLinejoin="round"
                              opacity={pickedState && pickedState !== name ? 0.45 : 1} style={{ cursor: "pointer" }}
                              onClick={() => setPickedState((p) => (p === name ? null : name))}>
                          <title>{`${STATE_NAME[name] || name}${co2 ? ` · ${co2.toFixed(1)} Mt CO₂/yr from plants shown` : ""}`}</title>
                        </path>
                      );
                    })}
                    {markers.map((s) => {
                      const [x, y] = projection([s.lon, s.lat]);
                      const r = radius(s) / t.k, active = sel?.name === s.name;
                      const common = {
                        fill: METAL_COLOR[s.metal], fillOpacity: (pickedState && s.state !== pickedState) ? 0.2 : s.status.startsWith("Closed") ? 0.35 : 0.85,
                        stroke: active ? "#0b0b0b" : "#ffffff", strokeWidth: (active ? 2.5 : 1.2) / t.k, style: { cursor: "pointer" },
                        onMouseMove: (e) => tip(e, s), onMouseLeave: () => setHover(null),
                        onClick: (e) => { e.stopPropagation(); setSelected(s); },
                      };
                      return isMine(s)
                        ? <rect key={s.name} x={x - r} y={y - r} width={2 * r} height={2 * r} transform={`rotate(45 ${x} ${y})`} {...common} />
                        : <circle key={s.name} cx={x} cy={y} r={r} {...common} />;
                    })}
                  </g>
                </svg>
                {hover && (
                  <div className="absolute pointer-events-none z-10 rounded-lg bg-white border border-gray-200 shadow-md px-3 py-2 text-xs"
                       style={{ left: Math.min(hover.x + 14, (boxRef.current?.clientWidth || 600) - 220), top: hover.y + 14, width: 210 }}>
                    <p className="font-semibold text-gray-900">{hover.s.name}</p>
                    <p className="text-gray-600">{hover.s.type} · {hover.s.state}</p>
                    {hover.s.capacity_mtpa && <p className="text-gray-800">{hover.s.capacity_mtpa} Mt/yr {hover.s.capacity_unit}</p>}
                    {hover.s.est_co2_mt && <p className="text-gray-800">≈ {hover.s.est_co2_mt} Mt CO₂/yr</p>}
                  </div>
                )}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  <Button variant="outline" size="sm" className="bg-white" onClick={resetZoom} title="Show all metals and all India again"><RotateCcw className="h-3.5 w-3.5 mr-1" />Reset</Button>
                  {[[ZoomIn, "Zoom in", 1.5], [ZoomOut, "Zoom out", 1 / 1.5]].map(([Icon, t, f]) => (
                    <button key={t} type="button" onClick={() => zoomBy(f)} title={t} aria-label={t}
                            className="h-8 w-8 rounded-lg bg-white border border-gray-300 shadow-sm flex items-center justify-center text-gray-700 hover:bg-green-50 hover:text-green-700">
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* one panel that changes: all states -> one state's sites -> one site (each with a Back link) */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Sites shown" value={shown.length} sub={`${shown.filter(isMine).length} mines`} />
              <Stat label="Est. plant CO₂" value={`${totalCo2.toFixed(0)} Mt`} sub="per year" />
            </div>

            <Card className={`bg-white shadow-sm ${sel || pickedState ? "border-2 border-green-300" : "border border-gray-200"}`}>
              <CardHeader className="pb-2">
                {(sel || pickedState) && (
                  <button type="button" className="text-xs font-medium text-green-700 hover:underline text-left"
                          onClick={() => (sel ? setSelected(null) : setPickedState(null))}>
                    ← {sel && pickedState ? (STATE_NAME[pickedState] || pickedState) : "All states"}
                  </button>
                )}
                <CardTitle className="text-base">
                  {sel ? sel.name : pickedState ? (STATE_NAME[pickedState] || pickedState) : "States by estimated plant CO₂"}
                </CardTitle>
                {!sel && pickedState && <p className="text-sm text-gray-600">{stateSites.length} sites · {stateRow?.co2 ? `${stateRow.co2.toFixed(1)} Mt CO₂/yr from plants` : "no plant CO₂ (mines only)"}</p>}
                {!sel && !pickedState && <p className="text-xs text-gray-500">Click a state (here or on the map) or a site.</p>}
              </CardHeader>
              <CardContent className="text-sm">
                {/* 1) all states */}
                {!sel && !pickedState && (
                  <>
                    <table className="w-full text-sm tabular-nums">
                      <thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 font-medium">State</th><th className="font-medium">Sites</th><th className="font-medium text-right">Mt CO₂/yr</th></tr></thead>
                      <tbody>{(allStates ? byState : byState.slice(0, 6)).map((s) => (
                        <tr key={s.state} onClick={() => setPickedState(s.state)} className="border-b last:border-0 cursor-pointer">
                          <td className="py-1.5">{s.state}</td><td>{s.sites}</td><td className="text-right">{s.co2 ? s.co2.toFixed(1) : "–"}</td></tr>
                      ))}</tbody>
                    </table>
                    {byState.length > 6 && (
                      <button type="button" onClick={() => setAllStates((v) => !v)} className="mt-2 text-sm font-medium text-green-700 hover:underline">
                        {allStates ? "Show top 6" : `Show all ${byState.length} states`}
                      </button>
                    )}
                  </>
                )}

                {/* 2) one state's sites */}
                {!sel && pickedState && (
                  <>
                    {!stateSites.length && <p className="text-gray-500">No sites of the selected metals here.</p>}
                    <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
                      {stateSites.map((s) => (
                        <li key={s.name}>
                          <button type="button" onClick={() => setSelected(s)}
                                  className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-50">
                            <span className="flex items-center gap-2 min-w-0"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: METAL_COLOR[s.metal] }} />
                              <span className="truncate">{s.name}</span></span>
                            <span className="text-xs text-gray-500 shrink-0">{s.est_co2_mt ? `${s.est_co2_mt} Mt` : "mine"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* 3) one site */}
                {sel && (
                  <>
                    <dl className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                      <dt className="text-gray-500">Operator</dt><dd className="text-gray-900">{sel.operator}</dd>
                      <dt className="text-gray-500">Type</dt><dd className="text-gray-900">{sel.type}</dd>
                      <dt className="text-gray-500">State</dt><dd className="text-gray-900">{sel.state}</dd>
                      {sel.capacity_mtpa && <><dt className="text-gray-500">Capacity</dt><dd className="text-gray-900">{sel.capacity_mtpa} Mt/yr {sel.capacity_unit}</dd></>}
                      {sel.est_co2_mt && <><dt className="text-gray-500">Est. CO₂</dt><dd className="text-gray-900">{sel.est_co2_mt} Mt/yr</dd></>}
                    </dl>
                    {saving && (
                      <div className="mt-3 rounded-lg bg-green-50 border border-green-100 p-3 text-green-800">
                        If <b>{siteScrap}%</b> came from scrap: avoid ≈ <b>{saving.toFixed(1)} Mt CO₂/yr</b>
                        <input type="range" min="10" max="80" step="5" value={siteScrap} onChange={(e) => setSiteScrap(Number(e.target.value))}
                               className="w-full mt-2" aria-label="Scrap share for this site" />
                        <p className="text-xs text-green-800/70 mt-1">{sel.capacity_mtpa} × {(siteScrap / 100).toFixed(2)} × ({GWP[sel.metal][0]} − {GWP[sel.metal][1]})</p>
                      </div>
                    )}
                    {isMine(sel) && <p className="mt-3 text-gray-600">Recycling a tonne of metal avoids mining fresh ore and its waste rock.</p>}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {showTrend && prod.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">National production trend</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[["Crude Steel", "crude steel"], ["Aluminium (Primary)", "aluminium"], ["Iron Ore", "iron ore"], ["Bauxite", "bauxite"]].map(([m, l]) => (
                <Card key={m} className="bg-white shadow-sm border border-gray-200">
                  <CardHeader className="pb-0"><CardTitle className="text-sm">{m}</CardTitle></CardHeader>
                  <CardContent className="pt-1"><Chart fig={prodFig(m, l)} height={220} /></CardContent>
                </Card>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Source: Ministry of Steel, Ministry of Mines, Indian Bureau of Mines. FY26 = 2025-26. * = part year (Apr–Feb), provisional.</p>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-6">
          Locations approximate; plant CO₂ = capacity × cited factor. Map: DataMeet (Survey of India based).
        </p>
      </div>
    </Frame>
  );
};

export default IndiaMap;
