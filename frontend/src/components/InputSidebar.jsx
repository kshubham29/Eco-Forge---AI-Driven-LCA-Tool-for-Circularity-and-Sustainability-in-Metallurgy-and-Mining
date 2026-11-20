import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Input } from "./ui/input";
import { Calculator } from "lucide-react";
import RoutePicker from "./RoutePicker";

const InputSidebar = ({
  inputData,
  onInputChange,
  onTransportDistanceChange,
  onRunCalculation,
  lastRun,
  places = { on: false },
  setPlaces,
  sites = [],
  sitesError,
}) => {
  const auto = !!places.on && sites.length > 0 && !!setPlaces;   // distances come from the chosen real places
  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2 text-green-700">
          <Calculator className="h-5 w-5" />
          <span>Input Parameters</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Metal Selection */}
        <div className="space-y-2">
          <Label htmlFor="metal" className="text-sm font-medium text-gray-700">
            Select Metal
          </Label>
          <Select value={inputData.metal} onValueChange={(value) => onInputChange("metal", value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose metal type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Aluminium">Aluminium</SelectItem>
              <SelectItem value="Copper">Copper</SelectItem>
              <SelectItem value="Magnesium">Magnesium</SelectItem>
              <SelectItem value="Steel">Steel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Route Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700">Production Route</Label>
          <div className="space-y-2">
            {["Primary", "Recycled", "Hybrid"].map((route) => (
              <label key={route} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="route"
                  value={route}
                  checked={inputData.route === route}
                  onChange={(e) => onInputChange("route", e.target.value)}
                  className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">{route} Route</span>
              </label>
            ))}
          </div>
        </div>

        {/* Weight Input */}
        <div className="space-y-3">
          <Label className="text-sm font-bold text-green-700">Weight of Metal Used (kg)</Label>
          
          <div className="space-y-3">
            <Input
              type="number"
              value={inputData.weightKg}
              onChange={(e) => onInputChange("weightKg", parseInt(e.target.value) || 1000)}
              className="w-full"
              min="1"
              max="10000"
              step="10"
            />
            
            <div className="space-y-2">
              <Slider
                value={[inputData.weightKg]}
                onValueChange={(value) => onInputChange("weightKg", value[0])}
                max={10000}
                min={1}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1 kg</span>
                <span>5,000 kg</span>
                <span>10,000 kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrap Fraction Slider - Only visible for Hybrid Route */}
        {inputData.route === "Hybrid" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-bold text-green-700">Scrap Fraction</Label>
              <span className="text-lg font-bold text-green-600">{inputData.scrapFraction}%</span>
            </div>
            <Slider
              value={[inputData.scrapFraction]}
              onValueChange={(value) => onInputChange("scrapFraction", value[0])}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
              <p>Share of the {inputData.metal.toLowerCase()} made from scrap; the rest is made from ore.</p>
            </div>
          </div>
        )}

        {/* Transport Distances */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Transport Distances (km)</Label>
          {inputData.route === "Recycled" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              Not used in the recycled route (published recycled factor).
            </p>
          )}
          {setPlaces && <RoutePicker metal={inputData.metal} places={places} setPlaces={setPlaces} sites={sites} error={sitesError} />}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="mine-refinery" className="text-xs text-gray-600 w-32 shrink-0">Mine → Refinery</Label>
              <Input
                id="mine-refinery"
                type="number"
                value={inputData.transportDistances.mineToRefinery}
                onChange={(e) => onTransportDistanceChange("mineToRefinery", parseInt(e.target.value) || 0)}
                readOnly={auto} title={auto ? "Filled from the real places above" : undefined}
                className={`h-8 ${auto ? "bg-green-50 text-green-900" : ""}`}
                min="0"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="refinery-smelter" className="text-xs text-gray-600 w-32 shrink-0">Refinery → Smelter</Label>
              <Input
                id="refinery-smelter"
                type="number"
                value={inputData.transportDistances.refineryToSmelter}
                onChange={(e) => onTransportDistanceChange("refineryToSmelter", parseInt(e.target.value) || 0)}
                readOnly={auto} title={auto ? "Filled from the real places above" : undefined}
                className={`h-8 ${auto ? "bg-green-50 text-green-900" : ""}`}
                min="0"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="smelter-market" className="text-xs text-gray-600 w-32 shrink-0">Smelter → Market</Label>
              <Input
                id="smelter-market"
                type="number"
                value={inputData.transportDistances.smelterToMarket}
                onChange={(e) => onTransportDistanceChange("smelterToMarket", parseInt(e.target.value) || 0)}
                readOnly={auto} title={auto ? "Filled from the real places above" : undefined}
                className={`h-8 ${auto ? "bg-green-50 text-green-900" : ""}`}
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Transport Mode */}
        <div className="space-y-2">
          <Label htmlFor="transport-mode" className="text-sm font-medium text-gray-700">
            Transport Mode
          </Label>
          <Select value={inputData.transportMode} onValueChange={(value) => onInputChange("transportMode", value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose transport mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Truck">Truck</SelectItem>
              <SelectItem value="Rail">Rail</SelectItem>
              <SelectItem value="Sea">Sea</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <Button 
            onClick={onRunCalculation}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Run Calculation
          </Button>
          {lastRun && (
            <p className="text-xs text-green-700 text-center font-medium">
              ✓ Calculated at {lastRun.toLocaleTimeString("en-IN")}. Results are shown on the right.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InputSidebar;