# Real Government-of-India Metal Production Dataset

File: `india_metal_production.csv` — **actual production figures** published by the
Government of India (Ministry of Mines, Ministry of Steel), not synthetic data.

## Columns
| Column | Meaning |
|---|---|
| `metal` | Metal / mineral |
| `fiscal_year` | Indian fiscal year (Apr–Mar) |
| `production_million_tonnes` | **Real** national production (official figure) |
| `primary_gwp_t_co2e_per_tonne` | Cradle-to-gate GWP factor for the primary route (from `lca_emission_factors.csv`) |
| `estimated_national_co2e_mt` | **Derived** = production × GWP factor (Mt CO₂e) |
| `source` | Government source |

## The real numbers (verify against the source links)
- **Primary aluminium** (Ministry of Mines): 4.073 Mt (FY22‑23) → 4.159 Mt (FY23‑24)
  → ~4.2 Mt (FY24‑25). India is the **world's 2nd-largest** primary aluminium producer.
- **Crude steel** (Ministry of Steel / worldsteel): 109.1 Mt (FY19‑20) →
  127.2 Mt (FY22‑23) → 144.3 Mt (FY23‑24). India is the **world's 2nd-largest** steel producer.
- **Refined copper** (Ministry of Mines): 0.497 Mt (FY24‑25).
- **Iron ore** (Ministry of Mines / IBM): 274 Mt (FY23‑24) — ~70% of India's mineral
  production by value.

## Important assumption for the derived CO₂ column
`estimated_national_co2e_mt` assumes **100% primary route** (worst case), so it is an
**upper-bound cradle-to-gate estimate**, not a measured national inventory. In reality
part of production is recycled, which lowers the true figure. State this in your report.

Sanity check: steel at 144.3 Mt × 2.19 ≈ **316 Mt CO₂e** — consistent with the widely
cited "Indian steel sector ≈ 12% of national CO₂" figure, which validates the method.

## Sources
- Ministry of Mines — record mineral production, FY2023‑24 & FY2024‑25 (PIB press releases): https://mines.gov.in
- Press Information Bureau — "India is the 2nd Largest Aluminium Producer": https://www.pib.gov.in/PressReleasePage.aspx?PRID=2039988
- Ministry of Steel / World Steel Association crude-steel statistics: https://worldsteel.org
- Indian Bureau of Mines — Indian Mineral Industry at a Glance: https://ibm.gov.in
