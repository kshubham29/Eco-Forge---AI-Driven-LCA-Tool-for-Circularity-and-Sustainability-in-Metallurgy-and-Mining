// [32] REPORTS PAGE - tracks every assessment saved from the Calculator: trend of CO2 per tonne over time,
//      per-assessment PDF, share, delete and CSV export of all data.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FileText, Download, Share, Check, Mail, Copy, MessageCircle, Calendar, Trash2, TrendingDown, Loader2, AlertTriangle, Flame } from "lucide-react";
import { Chart, C, axis, layout } from "../components/Plot";
import RefreshButton from "../components/RefreshButton";
import { PROBLEM_STATEMENT } from "../data/project";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const n = (v, d = 1) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: d });
const perT = (a, k = "co2_kg") => (a[k] ?? a.co2_kg) / a.weight_kg;            // kg/kg == t/t
const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const Stat = ({ label, value, sub }) => (
  <div className="rounded-xl bg-white border border-gray-200 p-4">
    <p className="text-xs font-medium text-gray-500">{label}</p>
    <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

const Reports = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [metal, setMetal] = useState(null);

  const load = async () => {
    try {
      const r = await fetch(`${BACKEND}/api/assessments`).then((x) => x.json());
      setItems(r.assessments || []); setError(null);
      return true;
    } catch (e) {
      setError("Backend not reachable. Start the backend, then press Refresh.");
      setItems((prev) => prev || []);
      return false;
    }
  };
  useEffect(() => { load(); }, []);

  const metals = useMemo(() => [...new Set((items || []).map((a) => a.metal))], [items]);
  const active = metal && metals.includes(metal) ? metal : metals[0];
  const series = useMemo(() => (items || []).filter((a) => a.metal === active).slice().reverse(), [items, active]);   // oldest first

  const first = series[0], last = series[series.length - 1];
  const change = first && last && series.length > 1 ? (perT(last) / perT(first) - 1) * 100 : null;

  const trendFig = {
    data: [{
      // one point per saved assessment, in order (saves can be seconds or weeks apart, so no time axis)
      type: "scatter", mode: "lines+markers", x: series.map((_, i) => `#${i + 1}`), y: series.map((a) => perT(a)),
      text: series.map((a) => `${a.title} (${a.route}${a.route === "Hybrid" ? `, ${a.scrap_pct}% scrap` : ""}) · ${when(a.created_at)}`),
      line: { color: C.blue, width: 2 }, marker: { size: 9, color: C.blue, line: { color: "#fff", width: 2 } },
      hovertemplate: "%{text}<br>%{y:.2f} t CO₂e per tonne<extra></extra>",
    }],
    layout: layout({ margin: { l: 56, r: 16, t: 12, b: 48 }, xaxis: axis("Saved assessment, oldest → newest", { type: "category" }), yaxis: axis("t CO₂e per tonne (cradle-to-gate)", { rangemode: "tozero" }) }),
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this saved assessment?")) return;
    await fetch(`${BACKEND}/api/assessments/${id}`, { method: "DELETE" });
    load();
  };

  const fileName = (a) => `${a.title.replace(/[^\w-]+/g, "_")}.pdf`;
  const buildPdf = (a) => {
    const doc = new jsPDF();
    let y = 20;
    const line = (label, value) => { doc.setTextColor(90); doc.text(label, 24, y); doc.setTextColor(20); doc.text(String(value), 110, y); y += 8; };
    doc.setFontSize(20); doc.setTextColor(22, 163, 74); doc.text("EcoForge", 20, y); y += 7;
    doc.setFontSize(11); doc.setTextColor(100);
    const ps = doc.splitTextToSize(PROBLEM_STATEMENT, 170);
    doc.text(ps, 20, y); y += ps.length * 5;
    doc.text("Saved assessment", 20, y); y += 5;
    doc.setDrawColor(200); doc.line(20, y, 190, y); y += 10;
    doc.setFontSize(15); doc.setTextColor(20); doc.text(a.title, 20, y); y += 8;
    doc.setFontSize(10); doc.setTextColor(110); doc.text(`Saved ${when(a.created_at)}`, 20, y); y += 10;
    doc.setFontSize(11);
    line("Metal / route", `${a.metal}, ${a.route}${a.route === "Hybrid" ? ` (${a.scrap_pct}% scrap)` : ""}`);
    line("Quantity", `${n(a.weight_kg / 1000, 2)} t`);
    line("Transport", `${n(a.transport_km, 0)} km by ${a.transport_mode}`);
    line("System boundary", a.boundary === "grave" ? "Cradle-to-grave" : "Cradle-to-gate");
    line("Energy", `${n(a.energy_gj)} GJ`);
    line("CO2e (cradle-to-gate)", `${n(a.co2_kg / 1000, 2)} t (${n(perT(a), 2)} t per tonne)`);
    if (a.co2_grave_kg != null) line("CO2e (cradle-to-grave)", `${n(a.co2_grave_kg / 1000, 2)} t`);
    line("Water", `${n(a.water_m3, 1)} m3`);
    line("Solid waste", `${n(a.waste_kg / 1000, 2)} t`);
    line("Circularity (MCI)", Number(a.mci).toFixed(2));
    if (a.hotspot) line("Hotspot", `${a.hotspot} (${Math.round(a.hotspot_share * 100)}% of CO2)`);
    y += 6; doc.setFontSize(9); doc.setTextColor(130);
    doc.text("Method: ISO 14040/14044 process LCA, functional unit 1 t of metal. Factors: IAI, worldsteel, ICA, Ehrenberger;", 20, y);
    doc.text("India grid CEA v21.0 (0.7117 t CO2/MWh). Circularity: Ellen MacArthur Foundation MCI.", 20, y + 5);
    return doc;
  };
  const pdf = (a) => buildPdf(a).save(fileName(a));

  // ---- sharing: WhatsApp / email / copy use a short text summary; "Share PDF" sends the PDF file
  // through the device's own share window (Windows share, or WhatsApp/Gmail on a phone)
  const summary = (a) => [
    `EcoForge LCA result: ${a.title}`,
    `${a.metal}, ${a.route} route${a.route === "Hybrid" ? ` (${a.scrap_pct}% scrap)` : ""}, ${n(a.weight_kg / 1000, 2)} t`,
    `CO2: ${n(perT(a), 2)} t CO2e per tonne`,
    `Energy: ${n(a.energy_gj)} GJ`,
    `Circularity (MCI): ${Number(a.mci).toFixed(2)}`,
    a.hotspot ? `Hotspot: ${a.hotspot} (${Math.round(a.hotspot_share * 100)}% of CO2)` : null,
    `Saved: ${when(a.created_at)}`,
  ].filter(Boolean).join("\n");
  const [copied, setCopied] = useState(null);   // id of the assessment whose summary was just copied
  const [shareMsg, setShareMsg] = useState(null);
  const flash = (id, msg) => { setCopied(id); setShareMsg(msg); setTimeout(() => setCopied((c) => (c === id ? null : c)), 2500); };
  const shareWhatsApp = (a) => window.open(`https://wa.me/?text=${encodeURIComponent(summary(a))}`, "_blank", "noopener");
  const shareEmail = (a) => { window.location.href = `mailto:?subject=${encodeURIComponent(`EcoForge LCA: ${a.title}`)}&body=${encodeURIComponent(summary(a))}`; };
  const copyText = async (a) => {
    try { await navigator.clipboard.writeText(summary(a)); flash(a.id, "Copied"); }
    catch { window.prompt("Copy this summary:", summary(a)); }
  };
  const canSharePdf = typeof navigator !== "undefined" && !!navigator.share;
  const sharePdf = async (a) => {
    const file = new File([buildPdf(a).output("blob")], fileName(a), { type: "application/pdf" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: `EcoForge LCA: ${a.title}`, text: summary(a) });
      else await navigator.share({ title: `EcoForge LCA: ${a.title}`, text: summary(a) });
      flash(a.id, "Shared");
    } catch (e) { if (e?.name !== "AbortError") { pdf(a); flash(a.id, "PDF downloaded"); } }
  };

  const exportAll = () => {
    const cols = ["created_at", "title", "metal", "route", "scrap_pct", "weight_kg", "transport_km", "transport_mode", "boundary", "energy_gj",
      "co2_kg", "co2_grave_kg", "water_m3", "waste_kg", "recyclability", "closed_loop", "mci", "hotspot", "hotspot_share"];
    const csv = [cols.join(","), ...items.map((a) => cols.map((c) => `"${String(a[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const el = document.createElement("a"); el.href = url; el.download = "ecoforge_assessments.csv"; el.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & tracking</h1>
            <p className="text-gray-600">Every assessment you save in the Calculator, tracked over time.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton onRefresh={load} />
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => navigate("/calculator")}><FileText className="h-4 w-4 mr-2" />New assessment</Button>
            <Button variant="outline" onClick={exportAll} disabled={!items?.length}><Download className="h-4 w-4 mr-2" />Export all (CSV)</Button>
          </div>
        </div>

        {error && <div className="p-4 mb-6 rounded-lg bg-red-50 text-red-700 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 mt-0.5" />{error}</div>}
        {items === null && <div className="flex items-center text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</div>}

        {items && items.length === 0 && !error && (
          <Card className="bg-white shadow-sm border border-gray-200"><CardContent className="p-10 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-800">No saved assessments yet</p>
            <p className="text-sm text-gray-500 mt-1">Open the Calculator, set your inputs and press “Save assessment”. Each save appears here so you can track progress.</p>
            <Button className="mt-4 bg-green-600 hover:bg-green-700" onClick={() => navigate("/calculator")}>Go to Calculator</Button>
          </CardContent></Card>
        )}

        {items && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Stat label="Saved assessments" value={items.length} sub={`${metals.length} metal${metals.length > 1 ? "s" : ""}`} />
              <Stat label={`Latest ${active} result`} value={`${n(perT(last), 2)} t`} sub="CO₂e per tonne" />
              <Stat label={`${active}: change since first`} value={change == null ? "–" : `${change > 0 ? "+" : ""}${change.toFixed(0)}%`}
                    sub={series.length > 1 ? `over ${series.length} assessments` : "save more to see a trend"} />
              <Stat label="Best circularity (MCI)" value={Math.max(...items.map((a) => a.mci)).toFixed(2)} sub="across all saves" />
            </div>

            <Card className="bg-white shadow-sm border border-gray-200 mb-6">
              <CardHeader className="pb-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-5 w-5 text-green-600" />CO₂ per tonne over time</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {metals.map((m) => (
                      <button key={m} onClick={() => setMetal(m)}
                              className={`px-3 py-1 rounded-full border text-sm ${m === active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"}`}>{m}</button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {series.length > 1 ? <Chart fig={trendFig} height={280} />
                  : <p className="text-sm text-gray-500 py-6">Only one {active.toLowerCase()} assessment so far. Save another (for example with more scrap) to see the trend.</p>}
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border border-gray-200">
              <CardHeader className="pb-1"><CardTitle className="text-base">Saved assessments</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {items.map((a) => (
                  <div key={a.id} className="p-4 border border-gray-200 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{a.title}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                        <span className="flex items-center"><Calendar className="h-4 w-4 mr-1" />{when(a.created_at)}</span>
                        <span>{a.metal} · {a.route}{a.route === "Hybrid" ? ` ${a.scrap_pct}% scrap` : ""} · {n(a.weight_kg / 1000, 2)} t</span>
                        <span className="font-medium text-gray-900">{n(perT(a), 2)} t CO₂e/t</span>
                        <span>MCI {Number(a.mci).toFixed(2)}</span>
                        {a.hotspot && <span className="flex items-center text-red-700"><Flame className="h-3.5 w-3.5 mr-1" />{a.hotspot} {Math.round(a.hotspot_share * 100)}%</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => pdf(a)}><Download className="h-4 w-4 mr-1" />PDF</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={copied === a.id ? "text-green-700 border-green-300" : ""}>
                            {copied === a.id ? <><Check className="h-4 w-4 mr-1" />{shareMsg}</> : <><Share className="h-4 w-4 mr-1" />Share</>}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => shareWhatsApp(a)}><MessageCircle className="h-4 w-4 mr-2 text-green-600" />WhatsApp</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => shareEmail(a)}><Mail className="h-4 w-4 mr-2 text-blue-600" />Email</DropdownMenuItem>
                          {canSharePdf && <DropdownMenuItem onSelect={() => sharePdf(a)}><FileText className="h-4 w-4 mr-2 text-red-600" />Share PDF…</DropdownMenuItem>}
                          <DropdownMenuItem onSelect={() => copyText(a)}><Copy className="h-4 w-4 mr-2 text-gray-600" />Copy text</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="outline" size="sm" onClick={() => remove(a.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
