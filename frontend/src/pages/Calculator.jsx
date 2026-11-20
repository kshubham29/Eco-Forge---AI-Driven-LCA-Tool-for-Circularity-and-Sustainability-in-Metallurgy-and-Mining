// [4] MAIN SCREEN - the Calculator page: holds user inputs, runs the LCA calculation, calls the backend for ML results.
import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import InputSidebar from "../components/InputSidebar";
import ResultsArea from "../components/ResultsArea";
import MLCarbonPrediction from "../components/MLCarbonPrediction";
import CircularityScore from "../components/CircularityScore";
import AIGapFill from "../components/AIGapFill";
import HotspotFinder from "../components/HotspotFinder";
import CradleToGrave from "../components/CradleToGrave";
import PlantDataUpload from "../components/PlantDataUpload";
import IsoFramework from "../components/IsoFramework";
import TargetPlanner from "../components/TargetPlanner";
import SaveAssessment from "../components/SaveAssessment";
import WhatIf from "../components/WhatIf";
import RouteMap from "../components/RouteMap";
import { useIndiaSites, defaultPlaces, routeDistances, hasRealPlaces } from "../data/routePlaces";
import { lcaEngine } from "../data/lcaEngine";
import { MCI_DEFAULTS } from "../data/mci";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { BarChart3, Flame, Recycle, Sparkles, ClipboardList, ScanSearch } from "lucide-react";
import CircularityPrecheck from "../components/CircularityPrecheck";

// pre-check comes first: it answers "can this scrap stay circular?" before the impact is calculated
const TABS = [
  ["precheck", "Pre-check", ScanSearch],
  ["results", "Results", BarChart3],
  ["optimise", "Hotspots & optimise", Flame],
  ["circularity", "Circularity", Recycle],
  ["ai-data", "AI data", Sparkles],
  ["report", "ISO report", ClipboardList],
];

const eolDefaults = (metal) => {
  const d = MCI_DEFAULTS[metal] || MCI_DEFAULTS.Aluminium;
  return { collection: d.collection, efficiency: d.efficiency };
};

const Calculator = () => {
  const [inputData, setInputData] = useState({
    metal: "Aluminium",
    route: "Primary",
    scrapFraction: 0,
    weightKg: 1000,
    transportDistances: {
      mineToRefinery: 500,
      refineryToSmelter: 300,
      smelterToMarket: 200,
    },
    transportMode: "Truck",
  });

  const [results, setResults] = useState(lcaEngine.getDefaultResults());
  // system boundary + end-of-life settings, shared by the cradle-to-grave, MCI and ISO cards
  // ?tab=precheck (e.g. from the Home page card) opens that tab; default is Results
  const location = useLocation();
  const tabFromUrl = () => { const t = new URLSearchParams(location.search).get("tab"); return TABS.some(([v]) => v === t) ? t : "results"; };
  const [tab, setTab] = useState(tabFromUrl);
  useEffect(() => { setTab(tabFromUrl()); }, [location.search]);
  const [lifecycle, setLifecycle] = useState({ boundary: "gate", ...eolDefaults("Aluminium"), useTPerT: 0 });
  useEffect(() => { setLifecycle((p) => ({ ...p, ...eolDefaults(inputData.metal) })); }, [inputData.metal]);

  // real places in India: pick mine -> refinery -> smelter -> market, distances fill themselves
  const [places, setPlaces] = useState({ on: false });
  const { sites, error: sitesError } = useIndiaSites(places.on);
  // switched on, or metal changed: start from a sensible route for this metal (nearest next site, market Delhi)
  useEffect(() => {
    if (!places.on || !sites.length) return;
    if (!hasRealPlaces(inputData.metal)) { setPlaces({ on: false }); return; }
    if (places.metal !== inputData.metal) {
      const d = defaultPlaces(inputData.metal, sites);
      setPlaces(d ? { on: true, metal: inputData.metal, ...d } : { on: false });
    }
  }, [places.on, places.metal, sites, inputData.metal]);
  // chosen places -> the three distance boxes
  useEffect(() => {
    if (!places.on || places.metal !== inputData.metal) return;
    const d = routeDistances(inputData.metal, places, sites);
    if (!d) return;
    setInputData((p) => {
      const t = p.transportDistances;
      return t.mineToRefinery === d.mineToRefinery && t.refineryToSmelter === d.refineryToSmelter && t.smelterToMarket === d.smelterToMarket
        ? p : { ...p, transportDistances: d };
    });
  }, [places, sites, inputData.metal]);

  // Simulate real-time calculations when inputs change
  useEffect(() => {
    const newResults = lcaEngine.calculate(inputData);
    setResults(newResults);
  }, [inputData]);

  const handleInputChange = (field, value) => {
    setInputData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Reset scrap fraction to 0 when switching away from Hybrid route;
      // a hybrid with 0% scrap would equal the ore route, so Hybrid starts at 50%
      if (field === "route" && value !== "Hybrid") {
        newData.scrapFraction = 0;
      }
      if (field === "route" && value === "Hybrid" && !prev.scrapFraction) {
        newData.scrapFraction = 50;
      }
      
      return newData;
    });
  };

  const handleTransportDistanceChange = (field, value) => {
    setInputData(prev => ({
      ...prev,
      transportDistances: {
        ...prev.transportDistances,
        [field]: value
      }
    }));
  };

  // Run Calculation: recalculate, open the Results tab, scroll to it and flash it, so the user sees it ran
  const [lastRun, setLastRun] = useState(null);
  const [flash, setFlash] = useState(false);
  const resultsRef = useRef(null);
  const handleRunCalculation = () => {
    setResults(lcaEngine.calculate(inputData));
    setTab("results");
    setLastRun(new Date());
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Environmental Impact Calculator
            </h1>
            <p className="text-gray-600">
              Calculate and visualize the environmental impact of your metal choices
            </p>
          </div>
          <SaveAssessment inputData={inputData} results={results} lifecycle={lifecycle} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Input Form */}
          {/* input panel stays on screen while the results scroll */}
          <div className="lg:col-span-1 lg:sticky lg:top-20 self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto rounded-xl">
            <InputSidebar
              inputData={inputData}
              onInputChange={handleInputChange}
              onTransportDistanceChange={handleTransportDistanceChange}
              onRunCalculation={handleRunCalculation}
              lastRun={lastRun}
              places={places}
              setPlaces={setPlaces}
              sites={sites}
              sitesError={sitesError}
            />
          </div>

          {/* Right Content Area - Results */}
          <div ref={resultsRef} className={`lg:col-span-3 scroll-mt-20 rounded-xl transition-shadow duration-500 ${flash ? "ring-4 ring-green-400" : "ring-0"}`}>
            {/* Results split into tabs so the page fits on one screen. forceMount keeps each tab's state
                (e.g. AI gap-fill values) when switching; inactive tabs are only hidden. */}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="sticky top-16 z-30 flex flex-wrap h-auto w-full justify-start gap-1 bg-white border border-gray-200 shadow-sm mb-6 p-1">
                {TABS.map(([v, label, Icon]) => (
                  <TabsTrigger key={v} value={v} className="gap-1.5 data-[state=active]:bg-green-600 data-[state=active]:text-white">
                    <Icon className="h-4 w-4" />{label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="precheck" forceMount className="mt-0 space-y-8 data-[state=inactive]:hidden">
                <CircularityPrecheck metal={inputData.metal} />
              </TabsContent>

              <TabsContent value="results" forceMount className="mt-0 space-y-8 data-[state=inactive]:hidden">
                <ResultsArea results={results} inputData={inputData}>
                  <WhatIf inputData={inputData} results={results} setInputData={setInputData} lockDistances={!!places.on} />
                  <RouteMap metal={inputData.metal} places={places} sites={sites} inputData={inputData} />
                  <MLCarbonPrediction inputData={inputData} results={results} />
                </ResultsArea>
              </TabsContent>

              <TabsContent value="optimise" forceMount className="mt-0 space-y-8 data-[state=inactive]:hidden">
                <HotspotFinder results={results} inputData={inputData} />
                <TargetPlanner results={results} inputData={inputData} />
              </TabsContent>

              <TabsContent value="circularity" forceMount className="mt-0 space-y-8 data-[state=inactive]:hidden">
                <CradleToGrave results={results} inputData={inputData} lifecycle={lifecycle} setLifecycle={setLifecycle} />
                <CircularityScore inputData={inputData} lifecycle={lifecycle} setLifecycle={setLifecycle} />
              </TabsContent>

              <TabsContent value="ai-data" forceMount className="mt-0 space-y-8 data-[state=inactive]:hidden">
                <AIGapFill inputData={inputData} />
                <PlantDataUpload />
              </TabsContent>

              <TabsContent value="report" forceMount className="mt-0 space-y-8 data-[state=inactive]:hidden">
                <IsoFramework inputData={inputData} results={results} lifecycle={lifecycle} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calculator;