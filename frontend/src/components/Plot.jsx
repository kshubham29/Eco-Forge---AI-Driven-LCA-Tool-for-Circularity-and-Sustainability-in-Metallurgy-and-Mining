// [14] CHART HELPER - one Plotly component + shared chart styling used by Model Lab and India Map.
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";

const Plot = createPlotlyComponent(Plotly);

// colour-blind-checked palette (validated: first three slots are safe for any pairing)
export const C = {
  blue: "#2a78d6", orange: "#eb6834", aqua: "#1baf7a", red: "#e34948",
  gray: "#c3c2b7", ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7",
};
// sequential (one hue, light -> dark) and diverging (red - gray - blue) colour scales
export const SEQ = [[0, "#f4f8fd"], [0.2, "#cde2fb"], [0.4, "#86b6ef"], [0.6, "#3987e5"], [0.8, "#256abf"], [1, "#0d366b"]];
export const DIV = [[0, "#b73a3a"], [0.25, "#e88f8e"], [0.5, "#f0efec"], [0.75, "#86b6ef"], [1, "#1c5cab"]];

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const axis = (title, extra = {}) => ({
  title: title ? { text: title, font: { size: 12, color: C.ink2 } } : undefined,
  gridcolor: C.grid, linecolor: C.axis, zerolinecolor: C.axis, tickfont: { color: C.muted, size: 11 },
  automargin: true, ...extra,
});

export const layout = (extra = {}) => ({
  font: { family: FONT, size: 12, color: C.ink2 },
  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
  margin: { l: 56, r: 16, t: 12, b: 48 },
  hoverlabel: { bgcolor: "#ffffff", bordercolor: C.grid, font: { family: FONT, color: C.ink, size: 12 } },
  showlegend: false, barcornerradius: 4,
  xaxis: axis(), yaxis: axis(),
  ...extra,
});

export const config = { displaylogo: false, responsive: true, displayModeBar: false };   // no grey toolbar over the charts

export const Chart = ({ fig, height = 300 }) => (
  <Plot data={fig.data} layout={{ ...fig.layout, autosize: true, height }} config={config}
        useResizeHandler style={{ width: "100%", height }} />
);

export { Plotly };
export default Plot;
