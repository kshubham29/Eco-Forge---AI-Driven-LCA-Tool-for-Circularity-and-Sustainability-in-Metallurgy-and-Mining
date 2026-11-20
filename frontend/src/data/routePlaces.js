// [42] REAL ROUTE PLACES - lets the user pick a real Indian mine, refinery, smelter/plant and market city instead of typing
//      distances. Sites come from backend/data/india_metal_sites.csv (/api/india-sites, 44 sites with lat/lon).
//      Distance = straight-line (haversine) distance x 1.3 road/rail detour factor, rounded to 5 km. It is an estimate.
import { useEffect, useState } from "react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const DETOUR = 1.3;

// the chain of places for each metal; [key, label, which site types fit]
export const ROUTE_STAGES = {
  Aluminium: [["mine", "Bauxite mine", /bauxite mine/i], ["refinery", "Alumina refinery", /alumina refinery/i], ["smelter", "Smelter", /aluminium smelter/i]],
  Steel: [["mine", "Iron ore mine", /iron ore mine/i], ["smelter", "Steel plant", /integrated steel plant/i]],
  Copper: [["mine", "Copper mine", /copper mine/i], ["smelter", "Copper smelter", /copper smelter/i]],
};

export const MARKETS = [
  { name: "Delhi", lat: 28.61, lon: 77.21 }, { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Kolkata", lat: 22.57, lon: 88.36 }, { name: "Chennai", lat: 13.08, lon: 80.27 },
  { name: "Bengaluru", lat: 12.97, lon: 77.59 }, { name: "Hyderabad", lat: 17.39, lon: 78.49 },
  { name: "Ahmedabad", lat: 23.02, lon: 72.57 }, { name: "Pune", lat: 18.52, lon: 73.86 },
];

export const hasRealPlaces = (metal) => !!ROUTE_STAGES[metal];

// great-circle distance x detour, rounded to 5 km
export const roadKm = (a, b) => {
  const r = (d) => (d * Math.PI) / 180, R = 6371;
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(h)) * DETOUR) / 5) * 5;
};

export const optionsFor = (metal, re, sites) => sites.filter((s) => s.metal === metal && re.test(s.type));

// sensible starting route: first mine, then the nearest site for each next step, market = Delhi
export const defaultPlaces = (metal, sites) => {
  const stages = ROUTE_STAGES[metal];
  if (!stages || !sites.length) return null;
  const out = { market: "Delhi" };
  let prev = null;
  for (const [key, , re] of stages) {
    const opts = optionsFor(metal, re, sites);
    if (!opts.length) return null;
    const pick = prev ? opts.reduce((best, s) => (roadKm(prev, s) < roadKm(prev, best) ? s : best)) : opts[0];
    out[key] = pick.name; prev = pick;
  }
  return out;
};

// the chosen places in order, with coordinates
export const placePoints = (metal, places, sites) => {
  const stages = ROUTE_STAGES[metal];
  if (!stages || !places) return [];
  const pts = stages.map(([key, label]) => {
    const s = sites.find((x) => x.name === places[key]);
    return s && { key, label, name: s.name, state: s.state, lat: s.lat, lon: s.lon };
  });
  const m = MARKETS.find((x) => x.name === places.market);
  pts.push(m && { key: "market", label: "Market", name: m.name, lat: m.lat, lon: m.lon });
  return pts.every(Boolean) ? pts : [];
};

// the three calculator distance boxes. Steel and copper have no separate refinery, so that leg is 0 km.
export const routeDistances = (metal, places, sites) => {
  const p = placePoints(metal, places, sites);
  if (!p.length) return null;
  const by = Object.fromEntries(p.map((x) => [x.key, x]));
  return by.refinery
    ? { mineToRefinery: roadKm(by.mine, by.refinery), refineryToSmelter: roadKm(by.refinery, by.smelter), smelterToMarket: roadKm(by.smelter, by.market) }
    : { mineToRefinery: roadKm(by.mine, by.smelter), refineryToSmelter: 0, smelterToMarket: roadKm(by.smelter, by.market) };
};

// loads the 44 sites once, only when the user switches real places on
export const useIndiaSites = (active) => {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!active || sites.length) return;
    fetch(`${BACKEND}/api/india-sites`).then((r) => r.json())
      .then((d) => (d.success ? setSites(d.sites) : setError(d.error || "Could not load sites.")))
      .catch(() => setError("Backend not reachable, so real places can't load. Type the distances instead."));
  }, [active, sites.length]);
  return { sites, error };
};
