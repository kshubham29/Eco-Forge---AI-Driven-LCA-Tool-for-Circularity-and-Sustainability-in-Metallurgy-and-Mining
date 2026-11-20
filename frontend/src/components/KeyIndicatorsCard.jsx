import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { TrendingUp, Zap, Trash2, Droplets } from "lucide-react";
import { lcaEngine } from "../data/lcaEngine";
import useCountUp from "../hooks/useCountUp";

const KeyIndicatorsCard = ({ indicators, inputData }) => {
  const metal = inputData?.metal || "Aluminium";
  const tonnes = (inputData?.weightKg || 1000) / 1000;
  const ref = lcaEngine.baseData[metal] || lcaEngine.baseData.Aluminium;
  const perT = { co2: indicators.totalCO2e / 1000 / tonnes, energy: indicators.totalEnergy / tonnes };
  // numbers roll to their new value when an input changes
  const anim = {
    energy: useCountUp(indicators.totalEnergy || 0), co2: useCountUp(indicators.totalCO2e || 0),
    water: useCountUp(indicators.totalWater || 0), waste: useCountUp(indicators.totalWaste || 0),
    co2T: useCountUp(perT.co2 || 0), energyT: useCountUp(perT.energy || 0),
  };
  const savedPct = Math.round((1 - perT.co2 / ref.Primary.co2e) * 100);
  // where this result sits between fully recycled (0) and fully primary (1)
  const pos = (perT.co2 - ref.Recycled.co2e) / (ref.Primary.co2e - ref.Recycled.co2e);
  const rating = pos <= 0.33 ? { label: "Low", cls: "text-green-700" } : pos <= 0.66 ? { label: "Medium", cls: "text-amber-700" } : { label: "High", cls: "text-red-700" };

  // all values with thousands separators, so the four boxes read the same way
  const num = (v, d = 0) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: d });
  // energy is already in GJ; display in GJ
  const formatEnergy = (energyGJ) => `${num(energyGJ, 1)} GJ`;

  // Helper function to format CO2e
  const formatCO2e = (co2e) => {
    return `${Math.round(co2e).toLocaleString()} kg CO₂e`;
  };

  // Helper function to format waste
  // waste in kg
  const formatWaste = (wasteKg) => `${num(wasteKg)} kg`;
  const formatWater = (m3) => `${num(m3, 1)} m³`;

  const kpis = [
    {
      title: "Total Energy",
      value: formatEnergy(anim.energy),
      unit: "",
      icon: <Zap className="h-8 w-8 text-yellow-500" />,
      color: "yellow",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200"
    },
    {
      title: "Total CO₂e",
      value: formatCO2e(anim.co2),
      unit: "",
      icon: <TrendingUp className="h-8 w-8 text-red-500" />,
      color: "red",
      bgColor: "bg-red-50",
      borderColor: "border-red-200"
    },
    {
      title: "Total Water",
      value: formatWater(anim.water),
      unit: "",
      icon: <Droplets className="h-8 w-8 text-blue-500" />,
      color: "blue",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    {
      title: "Total Waste",
      value: formatWaste(anim.waste),
      unit: "",
      icon: <Trash2 className="h-8 w-8 text-orange-500" />,
      color: "orange",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200"
    }
  ];

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-gray-800">Key Environmental Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => (
            <div
              key={index}
              className={`ef-lift ${kpi.bgColor} ${kpi.borderColor} border rounded-lg p-4 text-center`}
            >
              <div className="flex justify-center mb-3">
                {kpi.icon}
              </div>
              
              <div className="space-y-1">
                <p className={`text-lg font-bold text-${kpi.color}-600`}>
                  {kpi.value}
                  {kpi.unit && <span className="text-sm font-normal ml-1">{kpi.unit}</span>}
                </p>
                <p className="text-xs text-gray-600 font-medium">
                  {kpi.title}
                </p>
              </div>
              
              {/* Progress bar for percentage values */}
              {kpi.unit === "%" && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`bg-${kpi.color}-500 h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${kpi.value}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Per-tonne summary: rated against this metal's own primary and recycled routes, so order size does not matter */}
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Carbon intensity</p>
              <p className="text-lg font-bold text-gray-900">{anim.co2T.toFixed(2)} <span className="text-sm font-normal">t CO₂e/t</span></p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Energy intensity</p>
              <p className="text-lg font-bold text-gray-900">{anim.energyT.toFixed(1)} <span className="text-sm font-normal">GJ/t</span></p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CO₂ vs primary route</p>
              <p className={`text-lg font-bold ${savedPct > 0 ? "text-green-700" : savedPct < 0 ? "text-red-700" : "text-gray-700"}`}>{savedPct > 0 ? `−${savedPct}%` : savedPct < 0 ? `+${-savedPct}%` : "0%"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Carbon rating</p>
              <p className={`text-lg font-bold ${rating.cls}`}>{rating.label}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Rating compares your CO₂ per tonne with {metal.toLowerCase()} made fully from ore ({ref.Primary.co2e} t) and fully from scrap ({ref.Recycled.co2e} t).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default KeyIndicatorsCard;