// [27] PLANT DATA UPLOAD - upload a CSV of plants (exported from Excel or a plant
//      system), the AI fills every blank cell (/api/estimate-missing-batch), and the completed file can be downloaded.
import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Upload, Download, FileSpreadsheet, Loader2, AlertTriangle } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const METALS = ["Aluminium", "Copper", "Magnesium", "Steel"];

// CSV column -> [API key, scale from CSV value to API value, label]
const COLUMNS = [
  ["recycled_content_pct", "recycled_content", 0.01, "Recycled %"],
  ["energy_gj_per_t", "energy_gj", 1, "Energy GJ/t"],
  ["electricity_mwh_per_t", "electricity_mwh", 1, "Electricity MWh/t"],
  ["water_m3_per_t", "water_m3", 1, "Water m³/t"],
  ["co2_t_per_t", "gwp_t_co2e", 1, "CO₂ t/t"],
  ["ore_grade_factor", "ore_grade_factor", 1, "Ore factor"],
  ["grid_tco2_per_mwh", "grid_intensity_tco2_mwh", 1, "Grid t/MWh"],
  ["transport_km", "transport_km", 1, "Transport km"],
];

const TEMPLATE = `plant_name,metal,${COLUMNS.map((c) => c[0]).join(",")}
Plant A - integrated steel,Steel,0,,,,,,0.7117,600
Plant B - secondary aluminium,Aluminium,85,,,,,,0.7117,300
Plant C - copper smelter,Copper,20,40,,,,,0.7117,
Plant D - aluminium smelter,Aluminium,,150,15,,,,0.9,800
`;

// small CSV parser: handles quoted fields with commas
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const download = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

const fmt = (v) => (v == null ? "" : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

const PlantDataUpload = () => {
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);       // [{name, metal, cells: {csvCol: {value, estimated, range}}, error}]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setError(null); setRows(null); setFileName(file.name);
    if (!/\.csv$/i.test(file.name)) { setError("Please upload a .csv file (in Excel: File → Save As → CSV)."); return; }
    const table = parseCSV(await file.text());
    if (table.length < 2) { setError("The file has no data rows."); return; }
    const head = table[0].map((h) => h.trim().toLowerCase());
    const col = (name) => head.indexOf(name);
    if (col("metal") < 0) { setError("The file needs a 'metal' column. Download the template to see the format."); return; }
    if (table.length - 1 > 500) { setError(`The file has ${table.length - 1} rows; upload at most 500 at a time.`); return; }
    const parsed = table.slice(1).map((r, i) => {
      const metal = (r[col("metal")] || "").trim();
      const values = {}, bad = [];
      COLUMNS.forEach(([csv, api, scale]) => {
        const j = col(csv), raw = j >= 0 ? (r[j] || "").trim() : "";
        if (raw !== "" && isNaN(Number(raw))) bad.push(`${csv} = "${raw}" is not a number`);
        values[api] = raw === "" || isNaN(Number(raw)) ? null : Number(raw) * scale;
      });
      const nameIdx = col("plant_name");
      return { name: nameIdx >= 0 ? r[nameIdx] : `Row ${i + 1}`, metal: METALS.find((m) => m.toLowerCase() === metal.toLowerCase()) || metal,
               values, error: bad.length ? bad.join("; ") : null };
    });
    const toSend = parsed.filter((p) => !p.error);
    if (!toSend.length) { setRows(parsed); return; }
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/estimate-missing-batch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: toSend.map((p) => ({ metal: p.metal, values: p.values })) }),
      }).then((x) => x.json());
      if (!res.success) { setError(res.error); return; }
      let k = 0;
      setRows(parsed.map((p) => {
        if (p.error) return p;                       // malformed cell: not sent, shown as an error
        const out = res.results[k++];
        if (!out.success) return { ...p, error: out.error };
        const cells = {};
        COLUMNS.forEach(([csv, api, scale]) => {
          const v = out.values[api];
          cells[csv] = { value: v.value / scale, estimated: v.estimated, default: v.default, low: v.low_reliability,
                         range: v.range?.map((x) => x / scale) };
        });
        return { ...p, cells, warnings: out.warnings || [] };
      }));
    } catch (e) {
      setError("Backend not reachable. Make sure the backend is running on port 8000.");
    } finally { setBusy(false); }
  };

  const exportFilled = () => {
    // every AI value stays identifiable in the exported file, with its approximate range and any warning
    const head = ["plant_name", "metal", ...COLUMNS.map((c) => c[0]), "ai_estimated_columns", "ai_approx_95pct_ranges",
                  "low_reliability_columns", "default_values", "warnings"];
    const lines = rows.map((r) => {
      if (r.error) return [r.name, r.metal, ...COLUMNS.map(() => ""), "", "", "", "", `ERROR: ${r.error}`];
      const est = COLUMNS.filter(([c]) => r.cells[c].estimated);
      return [r.name, r.metal, ...COLUMNS.map(([c]) => fmt(r.cells[c].value)),
        est.map(([c]) => c).join(" "),
        est.map(([c]) => `${c}: ${fmt(r.cells[c].range[0])}-${fmt(r.cells[c].range[1])}`).join("; "),
        est.filter(([c]) => r.cells[c].low).map(([c]) => c).join(" "),
        COLUMNS.filter(([c]) => r.cells[c].default).map(([c]) => c).join(" "),
        (r.warnings || []).join(" | ")];
    });
    download("ecoforge_plants_filled.csv", [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"));
  };

  const filled = rows ? rows.reduce((a, r) => a + (r.cells ? COLUMNS.filter(([c]) => r.cells[c].estimated).length : 0), 0) : 0;

  return (
    <Card className="bg-white shadow-lg border-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-gray-800"><FileSpreadsheet className="h-5 w-5 text-green-600" />Upload plant data (CSV)</CardTitle>
        <p className="text-sm text-gray-500">
          One row per plant; empty cells are filled by AI.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
          <Button onClick={() => fileRef.current?.click()} disabled={busy} className="bg-green-600 hover:bg-green-700">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Upload CSV
          </Button>
          <Button variant="outline" onClick={() => download("ecoforge_plant_template.csv", TEMPLATE)}>
            <Download className="h-4 w-4 mr-2" />Download template
          </Button>
          {rows && <Button variant="outline" onClick={exportFilled}><Download className="h-4 w-4 mr-2" />Download completed file</Button>}
        </div>
        {fileName && !error && <p className="text-xs text-gray-500 mt-2">{fileName}</p>}
        {error && <p className="mt-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5" />{error}</p>}

        {rows && (
          <>
            <p className="text-sm text-gray-800 mt-4">{rows.length} plants read, <b>{filled}</b> missing values filled by the AI <span className="text-purple-700">(purple)</span>.</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs tabular-nums">
                <thead><tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 font-medium">Plant</th><th className="py-2 pr-3 font-medium">Metal</th>
                  {COLUMNS.map((c) => <th key={c[0]} className="py-2 pr-3 font-medium whitespace-nowrap">{c[3]}</th>)}
                </tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">{r.name}</td>
                    <td className="py-2 pr-3">{r.metal}</td>
                    {r.error ? <td colSpan={COLUMNS.length} className="py-2 text-red-700">{r.error}</td>
                      : COLUMNS.map(([c]) => {
                        const v = r.cells[c];
                        return (
                          <td key={c} className={`py-2 pr-3 ${v.estimated ? (v.low ? "bg-amber-50 text-amber-800 font-medium" : "bg-purple-50 text-purple-800 font-medium") : v.default ? "text-gray-400" : "text-gray-800"}`}
                              title={v.estimated ? `AI-estimated, approx. 95% range ${fmt(v.range[0])}–${fmt(v.range[1])}` : v.default ? "default value" : "from your file"}>
                            {fmt(v.value)}
                          </td>
                        );
                      })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">Hover a purple cell to see its approximate 95% range. Amber = low-reliability estimate (enter the real value if you can). Grey = default distance (500 km) because it was blank.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PlantDataUpload;
