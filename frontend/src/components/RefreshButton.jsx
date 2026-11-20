// REFRESH BUTTON - reloads a page's data from the backend and says clearly whether it worked.
// onRefresh: async function that returns true on success, false (or throws) on failure.
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Loader2, RotateCw } from "lucide-react";

const RefreshButton = ({ onRefresh, label = "Refresh" }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { ok, text }

  const run = async () => {
    setBusy(true); setMsg(null);
    let ok = false;
    try { ok = (await onRefresh()) !== false; } catch { ok = false; }
    const t = new Date().toLocaleTimeString("en-IN");
    setMsg(ok ? { ok, text: `✓ Refreshed at ${t}` } : { ok, text: "Backend not reachable. Start it (port 8000) and try again." });
    setBusy(false);
    setTimeout(() => setMsg(null), ok ? 4000 : 8000);
  };

  return (
    <div className="flex items-center gap-2">
      {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</span>}
      <Button variant="outline" onClick={run} disabled={busy} title="Reload the latest data from the backend">
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}{label}
      </Button>
    </div>
  );
};

export default RefreshButton;
