// [7] LCA FACTOR LIBRARY - emission factors and calculation formulas (IAI / worldsteel / ICA / CEA), ISO 14040 based.
// =============================================================================
// EcoForge — Life Cycle Assessment factor library
// -----------------------------------------------------------------------------
// Methodology: ISO 14040 / ISO 14044.  Functional unit = 1 tonne of finished
// metal.  System boundary = cradle-to-gate (ore extraction -> refined metal),
// plus an end-of-life recyclability rate.
//
// NOTE ON UNITS: energy is GJ/tonne, which is numerically identical to MJ/kg;
// co2e is t CO2e/tonne, numerically identical to kg CO2e/kg. So the same number
// is valid whether the engine works in tonnes or kilograms.
//
// SOURCES (see backend/data/SOURCES.md for full citations):
//   [IAI]        International Aluminium Institute LCI data (2022)
//   [worldsteel] World Steel Association LCI / sustainability indicators (2021)
//   [ICA]        International Copper Association environmental profile (2021)
//   [CEA]        India grid emission factor 0.7117 t CO2/MWh, CEA CO2 Baseline
//                Database v21.0 (FY 2024-25) — used to localise electricity CO2
//   [DEFRA/GLEC] Freight transport emission factors
// Values are global-average headline figures; verify exact numbers against the
// primary sources before final submission.
// =============================================================================

// India electricity grid emission factor (t CO2 per MWh) — CEA v21.0, FY2024-25.
// Multiply a process's electricity demand (MWh/t) by this to get its CO2 (t/t).
export const CEA_GRID_FACTOR_TCO2_PER_MWH = 0.7117; // [CEA]

export const lcaEngine = {
  // Cradle-to-gate reference intensities per tonne of metal (cited above).
  baseData: {
    Aluminium: {
      Primary: {
        energy: 155.0, // GJ/tonne primary energy demand [IAI]
        co2e: 16.1, // t CO2e/tonne (global avg) [IAI]; India grid via [CEA]
        water: 10.5, // m3/tonne [IAI]
        recyclability: 95,
        closedLoopPotential: 85
      },
      Recycled: {
        energy: 12.0, // ~92% energy saving vs primary [IAI]
        co2e: 0.55, // t CO2e/tonne [IAI]
        water: 1.5, // m3/tonne [IAI]
        recyclability: 98,
        closedLoopPotential: 92
      }
    },
    Copper: {
      Primary: {
        energy: 42.0, // GJ/tonne [ICA]
        co2e: 3.83, // t CO2e/tonne [ICA]
        water: 72, // m3/tonne [ICA]
        recyclability: 90,
        closedLoopPotential: 80
      },
      Recycled: {
        energy: 13.0, // GJ/tonne [ICA]
        co2e: 0.80, // t CO2e/tonne [ICA]
        water: 20, // m3/tonne [ICA]
        recyclability: 95,
        closedLoopPotential: 88
      }
    },
    Magnesium: {
      Primary: {
        energy: 366.0, // GJ/tonne (Pidgeon process) [Ehrenberger-2013]
        co2e: 28.0, // t CO2e/tonne [Ehrenberger-2013]
        water: 25, // m3/tonne [Ehrenberger-2013]
        recyclability: 85,
        closedLoopPotential: 75
      },
      Recycled: {
        energy: 10.0, // GJ/tonne [Ehrenberger-2013]
        co2e: 0.60, // t CO2e/tonne [Ehrenberger-2013]
        water: 2, // m3/tonne [Ehrenberger-2013]
        recyclability: 92,
        closedLoopPotential: 82
      }
    },
    Steel: {
      Primary: {
        energy: 22.7, // GJ/tonne (BF-BOF route) [worldsteel]
        co2e: 2.19, // t CO2e/tonne (BF-BOF) [worldsteel]
        water: 28.6, // m3/tonne [worldsteel]
        recyclability: 88,
        closedLoopPotential: 78
      },
      Recycled: {
        energy: 9.1, // GJ/tonne (EAF route) [worldsteel]
        co2e: 0.67, // t CO2e/tonne (EAF) [worldsteel]
        water: 9.0, // m3/tonne [worldsteel]
        recyclability: 93,
        closedLoopPotential: 85
      }
    }
  },

  // Freight emissions (kg CO2e per tonne-km) [DEFRA/GLEC]
  transportEmissions: {
    Truck: 0.062,
    Rail: 0.022,
    Sea: 0.015
  },

  // Calculate results based on input parameters
  calculate: function(inputData) {
    const { metal, route, scrapFraction, weightKg, transportDistances, transportMode } = inputData;
    const weightT = weightKg / 1000; // Convert to tonnes
    
    let totalEnergy, totalCO2e, totalWaste, recyclability, closedLoopPotential;
    
    // Check if metal data exists, if not default to Aluminium
    const metalData = this.baseData[metal] || this.baseData.Aluminium;
    
    if (route === "Primary") {
      // Use precise Primary Route calculations ONLY for Primary Route
      const primaryResults = this.calculatePrimaryRoute(weightKg, transportDistances, transportMode, metal);
      totalEnergy = primaryResults.totalEnergy; // GJ
      totalCO2e = primaryResults.totalCO2e; // kg CO2e
      // Waste already in kg per stage
      totalWaste = primaryResults.totalWaste; // kg
      recyclability = metalData.Primary.recyclability; // per metal (was fixed at aluminium's 95 for every metal)
      closedLoopPotential = metalData.Primary.closedLoopPotential;
    } else if (route === "Recycled") {
      // Recycled totals for the given mass
      const recycledTotals = this.calculateRecycledRoute(weightKg, metal);
      totalEnergy = recycledTotals.totalEnergy; // GJ
      totalCO2e = recycledTotals.totalCO2e; // kg CO2e
      totalWaste = recycledTotals.totalWaste; // kg

      const recycledData = metalData.Recycled;
      recyclability = recycledData.recyclability;
      closedLoopPotential = recycledData.closedLoopPotential;
    } else {
      // Hybrid Route - split mass by scrapFraction between Primary and Recycled
      const scrapRatio = Math.max(0, Math.min(100, scrapFraction)) / 100;
      const primaryRatio = 1 - scrapRatio;
      const weightRecycledKg = weightKg * scrapRatio;
      const weightPrimaryKg = weightKg * primaryRatio;

      const primaryPart = this.calculatePrimaryRoute(weightPrimaryKg, transportDistances, transportMode, metal);
      const recycledPart = this.calculateRecycledRoute(weightRecycledKg, metal);

      totalEnergy = primaryPart.totalEnergy + recycledPart.totalEnergy; // GJ
      totalCO2e = primaryPart.totalCO2e + recycledPart.totalCO2e; // kg
      totalWaste = primaryPart.totalWaste + recycledPart.totalWaste; // kg

      const primaryMeta = metalData.Primary;
      const recycledMeta = metalData.Recycled;
      recyclability = primaryMeta.recyclability * primaryRatio + recycledMeta.recyclability * scrapRatio;
      closedLoopPotential = primaryMeta.closedLoopPotential * primaryRatio + recycledMeta.closedLoopPotential * scrapRatio;
    }
    
    // Water (m3): cited per-tonne factors, mixed by the recycled share
    const recycledRatio = route === "Recycled" ? 1 : route === "Hybrid" ? Math.max(0, Math.min(100, scrapFraction)) / 100 : 0;
    const waterPrimary = metalData.Primary.water ?? 0, waterRecycled = metalData.Recycled.water ?? 0;
    const totalWater = ((1 - recycledRatio) * waterPrimary + recycledRatio * waterRecycled) * weightT;

    // Generate stage-wise breakdown
    const stageBreakdown = this.generateStageBreakdown(totalEnergy * 1000, totalCO2e, scrapFraction / 100, route, weightKg / 1000, transportDistances, transportMode, metal);
    
    // Generate material flow data
    const materialFlow = this.generateMaterialFlow(scrapFraction / 100, weightKg);
    
    // Generate insights
    const insights = this.generateInsights(inputData, { 
      energy: totalEnergy, 
      co2e: totalCO2e, 
      recyclability, 
      closedLoopPotential,
      waste: totalWaste 
    });
    
    return {
      keyIndicators: {
        totalEnergy: totalEnergy,
        totalCO2e: totalCO2e,
        totalWaste: totalWaste,
        totalWater: totalWater, // m3
        recyclability: Math.round(recyclability),
        closedLoopPotential: Math.round(closedLoopPotential)
      },
      stageBreakdown,
      materialFlow,
      insights,
      endOfLife: this.generateEndOfLifeData(metal, weightKg),
      recyclabilityDetails: this.generateRecyclabilityDetails(recyclability),
      closedLoopDetails: this.generateClosedLoopDetails(closedLoopPotential)
    };
  },

  // Recycled route totals for a given mass (kg). Energy and CO2 are the cited
  // recycled-route factors in baseData; waste comes from the stage constants below.
  calculateRecycledRoute: function(weightKg, metal = "Aluminium") {
    const ref = (this.baseData[metal] || this.baseData.Aluminium).Recycled;
    const raw = this.calculateRecycledRouteRaw(weightKg, metal);
    return {
      totalEnergy: (ref.energy * weightKg) / 1000, // GJ
      totalCO2e: ref.co2e * weightKg, // kg (t/t == kg/kg)
      totalWaste: raw.totalWaste // kg
    };
  },

  // Stage constants for the recycled route (used for waste)
  calculateRecycledRouteRaw: function(weightKg, metal = "Aluminium") {
    const weight = weightKg; // kg
    
    // Check if this is for Magnesium and use specific values
    if (metal === "Magnesium") {
      const stages = {
        scrapCollection: { energyMJ: 2.0, co2kg: 0.15, wasteKg: 0.05 },
        transportScrapToRecycler: { energyMJ: 1.5, co2kg: 0.10, wasteKg: 0.00 },
        remelting: { energyMJ: 8.0, co2kg: 0.8, wasteKg: 0.15 },
        casting: { energyMJ: 1.8, co2kg: 0.2, wasteKg: 0.03 },
        transportRecyclerToMarket: { energyMJ: 1.2, co2kg: 0.08, wasteKg: 0.00 }
      };

      const totalEnergyMJ = (
        stages.scrapCollection.energyMJ +
        stages.transportScrapToRecycler.energyMJ +
        stages.remelting.energyMJ +
        stages.casting.energyMJ +
        stages.transportRecyclerToMarket.energyMJ
      ) * weight;
      const totalCO2kg = (
        stages.scrapCollection.co2kg +
        stages.transportScrapToRecycler.co2kg +
        stages.remelting.co2kg +
        stages.casting.co2kg +
        stages.transportRecyclerToMarket.co2kg
      ) * weight;
      const totalWasteKg = (
        stages.scrapCollection.wasteKg +
        stages.transportScrapToRecycler.wasteKg +
        stages.remelting.wasteKg +
        stages.casting.wasteKg +
        stages.transportRecyclerToMarket.wasteKg
      ) * weight;

      return {
        totalEnergy: totalEnergyMJ / 1000, // GJ
        totalCO2e: totalCO2kg, // kg
        totalWaste: totalWasteKg // kg
      };
    }
    
    // Check if this is for Copper and use specific values
    if (metal === "Copper") {
      const stages = {
        scrapCollection: { energyMJ: 3.0, co2kg: 0.25, wasteKg: 0.1 },
        transportScrapToRecycler: { energyMJ: 2.0, co2kg: 0.15, wasteKg: 0.00 },
        remelting: { energyMJ: 10.0, co2kg: 1.0, wasteKg: 0.2 },
        casting: { energyMJ: 2.5, co2kg: 0.3, wasteKg: 0.05 },
        transportRecyclerToMarket: { energyMJ: 1.5, co2kg: 0.15, wasteKg: 0.00 }
      };

      const totalEnergyMJ = (
        stages.scrapCollection.energyMJ +
        stages.transportScrapToRecycler.energyMJ +
        stages.remelting.energyMJ +
        stages.casting.energyMJ +
        stages.transportRecyclerToMarket.energyMJ
      ) * weight;
      const totalCO2kg = (
        stages.scrapCollection.co2kg +
        stages.transportScrapToRecycler.co2kg +
        stages.remelting.co2kg +
        stages.casting.co2kg +
        stages.transportRecyclerToMarket.co2kg
      ) * weight;
      const totalWasteKg = (
        stages.scrapCollection.wasteKg +
        stages.transportScrapToRecycler.wasteKg +
        stages.remelting.wasteKg +
        stages.casting.wasteKg +
        stages.transportRecyclerToMarket.wasteKg
      ) * weight;

      return {
        totalEnergy: totalEnergyMJ / 1000, // GJ
        totalCO2e: totalCO2kg, // kg
        totalWaste: totalWasteKg // kg
      };
    }
    
    // Check if this is for Steel and use specific values
    if (metal === "Steel") {
      const stages = {
        scrapCollection: { energyMJ: 2.5, co2kg: 0.2, wasteKg: 0.08 },
        transportScrapToRecycler: { energyMJ: 1.8, co2kg: 0.12, wasteKg: 0.00 },
        remelting: { energyMJ: 7.0, co2kg: 0.5, wasteKg: 0.15 },
        casting: { energyMJ: 2.0, co2kg: 0.25, wasteKg: 0.04 },
        transportRecyclerToMarket: { energyMJ: 1.2, co2kg: 0.1, wasteKg: 0.00 }
      };

      const totalEnergyMJ = (
        stages.scrapCollection.energyMJ +
        stages.transportScrapToRecycler.energyMJ +
        stages.remelting.energyMJ +
        stages.casting.energyMJ +
        stages.transportRecyclerToMarket.energyMJ
      ) * weight;
      const totalCO2kg = (
        stages.scrapCollection.co2kg +
        stages.transportScrapToRecycler.co2kg +
        stages.remelting.co2kg +
        stages.casting.co2kg +
        stages.transportRecyclerToMarket.co2kg
      ) * weight;
      const totalWasteKg = (
        stages.scrapCollection.wasteKg +
        stages.transportScrapToRecycler.wasteKg +
        stages.remelting.wasteKg +
        stages.casting.wasteKg +
        stages.transportRecyclerToMarket.wasteKg
      ) * weight;

      return {
        totalEnergy: totalEnergyMJ / 1000, // GJ
        totalCO2e: totalCO2kg, // kg
        totalWaste: totalWasteKg // kg
      };
    }

    // Default values for Aluminum
    const stages = {
      scrapCollection: { energyMJ: 1.5, co2kg: 0.08, wasteKg: 0.02 },
      transportScrapToRecycler: { energyMJ: 1.8, co2kg: 0.12, wasteKg: 0.00 },
      remelting: { energyMJ: 5.7, co2kg: 0.35, wasteKg: 0.08 },
      casting: { energyMJ: 1.2, co2kg: 0.07, wasteKg: 0.02 },
      transportRecyclerToMarket: { energyMJ: 1.8, co2kg: 0.12, wasteKg: 0.00 }
    };

    const totalEnergyMJ = (
      stages.scrapCollection.energyMJ +
      stages.transportScrapToRecycler.energyMJ +
      stages.remelting.energyMJ +
      stages.casting.energyMJ +
      stages.transportRecyclerToMarket.energyMJ
    ) * weight;
    const totalCO2kg = (
      stages.scrapCollection.co2kg +
      stages.transportScrapToRecycler.co2kg +
      stages.remelting.co2kg +
      stages.casting.co2kg +
      stages.transportRecyclerToMarket.co2kg
    ) * weight;
    const totalWasteKg = (
      stages.scrapCollection.wasteKg +
      stages.transportScrapToRecycler.wasteKg +
      stages.remelting.wasteKg +
      stages.casting.wasteKg +
      stages.transportRecyclerToMarket.wasteKg
    ) * weight;

    return {
      totalEnergy: totalEnergyMJ / 1000, // GJ
      totalCO2e: totalCO2kg, // kg
      totalWaste: totalWasteKg // kg
    };
  },

  // Generate default results
  getDefaultResults: function() {
    return this.calculate({
      metal: "Aluminium",
      route: "Primary",
      scrapFraction: 0,
      weightKg: 1000,
      transportDistances: {
        mineToRefinery: 500,
        refineryToSmelter: 300,
        smelterToMarket: 200
      },
      transportMode: "Truck"
    });
  },

  // Calculate waste generation based on weight
  calculateWaste: function(metal, weightKg) {
    const wasteFactors = {
      Aluminium: 1.8, // tons waste per ton of metal
      Copper: 2.6, // Updated: 2,600 kg per tonne = 2.6 tons per ton
      Magnesium: 6, // Updated: 6,000 kg per tonne = 6 tons per ton
      Steel: 0.95 // 950 kg per tonne = 0.95 tons per ton
    };
    // Default to Aluminium if metal not found
    const factor = wasteFactors[metal] || wasteFactors.Aluminium;
    return Math.round((weightKg / 1000) * factor * 100) / 100; // Convert to tons
  },

  // Primary route, calibrated: each stage's SHARE comes from the per-stage constants
  // in calculatePrimaryRouteRaw, but the process stages are scaled so they add up to
  // the cited cradle-to-gate factor in baseData (energy and CO2), and transport uses
  // the DEFRA/GLEC freight factors. So every total traces back to a cited number.
  calculatePrimaryRoute: function(weightKg, transportDistances, transportMode = "Truck", metal = "Aluminium") {
    const raw = this.calculatePrimaryRouteRaw(weightKg, transportDistances, transportMode, metal);
    const ref = (this.baseData[metal] || this.baseData.Aluminium).Primary;
    const isTransport = (s) => s.stage.startsWith("Transport");
    const process = raw.stages.filter((s) => !isTransport(s));
    const co2Scale = (ref.co2e * weightKg) / (process.reduce((sum, s) => sum + s.co2e, 0) || 1);
    const energyScale = ((ref.energy * weightKg) / 1000) / (process.reduce((sum, s) => sum + s.energy, 0) || 1);

    const ef = this.transportEmissions; // kg CO2e per tonne-km
    const legs = {
      "Transport Mine→Refinery": [transportDistances.mineToRefinery, ef[transportMode] || ef.Truck],
      "Transport Refinery→Smelter": [transportDistances.refineryToSmelter, ef.Sea],
      "Transport Smelter→Market": [transportDistances.smelterToMarket, ef.Truck]
    };
    const stages = raw.stages.map((s) => {
      if (!isTransport(s)) return { ...s, co2e: s.co2e * co2Scale, energy: s.energy * energyScale };
      const [km, factor] = legs[s.stage] || [0, 0];
      return { ...s, co2e: (weightKg / 1000) * (km || 0) * factor }; // kg CO2e
    });

    return {
      stages,
      totalEnergy: stages.reduce((sum, s) => sum + s.energy, 0), // GJ
      totalCO2e: stages.reduce((sum, s) => sum + s.co2e, 0), // kg
      totalWaste: stages.reduce((sum, s) => sum + s.waste, 0) // kg
    };
  },

  // Per-kg stage constants for the primary route (stage shares) and transport per 100 km
  calculatePrimaryRouteRaw: function(weightKg, transportDistances, transportMode = "Truck", metal = "Aluminium") {
    const results = {
      stages: [],
      totalEnergy: 0,
      totalCO2e: 0,
      totalWaste: 0
    };

    // Check if this is for Magnesium and use specific values
    if (metal === "Magnesium") {
      // Magnesium specific values (per kg)
      const miningEnergyMJPerKg = 10.5; // Example value for Magnesium
      const miningCO2PerKg = 5.2; // Based on 39,300 kg CO2 per tonne
      const miningWasteKgPerKg = 0.8; // Based on 6,000 kg waste per tonne

      const refiningEnergyMJPerKg = 5.0; // Example value for Magnesium
      const refiningCO2PerKg = 8.5;
      const refiningWasteKgPerKg = 1.2;

      // Transport per 100 km (MJ/kg/100km, kgCO2/kg/100km)
      const t_mineToRef_energyMJ = 0.05;
      const t_mineToRef_co2Per100km = transportMode === "Rail" ? 0.005 : 0.025; // rail vs truck

      const t_refToSmelter_energyMJ = 0.03; // sea
      const t_refToSmelter_co2Per100km = 0.002;

      const t_smelterToMarket_energyMJ = 0.05; // road
      const t_smelterToMarket_co2Per100km = 0.02;

      const smeltingEnergyMJPerKg = 120.0; // Based on 638 GJ/tonne
      const smeltingCO2PerKg = 32.0; // Based on 39,300 kg CO2 per tonne
      const smeltingWasteKgPerKg = 0.8; // Based on 6,000 kg waste per tonne

      const castingEnergyMJPerKg = 3.0;
      const castingCO2PerKg = 1.5;
      const castingWasteKgPerKg = 0.3;

      // Stage 1: Mining
      const mining = {
        stage: "Mining",
        energy: (miningEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: miningCO2PerKg * weightKg, // kg CO₂e
        waste: miningWasteKgPerKg * weightKg // kg
      };
      results.stages.push(mining);

      // Stage 2: Refining
      const refining = {
        stage: "Refining",
        energy: (refiningEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: refiningCO2PerKg * weightKg, // kg CO₂e
        waste: refiningWasteKgPerKg * weightKg // kg
      };
      results.stages.push(refining);

      // Stage 3: Transport (Mine → Refinery, rail)
      const transport1 = {
        stage: "Transport Mine→Refinery",
        energy: (t_mineToRef_energyMJ * (transportDistances.mineToRefinery / 100) * weightKg) / 1000, // GJ
        co2e: t_mineToRef_co2Per100km * (transportDistances.mineToRefinery / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport1);

      // Stage 4: Transport (Refinery → Smelter, sea)
      const transport2 = {
        stage: "Transport Refinery→Smelter",
        energy: (t_refToSmelter_energyMJ * (transportDistances.refineryToSmelter / 100) * weightKg) / 1000, // GJ
        co2e: t_refToSmelter_co2Per100km * (transportDistances.refineryToSmelter / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport2);

      // Stage 5: Smelting
      const smelting = {
        stage: "Smelting",
        energy: (smeltingEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: smeltingCO2PerKg * weightKg, // kg CO₂e
        waste: smeltingWasteKgPerKg * weightKg // kg
      };
      results.stages.push(smelting);

      // Stage 6: Casting & Fabrication
      const casting = {
        stage: "Casting & Fabrication",
        energy: (castingEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: castingCO2PerKg * weightKg, // kg CO₂e
        waste: castingWasteKgPerKg * weightKg // kg
      };
      results.stages.push(casting);

      // Stage 7: Transport (Smelter → Market, truck)
      const transport3 = {
        stage: "Transport Smelter→Market",
        energy: (t_smelterToMarket_energyMJ * (transportDistances.smelterToMarket / 100) * weightKg) / 1000, // GJ
        co2e: t_smelterToMarket_co2Per100km * (transportDistances.smelterToMarket / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport3);

      // Calculate totals
      results.totalEnergy = results.stages.reduce((sum, stage) => sum + stage.energy, 0);
      results.totalCO2e = results.stages.reduce((sum, stage) => sum + stage.co2e, 0);
      results.totalWaste = results.stages.reduce((sum, stage) => sum + stage.waste, 0);

      return results;
    }
    
    // Check if this is for Copper and use specific values
    if (metal === "Copper") {
      // Copper specific values (per kg)
      const miningEnergyMJPerKg = 15.0; // Based on 45 GJ/tonne
      const miningCO2PerKg = 3.6; // Based on 3,600 kg CO2 per tonne
      const miningWasteKgPerKg = 2.6; // Based on 2,600 kg waste per tonne

      const refiningEnergyMJPerKg = 8.0; // Example value for Copper
      const refiningCO2PerKg = 5.0;
      const refiningWasteKgPerKg = 0.8;

      // Transport per 100 km (MJ/kg/100km, kgCO2/kg/100km)
      const t_mineToRef_energyMJ = 0.05;
      const t_mineToRef_co2Per100km = transportMode === "Rail" ? 0.005 : 0.025; // rail vs truck

      const t_refToSmelter_energyMJ = 0.03; // sea
      const t_refToSmelter_co2Per100km = 0.002;

      const t_smelterToMarket_energyMJ = 0.05; // road
      const t_smelterToMarket_co2Per100km = 0.02;

      const smeltingEnergyMJPerKg = 80.0; // Based on 45 GJ/tonne
      const smeltingCO2PerKg = 20.0; // Based on 3,600 kg CO2 per tonne
      const smeltingWasteKgPerKg = 1.0; // Based on 2,600 kg waste per tonne

      const castingEnergyMJPerKg = 4.0;
      const castingCO2PerKg = 2.0;
      const castingWasteKgPerKg = 0.5;

      // Stage 1: Mining
      const mining = {
        stage: "Mining",
        energy: (miningEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: miningCO2PerKg * weightKg, // kg CO₂e
        waste: miningWasteKgPerKg * weightKg // kg
      };
      results.stages.push(mining);

      // Stage 2: Refining
      const refining = {
        stage: "Refining",
        energy: (refiningEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: refiningCO2PerKg * weightKg, // kg CO₂e
        waste: refiningWasteKgPerKg * weightKg // kg
      };
      results.stages.push(refining);

      // Stage 3: Transport (Mine → Refinery, rail)
      const transport1 = {
        stage: "Transport Mine→Refinery",
        energy: (t_mineToRef_energyMJ * (transportDistances.mineToRefinery / 100) * weightKg) / 1000, // GJ
        co2e: t_mineToRef_co2Per100km * (transportDistances.mineToRefinery / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport1);

      // Stage 4: Transport (Refinery → Smelter, sea)
      const transport2 = {
        stage: "Transport Refinery→Smelter",
        energy: (t_refToSmelter_energyMJ * (transportDistances.refineryToSmelter / 100) * weightKg) / 1000, // GJ
        co2e: t_refToSmelter_co2Per100km * (transportDistances.refineryToSmelter / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport2);

      // Stage 5: Smelting
      const smelting = {
        stage: "Smelting",
        energy: (smeltingEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: smeltingCO2PerKg * weightKg, // kg CO₂e
        waste: smeltingWasteKgPerKg * weightKg // kg
      };
      results.stages.push(smelting);

      // Stage 6: Casting & Fabrication
      const casting = {
        stage: "Casting & Fabrication",
        energy: (castingEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: castingCO2PerKg * weightKg, // kg CO₂e
        waste: castingWasteKgPerKg * weightKg // kg
      };
      results.stages.push(casting);

      // Stage 7: Transport (Smelter → Market, truck)
      const transport3 = {
        stage: "Transport Smelter→Market",
        energy: (t_smelterToMarket_energyMJ * (transportDistances.smelterToMarket / 100) * weightKg) / 1000, // GJ
        co2e: t_smelterToMarket_co2Per100km * (transportDistances.smelterToMarket / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport3);

      // Calculate totals
      results.totalEnergy = results.stages.reduce((sum, stage) => sum + stage.energy, 0);
      results.totalCO2e = results.stages.reduce((sum, stage) => sum + stage.co2e, 0);
      results.totalWaste = results.stages.reduce((sum, stage) => sum + stage.waste, 0);

      return results;
    }
    
    // Check if this is for Steel and use specific values
    if (metal === "Steel") {
      // Steel specific values (per kg)
      const miningEnergyMJPerKg = 9.0; // Based on 27.5 GJ/tonne
      const miningCO2PerKg = 2.0; // Based on 2,000 kg CO2 per tonne
      const miningWasteKgPerKg = 0.95; // Based on 950 kg waste per tonne

      const refiningEnergyMJPerKg = 6.0; // Example value for Steel
      const refiningCO2PerKg = 4.0;
      const refiningWasteKgPerKg = 0.5;

      // Transport per 100 km (MJ/kg/100km, kgCO2/kg/100km)
      const t_mineToRef_energyMJ = 0.05;
      const t_mineToRef_co2Per100km = transportMode === "Rail" ? 0.005 : 0.025; // rail vs truck

      const t_refToSmelter_energyMJ = 0.03; // sea
      const t_refToSmelter_co2Per100km = 0.002;

      const t_smelterToMarket_energyMJ = 0.05; // road
      const t_smelterToMarket_co2Per100km = 0.02;

      const smeltingEnergyMJPerKg = 50.0; // Based on 27.5 GJ/tonne
      const smeltingCO2PerKg = 10.0; // Based on 2,000 kg CO2 per tonne
      const smeltingWasteKgPerKg = 0.5; // Based on 950 kg waste per tonne

      const castingEnergyMJPerKg = 3.5;
      const castingCO2PerKg = 1.5;
      const castingWasteKgPerKg = 0.3;

      // Stage 1: Mining
      const mining = {
        stage: "Mining",
        energy: (miningEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: miningCO2PerKg * weightKg, // kg CO₂e
        waste: miningWasteKgPerKg * weightKg // kg
      };
      results.stages.push(mining);

      // Stage 2: Refining
      const refining = {
        stage: "Refining",
        energy: (refiningEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: refiningCO2PerKg * weightKg, // kg CO₂e
        waste: refiningWasteKgPerKg * weightKg // kg
      };
      results.stages.push(refining);

      // Stage 3: Transport (Mine → Refinery, rail)
      const transport1 = {
        stage: "Transport Mine→Refinery",
        energy: (t_mineToRef_energyMJ * (transportDistances.mineToRefinery / 100) * weightKg) / 1000, // GJ
        co2e: t_mineToRef_co2Per100km * (transportDistances.mineToRefinery / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport1);

      // Stage 4: Transport (Refinery → Smelter, sea)
      const transport2 = {
        stage: "Transport Refinery→Smelter",
        energy: (t_refToSmelter_energyMJ * (transportDistances.refineryToSmelter / 100) * weightKg) / 1000, // GJ
        co2e: t_refToSmelter_co2Per100km * (transportDistances.refineryToSmelter / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport2);

      // Stage 5: Smelting
      const smelting = {
        stage: "Smelting",
        energy: (smeltingEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: smeltingCO2PerKg * weightKg, // kg CO₂e
        waste: smeltingWasteKgPerKg * weightKg // kg
      };
      results.stages.push(smelting);

      // Stage 6: Casting & Fabrication
      const casting = {
        stage: "Casting & Fabrication",
        energy: (castingEnergyMJPerKg * weightKg) / 1000, // GJ
        co2e: castingCO2PerKg * weightKg, // kg CO₂e
        waste: castingWasteKgPerKg * weightKg // kg
      };
      results.stages.push(casting);

      // Stage 7: Transport (Smelter → Market, truck)
      const transport3 = {
        stage: "Transport Smelter→Market",
        energy: (t_smelterToMarket_energyMJ * (transportDistances.smelterToMarket / 100) * weightKg) / 1000, // GJ
        co2e: t_smelterToMarket_co2Per100km * (transportDistances.smelterToMarket / 100) * weightKg, // kg CO₂e
        waste: 0
      };
      results.stages.push(transport3);

      // Calculate totals
      results.totalEnergy = results.stages.reduce((sum, stage) => sum + stage.energy, 0);
      results.totalCO2e = results.stages.reduce((sum, stage) => sum + stage.co2e, 0);
      results.totalWaste = results.stages.reduce((sum, stage) => sum + stage.waste, 0);

      return results;
    }

    // Constants (per kg unless noted) - Original Aluminum values
    const miningEnergyMJPerKg = 0.5 + 0.504; // include onsite electricity
    const miningCO2PerKg = 0.10;
    const miningWasteKgPerKg = 0.5;

    const refiningEnergyMJPerKg = 3.75; // midpoint of 3.5–4.0
    const refiningCO2PerKg = 2.6;
    const refiningRedMudKgPerKg = 0.7;

    // Transport per 100 km (MJ/kg/100km, kgCO2/kg/100km)
    const t_mineToRef_energyMJ = 0.05;
    const t_mineToRef_co2Per100km = transportMode === "Rail" ? 0.005 : 0.025; // rail vs truck

    const t_refToSmelter_energyMJ = 0.03; // sea
    const t_refToSmelter_co2Per100km = 0.002;

    const t_smelterToMarket_energyMJ = 0.05; // road
    const t_smelterToMarket_co2Per100km = 0.02;

    const smeltingEnergyMJPerKg = 55.44; // 15.4 kWh/kg × 3.6
    const smeltingCO2PerKg = 12.0;
    const smeltingWasteKgPerKg = 0.3 + 0.02; // SPL + fluoride dust

    const castingEnergyMJPerKg = 2.0;
    const castingCO2PerKg = 0.25;
    const castingWasteKgPerKg = 0.1;

    // Stage 1: Bauxite Mining
    const mining = {
      stage: "Bauxite Mining",
      energy: (miningEnergyMJPerKg * weightKg) / 1000, // GJ
      co2e: miningCO2PerKg * weightKg, // kg CO₂e
      waste: miningWasteKgPerKg * weightKg // kg
    };
    results.stages.push(mining);

    // Stage 2: Alumina Refining (Bayer)
    const refining = {
      stage: "Alumina Refining",
      energy: (refiningEnergyMJPerKg * weightKg) / 1000, // GJ
      co2e: refiningCO2PerKg * weightKg, // kg CO₂e
      waste: refiningRedMudKgPerKg * weightKg // kg red mud
    };
    results.stages.push(refining);

    // Stage 3: Transport (Mine → Refinery, rail)
    const transport1 = {
      stage: "Transport Mine→Refinery",
      energy: (t_mineToRef_energyMJ * (transportDistances.mineToRefinery / 100) * weightKg) / 1000, // GJ
      co2e: t_mineToRef_co2Per100km * (transportDistances.mineToRefinery / 100) * weightKg, // kg CO₂e
      waste: 0
    };
    results.stages.push(transport1);

    // Stage 4: Transport (Refinery → Smelter, sea)
    const transport2 = {
      stage: "Transport Refinery→Smelter",
      energy: (t_refToSmelter_energyMJ * (transportDistances.refineryToSmelter / 100) * weightKg) / 1000, // GJ
      co2e: t_refToSmelter_co2Per100km * (transportDistances.refineryToSmelter / 100) * weightKg, // kg CO₂e
      waste: 0
    };
    results.stages.push(transport2);

    // Stage 5: Smelting (Hall–Héroult)
    const smelting = {
      stage: "Smelting (Hall-Héroult)",
      energy: (smeltingEnergyMJPerKg * weightKg) / 1000, // GJ
      co2e: smeltingCO2PerKg * weightKg, // kg CO₂e
      waste: smeltingWasteKgPerKg * weightKg // kg
    };
    results.stages.push(smelting);

    // Stage 6: Casting & Fabrication
    const casting = {
      stage: "Casting & Fabrication",
      energy: (castingEnergyMJPerKg * weightKg) / 1000, // GJ
      co2e: castingCO2PerKg * weightKg, // kg CO₂e
      waste: castingWasteKgPerKg * weightKg // kg dross
    };
    results.stages.push(casting);

    // Stage 7: Transport (Smelter → Market, truck)
    const transport3 = {
      stage: "Transport Smelter→Market",
      energy: (t_smelterToMarket_energyMJ * (transportDistances.smelterToMarket / 100) * weightKg) / 1000, // GJ
      co2e: t_smelterToMarket_co2Per100km * (transportDistances.smelterToMarket / 100) * weightKg, // kg CO₂e
      waste: 0
    };
    results.stages.push(transport3);

    // Calculate totals
    results.totalEnergy = results.stages.reduce((sum, stage) => sum + stage.energy, 0);
    results.totalCO2e = results.stages.reduce((sum, stage) => sum + stage.co2e, 0);
    results.totalWaste = results.stages.reduce((sum, stage) => sum + stage.waste, 0);

    return results;
  },

  // Generate stage-wise breakdown
  generateStageBreakdown: function(totalEnergyMJ, totalCO2kg, scrapRatio, route, weightT, transportDistances, transportMode = "Truck", metal = "Aluminium") {
    if (route === "Primary") {
      // Use precise Primary Route calculations ONLY for Primary Route
      const primaryResults = this.calculatePrimaryRoute(weightT * 1000, transportDistances, transportMode, metal);
      
      return {
        energy: primaryResults.stages.map(stage => ({
          stage: stage.stage,
          value: Math.round(stage.energy * 10) / 10 // GJ
        })),
        co2e: primaryResults.stages.map(stage => ({
          stage: stage.stage,
          value: Math.round(stage.co2e) // kg
        })),
        waste: primaryResults.stages.map(stage => ({
          stage: stage.stage,
          value: Math.round(stage.waste) // kg
        }))
      };
    } else if (route === "Recycled") {
      // Recycled route stage list. Totals are this metal's; the split between stages uses the
      // aluminium recycled-route shares as a template (an assumption, documented in REPRODUCIBILITY.md).
      const totalWasteKg = this.calculateRecycledRouteRaw(weightT * 1000, metal).totalWaste; // same total as the key indicators
      return {
        energy: [
          { stage: "Scrap Collection", value: Math.round((1.5 / 12.0) * (totalEnergyMJ / 1000) * 10) / 10 },
          { stage: "Transport (Scrap → Recycler)", value: Math.round((1.8 / 12.0) * (totalEnergyMJ / 1000) * 10) / 10 },
          { stage: "Remelting", value: Math.round((5.7 / 12.0) * (totalEnergyMJ / 1000) * 10) / 10 },
          { stage: "Casting", value: Math.round((1.2 / 12.0) * (totalEnergyMJ / 1000) * 10) / 10 },
          { stage: "Transport (Recycler → Market)", value: Math.round((1.8 / 12.0) * (totalEnergyMJ / 1000) * 10) / 10 }
        ],
        co2e: [
          { stage: "Scrap Collection", value: Math.round((0.08 / 0.74) * totalCO2kg) },
          { stage: "Transport (Scrap → Recycler)", value: Math.round((0.12 / 0.74) * totalCO2kg) },
          { stage: "Remelting", value: Math.round((0.35 / 0.74) * totalCO2kg) },
          { stage: "Casting", value: Math.round((0.07 / 0.74) * totalCO2kg) },
          { stage: "Transport (Recycler → Market)", value: Math.round((0.12 / 0.74) * totalCO2kg) }
        ],
        waste: [
          { stage: "Scrap Collection", value: Math.round(totalWasteKg * (0.02 / 0.12)) },
          { stage: "Transport (Scrap → Recycler)", value: 0 },
          { stage: "Remelting", value: Math.round(totalWasteKg * (0.08 / 0.12)) },
          { stage: "Casting", value: Math.round(totalWasteKg * (0.02 / 0.12)) },
          { stage: "Transport (Recycler → Market)", value: 0 }
        ]
      };
    } else {
      // Hybrid route - combine precise primary and recycled stage lists by mass split
      const weightPrimaryKg = weightT * 1000 * (1 - scrapRatio);
      const weightRecycledKg = weightT * 1000 * scrapRatio;
      const primaryResults = this.calculatePrimaryRoute(weightPrimaryKg, transportDistances, transportMode, metal);
      // recycled part uses the cited recycled-route factors of THIS metal (same as calculateRecycledRoute)
      const recycledRef = (this.baseData[metal] || this.baseData.Aluminium).Recycled;
      const recycledTotalEnergyMJ = weightRecycledKg * recycledRef.energy; // GJ/t == MJ/kg
      const recycledTotalCO2kg = weightRecycledKg * recycledRef.co2e; // t/t == kg/kg
      const recycledWasteKg = this.calculateRecycledRouteRaw(weightRecycledKg, metal).totalWaste; // this metal's recycled waste

      const hybridEnergy = [
        ...primaryResults.stages.map(s => ({ stage: s.stage + " (Primary)", value: Math.round(s.energy * 10) / 10 })),
        { stage: "Scrap Collection (Recycled)", value: Math.round((1.5 / 12.0) * recycledTotalEnergyMJ / 1000 * 10) / 10 },
        { stage: "Transport (Scrap → Recycler) (Recycled)", value: Math.round((1.8 / 12.0) * recycledTotalEnergyMJ / 1000 * 10) / 10 },
        { stage: "Remelting (Recycled)", value: Math.round((5.7 / 12.0) * recycledTotalEnergyMJ / 1000 * 10) / 10 },
        { stage: "Casting (Recycled)", value: Math.round((1.2 / 12.0) * recycledTotalEnergyMJ / 1000 * 10) / 10 },
        { stage: "Transport (Recycler → Market) (Recycled)", value: Math.round((1.8 / 12.0) * recycledTotalEnergyMJ / 1000 * 10) / 10 }
      ];

      const hybridCO2 = [
        ...primaryResults.stages.map(s => ({ stage: s.stage + " (Primary)", value: Math.round(s.co2e) })),
        { stage: "Scrap Collection (Recycled)", value: Math.round((0.08 / 0.74) * recycledTotalCO2kg) },
        { stage: "Transport (Scrap → Recycler) (Recycled)", value: Math.round((0.12 / 0.74) * recycledTotalCO2kg) },
        { stage: "Remelting (Recycled)", value: Math.round((0.35 / 0.74) * recycledTotalCO2kg) },
        { stage: "Casting (Recycled)", value: Math.round((0.07 / 0.74) * recycledTotalCO2kg) },
        { stage: "Transport (Recycler → Market) (Recycled)", value: Math.round((0.12 / 0.74) * recycledTotalCO2kg) }
      ];

      const hybridWaste = [
        ...primaryResults.stages.map(s => ({ stage: s.stage + " (Primary)", value: Math.round(s.waste) })),
        { stage: "Scrap Collection (Recycled)", value: Math.round(recycledWasteKg * (0.02 / 0.12)) },
        { stage: "Transport (Scrap → Recycler) (Recycled)", value: 0 },
        { stage: "Remelting (Recycled)", value: Math.round(recycledWasteKg * (0.08 / 0.12)) },
        { stage: "Casting (Recycled)", value: Math.round(recycledWasteKg * (0.02 / 0.12)) },
        { stage: "Transport (Recycler → Market) (Recycled)", value: 0 }
      ];

      return { energy: hybridEnergy, co2e: hybridCO2, waste: hybridWaste };
    }
  },

  // Generate material flow data for Sankey diagram
  generateMaterialFlow: function(scrapRatio, weightKg = 1000) {
    const primaryRatio = 1 - scrapRatio;
    const weightTons = weightKg / 1000;
    
    return {
      nodes: [
        { id: "ore", name: "Ore", value: primaryRatio * weightTons },
        { id: "scrap", name: "Scrap", value: scrapRatio * weightTons },
        { id: "refining", name: "Refining", value: weightTons },
        { id: "smelting", name: "Smelting", value: weightTons * 0.95 },
        { id: "casting", name: "Casting", value: weightTons * 0.90 },
        { id: "product", name: "Metal Product", value: weightTons * 0.85 },
        { id: "waste", name: "Waste", value: weightTons * 0.15 },
        { id: "recycle", name: "Recycle", value: weightTons * 0.70 }
      ],
      links: [
        { source: "ore", target: "refining", value: primaryRatio * weightTons },
        { source: "scrap", target: "refining", value: scrapRatio * weightTons },
        { source: "refining", target: "smelting", value: weightTons * 0.95 },
        { source: "smelting", target: "casting", value: weightTons * 0.90 },
        { source: "casting", target: "product", value: weightTons * 0.85 },
        { source: "product", target: "waste", value: weightTons * 0.15 },
        { source: "product", target: "recycle", value: weightTons * 0.70 }
      ]
    };
  },

  // Generate AI insights
  generateInsights: function(inputData, results) {
    const insights = [];
    
    // Check if results object exists and has required properties
    if (!results) {
      return insights;
    }
    
    const { co2e, recyclability } = results;
    
    // Check if co2e and recyclability exist
    if (co2e === undefined || recyclability === undefined) {
      return insights;
    }
    
    // recycled share actually used (the Recycled route is 100% scrap, scrapFraction only applies to Hybrid)
    const share = inputData.route === "Recycled" ? 100 : inputData.route === "Hybrid" ? inputData.scrapFraction : 0;
    const metalData = this.baseData[inputData.metal] || this.baseData.Aluminium;

    if (share > 0) {
      // co2e is total kg for the order; compare with the same order made from primary metal
      const primaryKg = metalData.Primary.co2e * inputData.weightKg;
      const reduction = Math.round((1 - co2e / primaryKg) * 100);
      insights.push({
        type: "positive",
        message: `Using ${share}% recycled ${inputData.metal.toLowerCase()} reduces CO₂e by ${reduction}% for ${inputData.weightKg} kg`
      });
    }

    if (inputData.transportMode === "Truck") {
      insights.push({
        type: "warning",
        message: "Rail or sea freight emits 65–76% less CO₂ per tonne-km than trucks (0.022 / 0.015 vs 0.062 kg, DEFRA/GLEC)"
      });
    }
    
    if (recyclability > 90) {
      insights.push({
        type: "positive",
        message: `${inputData.metal} has excellent recyclability potential at ${recyclability}%`
      });
    }
    
    if (inputData.weightKg > 5000) {
      insights.push({
        type: "suggestion",
        message: `Large quantities (${inputData.weightKg} kg) make recycling even more cost-effective and impactful`
      });
    }
    
    if (share < 50) {
      // saving from moving the recycled share from where it is now up to 50%
      const potentialSavings = Math.round((metalData.Primary.co2e - metalData.Recycled.co2e) * inputData.weightKg * (0.5 - share / 100));
      insights.push({
        type: "suggestion",
        message: `Increasing recycled content to 50% could save ${potentialSavings.toLocaleString()} kg CO₂e`
      });
    }
    
    return insights;
  },

  // Generate end of life data
  generateEndOfLifeData: function(metal, weightKg = 1000) {
    const wasteData = {
      Aluminium: {
        redMud: 0.7,
        splWaste: 0.3,
        recycleRate: 75,
        landfillRate: 25
      },
      Copper: {
        slag: 2.6, // Updated: 2,600 kg per tonne = 2.6 tons per ton
        tailings: 0.2, // Updated: 200 kg per tonne = 0.2 tons per ton
        recycleRate: 80,
        landfillRate: 20
      },
      Magnesium: {
        oxideWaste: 6, // Updated: 6,000 kg per tonne = 6 tons per ton
        processWaste: 0.235, // Updated: 235 kg per tonne = 0.235 tons per ton
        recycleRate: 70,
        landfillRate: 30
      },
      Steel: {
        oxideWaste: 0.95, // 950 kg per tonne = 0.95 tons per ton
        processWaste: 0.075, // 75 kg per tonne = 0.075 tons per ton
        recycleRate: 85,
        landfillRate: 15
      }
    };
    
    // Default to Aluminium if metal not found
    const baseData = wasteData[metal] || wasteData.Aluminium;
    const weightTons = weightKg / 1000;
    
    // Scale waste quantities by weight
    const scaledData = { ...baseData };
    Object.keys(baseData).forEach(key => {
      if (key !== 'recycleRate' && key !== 'landfillRate') {
        scaledData[key] = Math.round(baseData[key] * weightTons * 100) / 100;
      }
    });
    
    return scaledData;
  },

  // Generate recyclability details
  generateRecyclabilityDetails: function(recyclability) {
    return {
      recoverable: recyclability,
      losses: 100 - recyclability,
      factors: [
        { factor: "Material Quality", impact: "High", description: "Clean separation improves recovery" },
        { factor: "Collection Efficiency", impact: "Medium", description: "Infrastructure affects collection rates" },
        { factor: "Processing Technology", impact: "High", description: "Advanced sorting increases yield" }
      ]
    };
  },

  // Generate closed loop details
  generateClosedLoopDetails: function(closedLoopPotential) {
    return {
      circularityScore: closedLoopPotential,
      reuseLoops: Math.floor(closedLoopPotential / 20),
      barriers: [
        { barrier: "Contamination", severity: closedLoopPotential > 80 ? "Low" : "Medium" },
        { barrier: "Market Demand", severity: "Low" },
        { barrier: "Technology Gaps", severity: closedLoopPotential > 70 ? "Low" : "High" }
      ]
    };
  }
};