import React from "react";
import KeyIndicatorsCard from "./KeyIndicatorsCard";
import VisualizationCard from "./VisualizationCard";
import InsightsCard from "./InsightsCard";

const ResultsArea = ({ results, inputData, children }) => {
  return (
    <div className="space-y-6">
      {/* Key Indicators Card */}
      <KeyIndicatorsCard indicators={results.keyIndicators} inputData={inputData} />

      {/* extra cards from the page, e.g. the ML prediction, right under the key numbers */}
      {children}

      {/* Flow diagram gets the full width so its labels stay readable on a projector */}
      <div className="grid grid-cols-1 gap-6">
        {/* One flow diagram for every route, driven by the stage results of the chosen metal */}
        <VisualizationCard stageBreakdown={results.stageBreakdown} inputData={inputData} />

        {/* Insights worked out from the current inputs and results */}
        <InsightsCard inputData={inputData} results={results} />
      </div>
    </div>
  );
};

export default ResultsArea;
