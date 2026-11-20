// [19] MATERIAL CIRCULARITY INDICATOR (MCI) - Ellen MacArthur Foundation & Granta Design (2015/2019) method.
//      Score from 0 (fully linear: virgin in, landfill out) to 1 (fully circular).

// Default end-of-life collection-for-recycling rates (UNEP International Resource Panel 2011,
// "Recycling Rates of Metals", mid-points of the EOL-RR ranges) and recycling process
// efficiencies (indicative yields). The user can change both on screen.
export const MCI_DEFAULTS = {
  Aluminium: { collection: 0.6, efficiency: 0.92 },
  Copper: { collection: 0.48, efficiency: 0.9 },
  Magnesium: { collection: 0.39, efficiency: 0.85 },
  Steel: { collection: 0.8, efficiency: 0.9 },
};

/**
 * @param m          mass of product (any unit; MCI does not depend on it)
 * @param Fr         share of feedstock from recycled sources (0-1)
 * @param Fu         share of feedstock from reuse (0-1)
 * @param Cr         share collected for recycling at end of life (0-1)
 * @param Cu         share collected for reuse at end of life (0-1)
 * @param Ec, Ef     efficiency of the recycling process at end of life / for the recycled feedstock (0-1)
 * @param lifetime   product lifetime vs industry average (L / Lav)
 * @param intensity  intensity of use vs industry average (U / Uav)
 */
export function computeMCI({ m = 1, Fr = 0, Fu = 0, Cr = 0, Cu = 0, Ec = 0.9, Ef = 0.9, lifetime = 1, intensity = 1 }) {
  const V = m * (1 - Fr - Fu);                      // virgin feedstock
  const W0 = m * (1 - Cr - Cu);                     // unrecoverable waste (landfill / energy recovery)
  const Wc = m * (1 - Ec) * Cr;                     // waste from recycling the product at end of life
  const Wf = Ef > 0 ? (m * (1 - Ef) * Fr) / Ef : 0; // waste from making the recycled feedstock
  const W = W0 + (Wf + Wc) / 2;                     // total unrecoverable waste
  const LFI = (V + W) / (2 * m + (Wf - Wc) / 2);    // Linear Flow Index (0 = circular, 1 = linear)
  const X = lifetime * intensity;                   // utility
  const F = 0.9 / X;                                // utility factor
  const MCI = Math.max(0, Math.min(1, 1 - LFI * F));
  return { V, W, W0, Wc, Wf, LFI, X, F, MCI };
}

export const mciBand = (s) =>
  s >= 0.75 ? { label: "Highly circular", tone: "good" }
  : s >= 0.5 ? { label: "Moderately circular", tone: "ok" }
  : s >= 0.25 ? { label: "Mostly linear", tone: "warn" }
  : { label: "Linear", tone: "bad" };

// recycled share of feedstock implied by the calculator route
export const recycledShare = (route, scrapFraction) =>
  route === "Recycled" ? 1 : route === "Hybrid" ? (scrapFraction || 0) / 100 : 0;
