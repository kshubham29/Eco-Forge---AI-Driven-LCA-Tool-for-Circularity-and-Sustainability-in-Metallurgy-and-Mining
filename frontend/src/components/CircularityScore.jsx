// [20] CIRCULARITY SCORE CARD - Material Circularity Indicator (MCI, Ellen MacArthur Foundation) for the
//      calculator inputs, with sliders for end-of-life collection, recycling efficiency and product lifetime.
import React, { useEffect, useMemo, useState } from "react";
import useCountUp from "../hooks/useCountUp";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Recycle } from "lucide-react";
import { computeMCI, mciBand, MCI_DEFAULTS, recycledShare } from "../data/mci";

const BAND_COLOR = { good: "#0ca30c", ok: "#2a78d6", warn: "#c98500", bad: "#d03b3b" };

export const Gauge = ({ value: target, size = 180 }) => {
  const value = useCountUp(target, 900, 0);
  const r = size / 2 - 14, cx = size / 2, cy = size / 2;
  const arc = (v) => {
    const a = Math.PI * (1 - v);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [x, y] = arc(Math.max(0.001, value));
  const band = mciBand(value);
  return (
    <svg viewBox={`0 0 ${size} ${size / 2 + 32}`} width="100%" style={{ maxWidth: size }} role="img" aria-label={`MCI ${value.toFixed(2)}`}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e1e0d9" strokeWidth="14" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`} fill="none" stroke={BAND_COLOR[band.tone]} strokeWidth="14" strokeLinecap="round" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="30" fontWeight="600" fill="#0b0b0b">{value.toFixed(2)}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="11" fill="#52514e">{band.label}</text>
      <text x={cx - r} y={cy + 27} textAnchor="middle" fontSize="10" fill="#898781">0</text>
      <text x={cx + r} y={cy + 27} textAnchor="middle" fontSize="10" fill="#898781">1</text>
    </svg>
  );
};

const Slider = ({ label, value, min, max, step, onChange, fmt }) => (
  <label className="block text-sm">
    <span className="flex justify-between text-gray-700"><span>{label}</span><span className="font-medium tabular-nums">{fmt(value)}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-green-600" />
  </label>
);

const CircularityScore = ({ inputData, lifecycle, setLifecycle }) => {
  const def = MCI_DEFAULTS[inputData.metal] || MCI_DEFAULTS.Aluminium;
  const [ownCollection, setOwnCollection] = useState(def.collection);
  const [ownEfficiency, setOwnEfficiency] = useState(def.efficiency);
  const [lifetime, setLifetime] = useState(1);
  useEffect(() => { setOwnCollection(def.collection); setOwnEfficiency(def.efficiency); }, [inputData.metal]);
  // on the Calculator the end-of-life sliders are shared with the cradle-to-grave card
  const collection = lifecycle ? lifecycle.collection : ownCollection;
  const efficiency = lifecycle ? lifecycle.efficiency : ownEfficiency;
  const setCollection = lifecycle ? (v) => setLifecycle((p) => ({ ...p, collection: v })) : setOwnCollection;
  const setEfficiency = lifecycle ? (v) => setLifecycle((p) => ({ ...p, efficiency: v })) : setOwnEfficiency;

  const Fr = recycledShare(inputData.route, inputData.scrapFraction);
  const res = useMemo(() => computeMCI({ Fr, Cr: collection, Ec: efficiency, Ef: efficiency, lifetime }), [Fr, collection, efficiency, lifetime]);
  const best = computeMCI({ Fr: 1, Cr: 0.95, Ec: efficiency, Ef: efficiency, lifetime });
  const pct = (v) => `${Math.round(v * 100)}%`;

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><Recycle className="h-5 w-5 text-green-600" />Circularity score (MCI)</CardTitle>
        <p className="text-sm text-gray-500">0 = fully linear, 1 = fully circular (Ellen MacArthur Foundation method).</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="flex flex-col items-center">
            <Gauge value={res.MCI} />
            <p className="text-xs text-gray-500 text-center mt-1">{inputData.metal} · {pct(Fr)} recycled feedstock</p>
          </div>
          <div className="space-y-3">
            <Slider label="Collected for recycling at end of life" value={collection} min={0} max={1} step={0.01} onChange={setCollection} fmt={pct} />
            <Slider label="Recycling yield" value={efficiency} min={0.5} max={1} step={0.01} onChange={setEfficiency} fmt={pct} />
            <Slider label="Product lifetime vs average" value={lifetime} min={0.5} max={3} step={0.1} onChange={setLifetime} fmt={(v) => `${v.toFixed(1)}×`} />
            <p className="text-xs text-gray-500">Defaults for {inputData.metal.toLowerCase()}: UNEP (2011).</p>
          </div>
          <div className="text-sm space-y-1.5 tabular-nums">
            <div className="flex justify-between"><span className="text-gray-500">Virgin material used (V)</span><span>{pct(res.V)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Unrecoverable waste (W)</span><span>{pct(res.W)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Linear Flow Index (LFI)</span><span>{res.LFI.toFixed(3)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Utility factor F(X)</span><span>{res.F.toFixed(2)}</span></div>
            <div className="mt-3 rounded-lg bg-green-50 border border-green-100 p-2.5 text-green-800 text-xs">
              With 100% recycled input and 95% collection, the score would be <b>{best.MCI.toFixed(2)}</b>.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CircularityScore;
