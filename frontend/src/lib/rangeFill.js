// [41] SLIDER FILL - keeps the green part of every <input type="range"> up to its handle (sets the --fill used in index.css),
//      whether the value changes by dragging or from code (presets, reset, Apply buttons).
const paint = (el) => {
  const min = Number(el.min) || 0, max = Number(el.max) || 100, v = Number(el.value);
  el.style.setProperty("--fill", `${max > min ? ((v - min) / (max - min)) * 100 : 0}%`);
};
const paintAll = () => document.querySelectorAll('input[type="range"]').forEach(paint);

export default function startRangeFill() {
  if (typeof document === "undefined") return;
  document.addEventListener("input", (e) => { if (e.target?.matches?.('input[type="range"]')) paint(e.target); });
  // values set by React (new page, preset buttons, reset) -> repaint after each DOM change, at most once per frame
  let queued = false;
  new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; paintAll(); });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });
  setInterval(paintAll, 500);   // safety net for values React sets without touching the DOM attribute
  paintAll();
}
