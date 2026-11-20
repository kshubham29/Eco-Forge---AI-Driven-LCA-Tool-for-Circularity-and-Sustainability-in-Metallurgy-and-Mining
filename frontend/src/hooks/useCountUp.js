// [38] COUNT-UP - when a number changes, roll it smoothly from the old value to the new one (about half a second).
import { useEffect, useRef, useState } from "react";

export default function useCountUp(target, ms = 500, startAt = target) {
  const [shown, setShown] = useState(startAt);
  const from = useRef(startAt);
  useEffect(() => {
    const start = from.current;
    if (start === target || typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      from.current = target; setShown(target); return undefined;
    }
    // timer steps (not requestAnimationFrame) so the final value always lands, even in a background tab
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / ms), ease = 1 - Math.pow(1 - k, 3);
      const v = k >= 1 ? target : start + (target - start) * ease;
      from.current = v; setShown(v);
      if (k >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, ms]);
  return shown;
}
