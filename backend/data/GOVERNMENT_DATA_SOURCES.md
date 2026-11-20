# Government & Official Data Sources for EcoForge (LCA — Metallurgy & Mining)

Use these authoritative sources in your report, methodology slide, and to answer
the judges' "where's your data?" question. Priority = India-government first
(ideal for Smart India Hackathon / Ministry of Mines), then international LCA
databases for the impact factors.

---

## 🇮🇳 India — Government sources (highest credibility)

### 1. CEA — CO₂ Baseline Database for the Indian Power Sector  ⭐ MOST IMPORTANT
Converts electricity (MWh) → CO₂. Every metal's energy figure runs through this.
- **All-India grid emission factor (FY 2024-25): 0.7117 t CO₂ / MWh** (Version 21.0, Nov 2025)
- Combined Margin: 0.7383 t CO₂/MWh
- User Guide V21.0: https://cea.nic.in/wp-content/uploads/baseline/2025/12/User_Guide_V_21.0.pdf
- CEA site: https://cea.nic.in  (search "CO2 Baseline Database")
- **Use for:** the single most defensible India-specific number in your whole project.

### 2. Indian Bureau of Mines (IBM) — Indian Minerals Yearbook
Official production, reserves, and grades for every mineral/metal in India.
- Indian Minerals Yearbook 2024: https://ibm.gov.in/writereaddata/files/177426215469c1178a48453IMYB_2024_EBookFinal.pdf
- Mining & Mineral Statistics: https://ibm.gov.in/?c=pages&id=77&m=index
- **Use for:** production volumes, ore grades, national context / impact scaling.

### 3. data.gov.in — Open Government Data Platform India
Downloadable CSV/API datasets (this is your actual "dataset" for ML).
- https://data.gov.in  → search "mineral production", "mining", "aluminium", "steel"
- All-India & year-wise mining production (value + quantity by mineral group)
- **Use for:** a real CSV to train/validate on and cite.

### 4. Bureau of Energy Efficiency (BEE) — PAT Scheme (Specific Energy Consumption)
Gate-to-gate Specific Energy Consumption (SEC) for Indian aluminium & steel plants.
- PAT programme: https://beeindia.gov.in/en/programmes/perform-achieve-and-trade-pat
- **Use for:** real, plant-level energy intensity (GJ/tonne) for Indian metals.

### 5. Ministry of Mines — production data & annual reports
- https://mines.gov.in  (annual reports, quarterly mineral production releases)
- **Use for:** policy framing, latest production headlines for your intro slide.

### 6. Ministry of Steel — steel statistics
- https://steel.gov.in  (annual production, capacity, BF-BOF vs EAF split)

### 7. MoSPI — Energy Statistics India
- https://mospi.gov.in  (national energy balance, fuel consumption)

### 8. JNARDDC (Jawaharlal Nehru Aluminium R&D and Design Centre, Nagpur)
- https://jnarddc.gov.in  — Govt of India aluminium research body (often the SIH sponsor for aluminium LCA).

### 9. NITI Aayog — Circular Economy / material recycling reports
- https://niti.gov.in  (search "circular economy", "material recycling")
- **Use for:** the circularity narrative and policy backing.

---

## 🌍 International — LCA impact-factor databases (for the CO₂/energy numbers)

- **IAI** — International Aluminium Institute LCI data: https://international-aluminium.org
- **worldsteel** — Life Cycle Inventory data: https://worldsteel.org
- **ICA** — International Copper Association environmental profile: https://internationalcopper.org
- **US DOE / Argonne GREET model** (free LCA model): https://greet.anl.gov
- **US EPA / IPCC Emission Factor Database (EFDB)**: https://www.ipcc-nggip.iges.or.jp/EFDB/
- **UNEP International Resource Panel**: https://www.resourcepanel.org
- **ecoinvent** (the gold-standard LCA DB — licensed, but free for many universities): https://ecoinvent.org

---

## How to use these in your project (pitch-ready)
1. Take **production/energy data** from data.gov.in + IBM + BEE (Indian, real).
2. Convert energy → CO₂ using the **CEA grid factor (0.7117 t CO₂/MWh)**.
3. Cross-check per-tonne impact factors against **IAI / worldsteel / ICA**.
4. In your slides say: *"Grounded in ISO 14040 LCA methodology, using Government
   of India data (CEA, IBM, BEE) localised to the Indian grid."* — that sentence
   alone beats 90% of hackathon LCA projects.
