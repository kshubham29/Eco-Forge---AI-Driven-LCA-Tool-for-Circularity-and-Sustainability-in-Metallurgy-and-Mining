# LCA Data Sources & Methodology

This dataset holds **cradle-to-gate** life-cycle inventory (LCI) factors for the
metals covered by EcoForge. Values are headline/global-average figures from
published industry LCA studies. **Verify and cite the exact figures from the
primary sources below before submission** — for a hackathon/FYP, showing the
source is what earns credibility.

Methodology basis: **ISO 14040 / ISO 14044** (LCA principles & framework).
Functional unit: **1 tonne of finished metal**. System boundary: **cradle-to-gate**
(ore extraction → refined/finished metal), plus an end-of-life recyclability rate.

## Columns
| Column | Meaning | Unit |
|---|---|---|
| `energy_GJ_per_tonne` | Primary energy demand | GJ / tonne |
| `gwp_t_co2e_per_tonne` | Global Warming Potential (100-yr) | tonne CO₂e / tonne |
| `water_m3_per_tonne` | Freshwater consumption | m³ / tonne |
| `recycled_content_pct` | Recycled input for this route | % |
| `recyclability_pct` | Share recoverable at end-of-life | % |

## Sources (replace with exact page/table references)
- **IAI-2022** — International Aluminium Institute, *Life Cycle Inventory Data
  and Environmental Metrics* (2022). Primary aluminium global-average GWP
  ≈ 16 t CO₂e/t; recycling saves ≈ 95% of energy. https://international-aluminium.org
- **worldsteel-2021** — World Steel Association, *LCI study / Sustainability
  Indicators* (2021). BF-BOF vs EAF route factors. https://worldsteel.org
- **ICA-2021** — International Copper Association, copper environmental profile /
  *The Copper Advantage*. Primary vs secondary copper. https://internationalcopper.org
- **Ehrenberger-2013** — Ehrenberger, S. *Life Cycle Assessment of Magnesium
  Components in Vehicle Construction* (2013). Pidgeon-process primary Mg is very
  energy-intensive; recycling saves the vast majority.
- **derived** — Hybrid (50%) rows are a linear blend of the Primary and Recycled
  rows, i.e. `0.5 * primary + 0.5 * recycled`. Documented as an assumption, not a
  measured value.

## Important honesty note for judges
- These are **global averages**. Real impact varies with ore grade, electricity
  grid mix, and process. For an India-specific angle, swap the electricity-driven
  factors using the **CEA grid emission factor** (~0.71 t CO₂/MWh, Central
  Electricity Authority) — a strong, defensible localisation.
- Do **not** present blended/assumed values as measured data. State assumptions.
