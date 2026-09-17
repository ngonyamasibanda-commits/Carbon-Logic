import type { CategoryConfig, UnitOption } from './types'
import { HOTEL_COUNTRY_OPTIONS, hotelFactorKey } from './factor-catalog'
import { CEDA_SECTOR_OPTIONS, cedaSectorByName } from './ceda'
import {
  AIR_HAULS,
  BUS_TYPES,
  CAR_SEGMENTS,
  CAR_SIZES,
  FERRY_TYPES,
  HGV_SIZE_OPTIONS,
  HOMEWORKING_OPTIONS,
  LADEN_OPTIONS,
  MATERIAL_NAMES,
  MOTORBIKE_SIZES,
  RAIL_TYPES,
  REFRIGERANT_OPTIONS,
  RF_OPTIONS,
  SEA_VESSEL_OPTIONS,
  COMMON_REFRIGERANTS,
  GENERIC_WASTE_TYPES,
  CONSTRUCTION_WASTE_TYPES,
  WTT_ELECTRICITY_OPTIONS,
  WTT_LEGACY_OPTIONS,
  roadFreightFactorKey,
  SITE_FUEL_OPTIONS,
  VAN_CLASSES,
  WASTE_TYPES,
  airFreightFactorKey,
  canonicalFuelName,
  carFactorKey,
  carFuelsFor,
  energyFactorKey,
  energyFactorUnit,
  ferryFactorKey,
  flightFactorKey,
  hgvFactorKey,
  homeworkingFactorKey,
  isElectricityWttSource,
  isHomeworkingMode,
  isVehicleKmMetric,
  landTravelFactorKey,
  materialFactorKey,
  motoFactorKey,
  materialOriginsFor,
  publishedUnitsForFuel,
  refrigerantFactorKey,
  seaFactorKey,
  seaSizesFor,
  vanFactorKey,
  vanFuelsFor,
  wasteFactorKey,
  wasteRoutesFor,
  wttEnergyKey,
} from './desnz-detail'

// ── Shared unit option sets ─────────────────────────────────────────────────

const FUEL_VOLUME_UNITS: UnitOption[] = [
  { label: 'Litres (L)', value: 'L', toBase: 1 },
  { label: 'Cubic metres (m³)', value: 'm³', toBase: 1000 },
  { label: 'UK gallons (gal)', value: 'gal (UK)', toBase: 4.54609 },
  { label: 'US gallons (gal)', value: 'gal (US)', toBase: 3.78541 },
]

const ELECTRICITY_UNITS: UnitOption[] = [
  { label: 'Kilowatt-hours (kWh)', value: 'kWh', toBase: 1 },
  { label: 'Megawatt-hours (MWh)', value: 'MWh', toBase: 1000 },
  { label: 'Gigajoules (GJ)', value: 'GJ', toBase: 277.778 },
]

const MASS_KG_UNITS: UnitOption[] = [
  { label: 'Kilograms (kg)', value: 'kg', toBase: 1 },
  { label: 'Tonnes (t)', value: 't', toBase: 1000 },
  { label: 'Pounds (lb)', value: 'lb', toBase: 0.453592 },
]

const MASS_TONNE_UNITS: UnitOption[] = [
  { label: 'Tonnes (t)', value: 't', toBase: 1 },
  { label: 'Kilograms (kg)', value: 'kg', toBase: 0.001 },
  { label: 'Kilotonnes (kt)', value: 'kt', toBase: 1000 },
]

const DISTANCE_KM_UNITS: UnitOption[] = [
  { label: 'Kilometres (km)', value: 'km', toBase: 1 },
  { label: 'Miles (mi)', value: 'mi', toBase: 1.60934 },
  { label: 'Nautical miles (nmi)', value: 'nmi', toBase: 1.852 },
]

const WATER_VOLUME_UNITS: UnitOption[] = [
  { label: 'Cubic metres (m³)', value: 'm³', toBase: 1 },
  { label: 'Litres (L)', value: 'L', toBase: 0.001 },
  { label: 'Kilolitres (kL)', value: 'kL', toBase: 1 },
  { label: 'UK gallons (gal)', value: 'gal (UK)', toBase: 0.00454609 },
]

function num(values: Record<string, string>, key: string) {
  return Number(values[key] || 0)
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'site_electricity',
    name: 'Site Electricity',
    scope: 'Scope 2',
    group: 'input',
    instructions:
      'Enter purchased or on-site electricity used at construction sites, mines, processing plants, depots, and warehouses. Location-based Scope 2 uses the DESNZ UK grid factor unless you select the US eGRID average. For purchased electricity, record the market-based instrument (supplier factor, retired REGO/GoO/REC, or residual mix). Link utility bills in Additional Data.',
    fields: [
      {
        key: 'source',
        label: 'Energy source',
        type: 'select',
        options: [
          'Purchased electricity (UK grid)',
          'Purchased electricity (US eGRID average)',
          'On-site renewable electricity',
        ],
      },
      {
        key: 'amount',
        label: 'Usage in kWh',
        type: 'number',
        hint: 'Estimate from meter readings or floor area if bills are incomplete.',
      },
    ],
    amountField: 'amount',
    amountLabel: 'kWh',
    unitOptions: ELECTRICITY_UNITS,
    chainExtras: ['td', 'wtt'],
    resolveFactorKey: (v) => {
      if (v.source?.includes('renewable')) return 'electricity_renewable_kwh'
      if (v.source?.includes('eGRID') || v.source?.includes('US')) return 'electricity_us_egrid_kwh'
      return 'electricity_grid_kwh'
    },
    resolveUnit: (v) => v.unit || 'kWh',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'kWh'} of ${v.source || 'electricity'}`,
  },
  {
    id: 'site_fuel',
    name: 'Site Fuel',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Log the DESNZ 2026 fuel the site actually combusted: gaseous, liquid, solid, and bioenergy rows, in the published unit (litres, tonnes, m³, kWh net or gross). Forecourt diesel/petrol use the average biofuel blend; 100% mineral is a separate row. Litres or kWh of fuel are more accurate than vehicle-km when you have them.',
    fields: [
      {
        key: 'fuel',
        label: 'Fuel (DESNZ 2026)',
        type: 'select',
        options: SITE_FUEL_OPTIONS,
      },
      {
        key: 'fuel_basis',
        label: 'Published unit',
        type: 'select',
        optionsFrom: (v) => publishedUnitsForFuel(canonicalFuelName(v.fuel || 'Diesel (average biofuel blend)')),
        hint: 'Only units DESNZ publishes for this fuel are listed. Energy bills are usually kWh Gross CV.',
      },
      {
        key: 'amount',
        label: 'Fuel amount',
        type: 'number',
        hint: 'Amount of fuel used, in the published unit (or a converted unit below).',
      },
    ],
    amountField: 'amount',
    amountLabel: 'L',
    unitOptions: FUEL_VOLUME_UNITS,
    chainExtras: ['wtt'],
    resolveFactorKey: (v) => energyFactorKey(v.fuel || 'Diesel / gas oil', v.fuel_basis),
    resolveUnit: (v) => energyFactorUnit(v.fuel || 'Diesel / gas oil', v.fuel_basis) || v.unit || 'L',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'L'} of ${v.fuel || 'fuel'}`,
  },
  {
    id: 'heavy_machinery',
    name: 'Heavy Machinery',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Capture fuel burned by excavators, haul trucks, drills, loaders, crushers, and other owned plant at construction sites and mines.',
    fields: [
      {
        key: 'equipment',
        label: 'Equipment type',
        type: 'select',
        options: [
          'Excavator',
          'Haul truck',
          'Drill rig',
          'Loader / dozer',
          'Underground LHD',
          'Crusher / mill',
          'Dragline',
          'Crane',
          'Concrete mixer',
          'Other plant',
        ],
      },
      {
        key: 'fuel',
        label: 'Fuel type (DESNZ 2026)',
        type: 'select',
        options: [
          'Diesel / red diesel',
          'Gas oil',
          'Diesel (average biofuel blend)',
          'HVO',
          'Biodiesel HVO',
          'Petrol',
          ...SITE_FUEL_OPTIONS.filter(
            (name) =>
              !['Diesel / gas oil', 'Diesel (average biofuel blend)', 'Gas oil', 'Petrol', 'HVO'].includes(name),
          ),
        ],
      },
      {
        key: 'fuel_basis',
        label: 'Published unit',
        type: 'select',
        optionsFrom: (v) => {
          const fuel =
            v.fuel === 'Diesel / red diesel' || v.fuel === 'HVO'
              ? v.fuel === 'HVO'
                ? 'Biodiesel HVO'
                : 'Gas oil'
              : canonicalFuelName(v.fuel || 'Gas oil')
          return publishedUnitsForFuel(fuel)
        },
        optional: true,
      },
      {
        key: 'amount',
        label: 'Fuel used',
        type: 'number',
      },
    ],
    amountField: 'amount',
    amountLabel: 'L',
    unitOptions: FUEL_VOLUME_UNITS,
    chainExtras: ['wtt'],
    resolveFactorKey: (v) => {
      if (v.fuel === 'HVO' || v.fuel === 'Biodiesel HVO') {
        return energyFactorKey('Biodiesel HVO', v.fuel_basis || 'litres')
      }
      if (v.fuel === 'Diesel / red diesel') {
        return energyFactorKey('Gas oil', v.fuel_basis || 'litres')
      }
      return energyFactorKey(v.fuel || 'Gas oil', v.fuel_basis)
    },
    resolveUnit: (v) =>
      energyFactorUnit(
        v.fuel === 'Diesel / red diesel' ? 'Gas oil' : v.fuel === 'HVO' ? 'Biodiesel HVO' : v.fuel || 'Gas oil',
        v.fuel_basis,
      ) || v.unit || 'L',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'L'} ${v.fuel || 'diesel'} — ${v.equipment || 'plant'}`,
  },
  {
    id: 'explosives',
    name: 'Explosives & blasting',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Log ANFO, emulsion, or other explosives used in blasting at mines and quarries. Combustion CO₂ from the blast is Scope 1. Prefer a manufacturer or site-specific factor when you have one; the catalogue uses the Australian NPI explosives detonation mass-balance defaults.',
    fields: [
      {
        key: 'type',
        label: 'Explosive type',
        type: 'select',
        options: ['ANFO', 'Emulsion', 'Other blasting agent'],
      },
      {
        key: 'amount',
        label: 'Mass used',
        type: 'number',
        hint: 'Mass of explosive consumed in the reporting period.',
      },
    ],
    amountField: 'amount',
    amountLabel: 'kg',
    unitOptions: MASS_KG_UNITS,
    resolveFactorKey: (v) => (v.type === 'Emulsion' ? 'explosives_emulsion_kg' : 'explosives_anfo_kg'),
    resolveUnit: (v) => v.unit || 'kg',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'kg'} ${v.type || 'explosives'}`,
  },
  {
    id: 'fleet',
    name: 'Fleet Vehicles',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Company-owned vans, cars, motorbikes, and HGVs. DESNZ Method 1 (litres or kWh) is more accurate when you have it. Method 2 uses the Delivery vehicles / Passenger vehicles tables: van class I–III, HGV rigid/artic by GVW, laden %, refrigerated vs not, and car size or SMMT segment × fuel. Mine haul trucks belong under Heavy Machinery. Hired vehicles use the same factors in Scope 3 (Road freight). PHEV/BEV km rows are combustion only — tick UK electricity for EVs for Scope 2.',
    fields: [
      {
        key: 'method',
        label: 'How the activity is measured',
        type: 'select',
        options: [
          'Fuel litres (Method 1 — preferred when known)',
          'Distance (Method 2 — vehicle km)',
        ],
        hint: 'DESNZ: use fuels or electricity conversion factors when litres or kWh are known.',
      },
      {
        key: 'ownership',
        label: 'Ownership',
        type: 'select',
        options: ['Company-owned (Scope 1)', 'Hired vehicle (Scope 3)'],
        hint: 'Hired or grey-fleet vehicles use the same DESNZ factors but are Scope 3.',
      },
      {
        key: 'vehicle',
        label: 'Vehicle family',
        type: 'select',
        options: [
          'Van / pickup',
          'Van',
          'Light vehicle',
          'HGV',
          'Company car',
          'Company car (by size)',
          'Company car (by market segment)',
          'Motorbike',
        ],
      },
      {
        key: 'fuel',
        label: 'Fuel (Method 1)',
        type: 'select',
        options: SITE_FUEL_OPTIONS,
        visibleWhen: { field: 'method', equals: 'Fuel litres (Method 1 — preferred when known)' },
      },
      {
        key: 'fuel_basis',
        label: 'Published unit (Method 1)',
        type: 'select',
        optionsFrom: (v) => publishedUnitsForFuel(canonicalFuelName(v.fuel || 'Diesel (average biofuel blend)')),
        visibleWhen: { field: 'method', equals: 'Fuel litres (Method 1 — preferred when known)' },
      },
      {
        key: 'van_class',
        label: 'Van class (gross vehicle weight)',
        type: 'select',
        options: [...VAN_CLASSES],
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: ['Van', 'Van / pickup'] },
        ],
        hint: 'Class I up to 1.305 t, Class II 1.305–1.74 t, Class III 1.74–3.5 t.',
      },
      {
        key: 'van_fuel',
        label: 'Van fuel',
        type: 'select',
        optionsFrom: (v) => vanFuelsFor(v.van_class || 'Average (up to 3.5 tonnes)', 'km'),
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: ['Van', 'Van / pickup'] },
        ],
      },
      {
        key: 'hgv_class',
        label: 'HGV class',
        type: 'select',
        options: [...HGV_SIZE_OPTIONS],
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: 'HGV' },
        ],
      },
      {
        key: 'hgv_body',
        label: 'Refrigerated?',
        type: 'select',
        options: ['Non-refrigerated (all diesel)', 'Refrigerated (all diesel)'],
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: 'HGV' },
        ],
      },
      {
        key: 'laden',
        label: 'Laden percentage',
        type: 'select',
        options: [...LADEN_OPTIONS],
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: 'HGV' },
        ],
        hint: 'If you do not know how full the vehicle is, use Average laden.',
      },
      {
        key: 'car_size',
        label: 'Car size',
        type: 'select',
        options: [...CAR_SIZES],
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: ['Company car (by size)', 'Company car', 'Light vehicle'] },
        ],
      },
      {
        key: 'car_segment',
        label: 'Market segment (SMMT)',
        type: 'select',
        options: [...CAR_SEGMENTS],
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: 'Company car (by market segment)' },
        ],
      },
      {
        key: 'car_fuel',
        label: 'Car fuel',
        type: 'select',
        optionsFrom: (v) =>
          v.vehicle === 'Company car (by market segment)'
            ? carFuelsFor('car_segment', v.car_segment || 'Lower medium')
            : carFuelsFor('car_size', v.car_size || 'Average car'),
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          {
            field: 'vehicle',
            equals: ['Company car (by size)', 'Company car (by market segment)', 'Company car', 'Light vehicle'],
          },
        ],
      },
      {
        key: 'moto_size',
        label: 'Motorbike size',
        type: 'select',
        options: [...MOTORBIKE_SIZES],
        visibleWhen: [
          { field: 'method', equals: 'Distance (Method 2 — vehicle km)' },
          { field: 'vehicle', equals: 'Motorbike' },
        ],
      },
      {
        key: 'amount',
        label: 'Activity amount',
        type: 'number',
      },
    ],
    amountField: 'amount',
    amountLabel: 'L',
    unitOptions: FUEL_VOLUME_UNITS,
    chainExtras: ['wtt', 'ev', 'ev_td'],
    resolveScope: (v) => ((v.ownership || '').includes('Hired') ? 'Scope 3' : 'Scope 1'),
    resolveFactorKey: (v) => {
      const distance = (v.method || '').startsWith('Distance')
      if (!distance) return energyFactorKey(v.fuel || 'Diesel / gas oil', v.fuel_basis)
      if (v.vehicle === 'Van' || v.vehicle === 'Van / pickup') {
        return vanFactorKey(v.van_class || 'Average (up to 3.5 tonnes)', v.van_fuel || 'Diesel', 'km')
      }
      if (v.vehicle === 'HGV') {
        return hgvFactorKey({
          size: v.hgv_class || 'Average HGV',
          refrigerated: v.hgv_body === 'Refrigerated (all diesel)',
          laden: v.laden || 'Average laden',
          unit: 'km',
        })
      }
      if (v.vehicle === 'Company car (by market segment)') {
        return carFactorKey('car_segment', v.car_segment || 'Lower medium', v.car_fuel || 'Unknown')
      }
      if (v.vehicle === 'Motorbike') {
        return motoFactorKey(v.moto_size || 'Average')
      }
      return carFactorKey('car_size', v.car_size || 'Average car', v.car_fuel || 'Unknown')
    },
    resolveUnit: (v) =>
      (v.method || '').startsWith('Distance')
        ? v.unit || 'km'
        : energyFactorUnit(v.fuel || 'Diesel / gas oil', v.fuel_basis) || v.unit || 'L',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || ((v.method || '').startsWith('Distance') ? 'km' : 'L')} — ${v.vehicle || 'fleet'} ${v.hgv_class || v.van_class || v.car_size || v.fuel || ''}`.trim(),
  },
  {
    id: 'refrigerants',
    name: 'Refrigerants',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Record refrigerant top-ups for site welfare HVAC, processing-plant HVAC, cold stores, and refrigerated logistics assets.',
    fields: [
      {
        key: 'gas',
        label: 'Type of gas',
        type: 'select',
        optionGroups: [
          { label: 'Common (keep these labels for UK inventory)', options: [...COMMON_REFRIGERANTS] },
          {
            label: 'DESNZ Kyoto gases and blends',
            options: REFRIGERANT_OPTIONS.filter((name) => !COMMON_REFRIGERANTS.includes(name)),
          },
        ],
      },
      {
        key: 'gwp_set',
        label: 'GWP set',
        type: 'select',
        options: ['DESNZ 2026 (IPCC AR5, UK default)', 'EPA Hub 2026 (IPCC AR6)'],
        visibleWhen: { field: 'gas', equals: ['R-134A', 'R-410A', 'R-404A'] },
        hint: 'UK inventory stays on DESNZ AR5. EPA AR6 is only published here for R-134A / R-410A / R-404A and does not replace the DESNZ row.',
      },
      {
        key: 'amount',
        label: 'Amount',
        type: 'number',
      },
    ],
    amountField: 'amount',
    amountLabel: 'kg',
    unitOptions: MASS_KG_UNITS,
    resolveFactorKey: (v) => {
      const epa = (v.gwp_set || '').includes('EPA')
      if (epa && v.gas === 'R-410A') return 'r410a_epa_kg'
      if (epa && v.gas === 'R-404A') return 'r404a_epa_kg'
      if (epa && (v.gas === 'R-134A' || v.gas === 'HFC-134a')) return 'r134a_epa_kg'
      if (v.gas === 'R-410A') return 'r410a_kg'
      if (v.gas === 'R-404A') return 'r404a_kg'
      if (v.gas === 'CO2') return 'co2_kg'
      if (v.gas === 'R-134A') return 'r134a_kg'
      return refrigerantFactorKey(v.gas || 'R-134A')
    },
    resolveUnit: (v) => v.unit || 'kg',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'kg'} ${v.gas || 'refrigerant'}`,
  },
  {
    id: 'mine_gas',
    name: 'Mine methane & ventilation',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Log fugitive methane from underground or surface mines: ventilation air methane, drained coal-mine gas, or measured CH₄. Use tonnes or cubic metres of methane, not mixed mine air unless you have converted it to CH₄.',
    fields: [
      {
        key: 'source',
        label: 'Gas source',
        type: 'select',
        options: [
          'Coal mine methane (drained)',
          'Ventilation air methane',
          'Metalliferous mine gas',
          'Other mine methane',
        ],
      },
      {
        key: 'measure',
        label: 'How methane is measured',
        type: 'select',
        options: ['Tonnes of CH₄', 'Kilograms of CH₄', 'Cubic metres of CH₄'],
      },
      {
        key: 'gwp_set',
        label: 'GWP set',
        type: 'select',
        options: ['DESNZ-aligned IPCC AR5 (GWP 28)', 'EPA Hub 2026 fossil methane (GWP 29.8)'],
        hint: 'Use AR5 GWP 28 for a UK DESNZ-consistent inventory. EPA AR6 29.8 is for fossil / coal-mine methane only and is not mixed into DESNZ refrigerant rows. Cubic metres stay on AR5.',
      },
      {
        key: 'amount',
        label: 'Amount',
        type: 'number',
        hint: 'Quantity of methane (CH₄), not total ventilation air.',
      },
    ],
    amountField: 'amount',
    amountLabel: 't',
    resolveFactorKey: (v) => {
      const epa = (v.gwp_set || '').includes('EPA')
      if (v.measure === 'Kilograms of CH₄') return epa ? 'mine_ch4_epa_fossil_kg' : 'mine_ch4_kg'
      if (v.measure === 'Cubic metres of CH₄') return 'mine_ch4_m3'
      return epa ? 'mine_ch4_epa_fossil_t' : 'mine_ch4_t'
    },
    resolveUnit: (v) => {
      if (v.measure === 'Kilograms of CH₄') return 'kg'
      if (v.measure === 'Cubic metres of CH₄') return 'm³'
      return 't'
    },
    resolveDetails: (v, amount) => {
      const unit =
        v.measure === 'Kilograms of CH₄' ? 'kg' : v.measure === 'Cubic metres of CH₄' ? 'm³' : 't'
      return `${amount.toLocaleString()} ${unit} CH₄ — ${v.source || 'mine methane'}`
    },
  },
  {
    id: 'road_freight',
    name: 'Road Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions:
      'Log contracted road haulage. DESNZ Freighting goods publishes van class × fuel and HGV rigid/artic by GVW, refrigerated vs not, and 0/50/100%/average laden, as tonne-km (when mass is known) or vehicle-km (when it is not).',
    fields: [
      {
        key: 'family',
        label: 'Vehicle family',
        type: 'select',
        options: ['HGV', 'Van'],
      },
      {
        key: 'hgv_class',
        label: 'HGV class',
        type: 'select',
        options: [...HGV_SIZE_OPTIONS],
        visibleWhen: { field: 'family', equals: 'HGV' },
      },
      {
        key: 'hgv_body',
        label: 'Refrigerated?',
        type: 'select',
        options: ['Non-refrigerated (all diesel)', 'Refrigerated (all diesel)'],
        visibleWhen: { field: 'family', equals: 'HGV' },
      },
      {
        key: 'laden',
        label: 'Laden percentage',
        type: 'select',
        options: [...LADEN_OPTIONS],
        visibleWhen: { field: 'family', equals: 'HGV' },
      },
      {
        key: 'van_class',
        label: 'Van class',
        type: 'select',
        options: [...VAN_CLASSES],
        visibleWhen: { field: 'family', equals: 'Van' },
      },
      {
        key: 'van_fuel',
        label: 'Van fuel',
        type: 'select',
        optionsFrom: (v) =>
          vanFuelsFor(
            v.van_class || 'Average (up to 3.5 tonnes)',
            isVehicleKmMetric(v.metric) ? 'km' : 'tkm',
          ),
        visibleWhen: { field: 'family', equals: 'Van' },
      },
      {
        key: 'metric',
        label: 'Activity metric',
        type: 'select',
        options: ['Tonne-kilometres (mass known)', 'Vehicle kilometres (mass unknown)'],
        hint: 'Tonne-km is preferred when cargo mass is known. Vehicle-km uses the DESNZ km column.',
      },
      {
        key: 'weight',
        label: 'Cargo weight',
        type: 'number',
        unitOptions: MASS_TONNE_UNITS,
        optional: true,
        visibleWhen: { field: 'metric', equals: ['Tonne-kilometres (mass known)', ''] },
      },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    chainExtras: ['wtt'],
    resolveFactorKey: (v) => roadFreightFactorKey(v),
    resolveUnit: (v) => ((v.metric || '').includes('Vehicle') ? v.distance_unit || 'km' : 'tkm'),
    resolveActivityAmount: (v) => {
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      if ((v.metric || '').includes('Vehicle')) return dist
      const wt = num(v, 'weight') * (num(v, 'weight_unit_factor') || 1)
      return wt * dist
    },
    resolveDetails: (v) => {
      const du = v.distance_unit || 'km'
      if ((v.metric || '').includes('Vehicle')) {
        return `${num(v, 'distance').toLocaleString()} ${du} vehicle-km — ${v.hgv_class || v.van_class || v.mode || 'road'}`
      }
      const wu = v.weight_unit || 't'
      return `${num(v, 'weight').toLocaleString()} ${wu} × ${num(v, 'distance').toLocaleString()} ${du} by ${v.hgv_class || v.mode || v.family || 'road'}`
    },
  },
  {
    id: 'rail_freight',
    name: 'Rail Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Record inbound or outbound rail movements of bulk materials, ore, concentrate, and aggregates.',
    fields: [
      { key: 'weight', label: 'Cargo weight', type: 'number', unitOptions: MASS_TONNE_UNITS },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_rail_tkm',
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => {
      const wt = num(v, 'weight') * (num(v, 'weight_unit_factor') || 1)
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      return wt * dist
    },
    resolveDetails: (v) => {
      const wu = v.weight_unit || 't'
      const du = v.distance_unit || 'km'
      return `${num(v, 'weight').toLocaleString()} ${wu} × ${num(v, 'distance').toLocaleString()} ${du} by rail`
    },
  },
  {
    id: 'sea_freight',
    name: 'Sea Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Log ocean or coastal shipping of steel, plant, reagents, concentrate, and other imported materials.',
    fields: [
      {
        key: 'mode',
        label: 'Vessel type',
        type: 'select',
        options: SEA_VESSEL_OPTIONS,
      },
      {
        key: 'size',
        label: 'Vessel size',
        type: 'select',
        optionsFrom: (v) => seaSizesFor(v.mode || 'Container ship'),
        hint: 'Use Average when the size band is unknown.',
      },
      { key: 'weight', label: 'Cargo weight', type: 'number', unitOptions: MASS_TONNE_UNITS },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: (v) => {
      if (v.mode === 'Container' || (!v.size && v.mode === 'Container ship')) return v.size ? seaFactorKey('Container ship', v.size) : 'freight_sea_tkm'
      if (v.mode === 'Bulk carrier' && !v.size) return 'freight_sea_bulk_tkm'
      if ((v.mode === 'RoRo' || v.mode === 'RoRo-Ferry') && !v.size) return 'freight_sea_roro_tkm'
      return seaFactorKey(v.mode || 'Container ship', v.size || 'Average')
    },
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => {
      const wt = num(v, 'weight') * (num(v, 'weight_unit_factor') || 1)
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      return wt * dist
    },
    resolveDetails: (v) => {
      const wu = v.weight_unit || 't'
      const du = v.distance_unit || 'km'
      return `${num(v, 'weight').toLocaleString()} ${wu} × ${num(v, 'distance').toLocaleString()} ${du} by sea (${v.mode || 'vessel'})`
    },
  },
  {
    id: 'air_freight',
    name: 'Air Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Use for time-critical plant parts, reagents, and high-value materials moved by air.',
    fields: [
      {
        key: 'haul',
        label: 'Haul',
        type: 'select',
        options: [...AIR_HAULS],
        hint: 'DESNZ default air freight row is short-haul with radiative forcing.',
      },
      { key: 'weight', label: 'Cargo weight', type: 'number', unitOptions: MASS_TONNE_UNITS },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
      {
        key: 'rf',
        label: 'Radiative forcing',
        type: 'select',
        options: [...RF_OPTIONS],
      },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: (v) => airFreightFactorKey(v.haul || 'Short-haul', v.rf || 'With RF (DESNZ default)'),
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => {
      const wt = num(v, 'weight') * (num(v, 'weight_unit_factor') || 1)
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      return wt * dist
    },
    resolveDetails: (v) => {
      const wu = v.weight_unit || 't'
      const du = v.distance_unit || 'km'
      return `${num(v, 'weight').toLocaleString()} ${wu} × ${num(v, 'distance').toLocaleString()} ${du} by air`
    },
  },
  {
    id: 'waste',
    name: 'Site Waste',
    scope: 'Scope 3',
    group: 'input',
    instructions:
      'Enter construction and demolition waste, waste rock, tailings, and other site arisings by disposal route (landfill, recycling, or combustion / energy recovery). DESNZ construction landfill is 1.27043 kg CO₂e per tonne; recycling is 1.01398; average-construction combustion is 4.65358.',
    fields: [
      {
        key: 'waste_type',
        label: 'Waste type',
        type: 'select',
        optionGroups: [
          { label: 'Site arisings (generic construction factors)', options: [...GENERIC_WASTE_TYPES] },
          {
            label: 'Construction (DESNZ waste types)',
            options: CONSTRUCTION_WASTE_TYPES.filter((name) => WASTE_TYPES.includes(name)),
          },
          {
            label: 'Other streams',
            options: WASTE_TYPES.filter((name) => !CONSTRUCTION_WASTE_TYPES.includes(name)),
          },
        ],
      },
      {
        key: 'route',
        label: 'Disposal route',
        type: 'select',
        optionsFrom: (v) => {
          const extra = ['Landfill', 'Recycling', 'Energy recovery']
          const published = wasteRoutesFor(v.waste_type || '')
          return published.length ? published : extra
        },
        hint: 'Only routes DESNZ publishes for this waste type are listed. Recycling maps to closed-loop when that row exists.',
      },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 't',
    unitOptions: MASS_TONNE_UNITS,
    resolveFactorKey: (v) => wasteFactorKey(v.waste_type || 'Construction & demolition', v.route || 'Landfill'),
    resolveUnit: (v) => v.unit || 't',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 't'} ${v.waste_type || 'site waste'} — ${v.route || 'disposal'}`,
  },
  {
    id: 'water',
    name: 'Water',
    scope: 'Scope 3',
    group: 'input',
    instructions:
      'Site potable and process water supplied to construction compounds, mines, processing plants, and wash-out areas. Carbon uses the DESNZ water-supply factor; add wastewater treatment as a separate Scope 3 line for the full DESNZ water picture. Water-positive % is volume (reused + replenished + sustainable sources) ÷ withdrawal — it is not a carbon factor.',
    fields: [
      {
        key: 'type',
        label: 'Water type',
        type: 'select',
        options: ['Potable + process water', 'Potable only', 'Process only'],
      },
      { key: 'amount', label: 'Withdrawal / usage amount', type: 'number' },
      {
        key: 'reused',
        label: 'Reused / recycled volume (optional)',
        type: 'number',
        optional: true,
        hint: 'Volume sent to reuse without extra treatment. Used only for a water-positive %, not for tCO₂e.',
      },
      {
        key: 'replenished',
        label: 'Replenished volume (optional)',
        type: 'number',
        optional: true,
        hint: 'Watershed replenishment credited in the same units as withdrawal.',
      },
      {
        key: 'sustainable',
        label: 'Sustainable sources (optional)',
        type: 'number',
        optional: true,
        hint: 'Rainwater harvesting or recycled supply counted as a sustainable withdrawal.',
      },
    ],
    amountField: 'amount',
    amountLabel: 'm³',
    unitOptions: WATER_VOLUME_UNITS,
    chainExtras: ['treatment'],
    resolveFactorKey: () => 'water_m3',
    resolveUnit: (v) => v.unit || 'm³',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'm³'} ${v.type || 'water'}`,
  },
  {
    id: 'crew_transport',
    name: 'Crew Transport',
    scope: 'Scope 3',
    group: 'input',
    instructions:
      'Workforce travel to remote job sites, mines, and camps by shuttle, van, or public transport. Enter one-way distance; return trips are included.',
    fields: [
      {
        key: 'mode',
        label: 'Transport type',
        type: 'select',
        optionGroups: [
          { label: 'Quick', options: ['Crew van', 'Shuttle bus', 'Rail', 'Car'] },
          { label: 'Van class', options: VAN_CLASSES.map((row) => `Van — ${row}`) },
          { label: 'Bus', options: [...BUS_TYPES] },
          { label: 'Rail', options: [...RAIL_TYPES] },
          { label: 'Car by size', options: CAR_SIZES.map((row) => `Car — ${row}`) },
          { label: 'Motorbike', options: MOTORBIKE_SIZES.map((row) => `Motorbike — ${row}`) },
        ],
      },
      {
        key: 'van_class',
        label: 'Van class',
        type: 'select',
        options: [...VAN_CLASSES],
        visibleWhen: { field: 'mode', equals: 'Crew van' },
      },
      {
        key: 'van_fuel',
        label: 'Van fuel',
        type: 'select',
        optionsFrom: (v) =>
          vanFuelsFor(
            v.van_class || (v.mode || '').replace('Van — ', '') || 'Average (up to 3.5 tonnes)',
            'km',
          ),
        visibleWhen: {
          field: 'mode',
          equals: ['Crew van', ...VAN_CLASSES.map((row) => `Van — ${row}`)],
        },
      },
      {
        key: 'car_fuel',
        label: 'Car fuel',
        type: 'select',
        optionsFrom: (v) => carFuelsFor('car_size', (v.mode || '').replace('Car — ', '') || 'Average car'),
        visibleWhen: { field: 'mode', equals: CAR_SIZES.map((row) => `Car — ${row}`) },
      },
      { key: 'distance', label: 'One-way distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
      { key: 'trips', label: 'Return trips', type: 'number' },
      { key: 'passengers', label: 'Passengers per trip', type: 'number', hint: 'Used for bus and rail (passenger-km). Vans use vehicle-km.' },
    ],
    amountField: 'distance',
    amountLabel: 'km',
    resolveFactorKey: (v) => {
      if (v.mode === 'Shuttle bus') return 'crew_bus_pkm'
      if (v.mode === 'Rail' || v.mode === 'National rail') return 'crew_rail_pkm'
      if (v.mode?.startsWith('Car — ')) {
        return carFactorKey('car_size', v.mode.replace('Car — ', ''), v.car_fuel || 'Unknown')
      }
      if (v.mode?.startsWith('Motorbike — ')) return motoFactorKey(v.mode.replace('Motorbike — ', ''))
      if (v.mode?.startsWith('Van — ')) {
        return vanFactorKey(v.mode.replace('Van — ', ''), v.van_fuel || 'Diesel', 'km')
      }
      if (v.mode === 'Crew van' && (v.van_class || v.van_fuel)) {
        return vanFactorKey(v.van_class || 'Average (up to 3.5 tonnes)', v.van_fuel || 'Diesel', 'km')
      }
      if ((BUS_TYPES as readonly string[]).includes(v.mode)) return landTravelFactorKey('Bus', v.mode)
      if ((RAIL_TYPES as readonly string[]).includes(v.mode)) return landTravelFactorKey('Rail', v.mode)
      if (v.mode === 'Car') return 'commute_car_km'
      return 'crew_van_km'
    },
    resolveUnit: (v) => v.distance_unit || 'km',
    resolveActivityAmount: (v) => {
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      const trips = num(v, 'trips')
      const passengers = num(v, 'passengers') || 1
      if (v.mode === 'Shuttle bus' || v.mode === 'Rail' || (BUS_TYPES as readonly string[]).includes(v.mode) || (RAIL_TYPES as readonly string[]).includes(v.mode)) {
        return dist * trips * 2 * passengers
      }
      return dist * trips * 2
    },
    resolveDetails: (v) => {
      const du = v.distance_unit || 'km'
      return `${num(v, 'distance').toLocaleString()} ${du} ${v.mode || 'crew transport'}, ${num(v, 'trips')} return trips`
    },
  },
  {
    id: 'bulk_materials',
    name: 'Bulk Materials',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Embodied carbon of concrete, steel, timber, asphalt, aggregates, lime, and other bulk materials (EN 15978 A1–A3 cradle-to-gate). Mining reagents such as lime sit here; ore haulage belongs under freight. Steel, rebar, cement, aluminium, copper, lime, and grinding media need a supplier EPD — there is no published DESNZ factor for those keys.',
    fields: [
      {
        key: 'material',
        label: 'Material',
        type: 'select',
        options: [
          'Concrete', 'Steel', 'Timber', 'Asphalt', 'Aggregates', 'Cement', 'Rebar',
          'Lime', 'Grinding media (steel)',
          'Glass', 'Aluminium', 'Bricks', 'Insulation', 'Plasterboard', 'Copper', 'PVC', 'Soil / earthworks',
          ...MATERIAL_NAMES,
        ],
      },
      {
        key: 'origin',
        label: 'Material origin',
        type: 'select',
        optionsFrom: (v) => materialOriginsFor(v.material || 'Concrete'),
        optional: true,
        hint: 'Primary material production is the DESNZ default. Closed-loop is recycled content from the same product system. Leave blank for EPD-required metals and cement.',
      },
      { key: 'amount', label: 'Quantity', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 't',
    unitOptions: MASS_TONNE_UNITS,
    resolveFactorKey: (v) => {
      const map: Record<string, string> = {
        Concrete: 'material_concrete_t',
        Steel: 'material_steel_t',
        Timber: 'material_timber_t',
        Asphalt: 'material_asphalt_t',
        Aggregates: 'material_aggregates_t',
        Cement: 'material_cement_t',
        Rebar: 'material_rebar_t',
        Lime: 'material_lime_t',
        'Grinding media (steel)': 'material_steel_t',
        Glass: 'material_glass_t',
        Aluminium: 'material_aluminium_t',
        Bricks: 'material_bricks_t',
        Insulation: 'material_insulation_t',
        Plasterboard: 'material_plasterboard_t',
        Copper: 'material_copper_t',
        PVC: 'material_pvc_t',
        'Soil / earthworks': 'material_soil_t',
        Wood: 'material_timber_t',
      }
      if (map[v.material] && (!v.origin || v.origin === 'Primary material production')) {
        return map[v.material]
      }
      return materialFactorKey(v.material || 'Concrete', v.origin)
    },
    resolveUnit: (v) => v.unit || 't',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 't'} ${v.material || 'material'} (A1–A3)`,
  },
  {
    id: 'heat_steam',
    name: 'Heat and steam',
    scope: 'Scope 2',
    group: 'scope3',
    instructions: 'Purchased heat or steam supplied to site compounds, curing, processing plants, or workshops. UK sites use DESNZ district heat; US purchased steam can use the EPA Hub 2026 natural-gas steam row.',
    fields: [
      {
        key: 'type',
        label: 'Supply type',
        type: 'select',
        options: ['Onsite heat and steam', 'District heat and steam', 'US purchased steam (EPA Hub)'],
      },
      { key: 'amount', label: 'Usage', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'kWh',
    unitOptions: ELECTRICITY_UNITS,
    chainExtras: ['td'],
    resolveFactorKey: (v) =>
      v.type?.includes('EPA') ? 'heat_steam_us_kwh' : 'heat_steam_kwh',
    resolveUnit: (v) => v.unit || 'kWh',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'kWh'} ${v.type || 'heat'}`,
  },
  {
    id: 'subcontractor',
    name: 'Subcontractor Logistics',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Third-party haulage and plant moves (GHG Protocol Category 4). Use the same DESNZ Freighting goods classes as Road freight: HGV by GVW, laden %, refrigerated, or van class.',
    fields: [
      {
        key: 'family',
        label: 'Vehicle family',
        type: 'select',
        options: ['HGV', 'Van'],
      },
      {
        key: 'hgv_class',
        label: 'HGV class',
        type: 'select',
        options: [...HGV_SIZE_OPTIONS],
        visibleWhen: { field: 'family', equals: 'HGV' },
      },
      {
        key: 'hgv_body',
        label: 'Refrigerated?',
        type: 'select',
        options: ['Non-refrigerated (all diesel)', 'Refrigerated (all diesel)'],
        visibleWhen: { field: 'family', equals: 'HGV' },
      },
      {
        key: 'laden',
        label: 'Laden percentage',
        type: 'select',
        options: [...LADEN_OPTIONS],
        visibleWhen: { field: 'family', equals: 'HGV' },
      },
      {
        key: 'van_class',
        label: 'Van class',
        type: 'select',
        options: [...VAN_CLASSES],
        visibleWhen: { field: 'family', equals: 'Van' },
      },
      {
        key: 'van_fuel',
        label: 'Van fuel',
        type: 'select',
        optionsFrom: (v) =>
          vanFuelsFor(
            v.van_class || 'Average (up to 3.5 tonnes)',
            isVehicleKmMetric(v.metric) ? 'km' : 'tkm',
          ),
        visibleWhen: { field: 'family', equals: 'Van' },
      },
      {
        key: 'metric',
        label: 'Activity metric',
        type: 'select',
        options: ['Tonne-kilometres (mass known)', 'Vehicle kilometres (mass unknown)'],
      },
      {
        key: 'weight',
        label: 'Cargo weight',
        type: 'number',
        unitOptions: MASS_TONNE_UNITS,
        optional: true,
        visibleWhen: { field: 'metric', equals: ['Tonne-kilometres (mass known)', ''] },
      },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    chainExtras: ['wtt'],
    resolveFactorKey: (v) => roadFreightFactorKey(v),
    resolveUnit: (v) => ((v.metric || '').includes('Vehicle') ? v.distance_unit || 'km' : 'tkm'),
    resolveActivityAmount: (v) => {
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      if ((v.metric || '').includes('Vehicle')) return dist
      const wt = num(v, 'weight') * (num(v, 'weight_unit_factor') || 1)
      return wt * dist
    },
    resolveDetails: (v) => {
      const du = v.distance_unit || 'km'
      if ((v.metric || '').includes('Vehicle')) {
        return `${num(v, 'distance').toLocaleString()} ${du} vehicle-km — ${v.hgv_class || v.van_class || 'subcontractor'}`
      }
      const wu = v.weight_unit || 't'
      return `${num(v, 'weight').toLocaleString()} ${wu} × ${num(v, 'distance').toLocaleString()} ${du} subcontracted haulage`
    },
  },
  {
    id: 'business_travel',
    name: 'Business Travel',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Staff flights, hotel stays, and taxi journeys (GHG Protocol Scope 3, Category 6). Flights and taxis are passenger-km: passengers × distance. Hotels are room-nights using the DESNZ country row — there is no invented “overseas average”.',
    fields: [
      {
        key: 'type',
        label: 'Travel type',
        type: 'select',
        optionGroups: [
          {
            label: 'Flights (keep Short-haul flight = economy with RF)',
            options: [
              'Domestic flight',
              'Short-haul flight',
              'Short-haul flight (average)',
              'Short-haul flight (business)',
              'Long-haul flight (average)',
              'Long-haul flight (economy)',
              'Long-haul flight (premium economy)',
              'Long-haul flight (business)',
              'Long-haul flight (first)',
              'International flight (average)',
              'International flight (economy)',
              'International flight (premium economy)',
              'International flight (business)',
              'International flight (first)',
            ],
          },
          { label: 'Hotels', options: ['Hotel'] },
          {
            label: 'Taxis',
            options: [
              'Taxi',
              'Regular taxi',
              'Black cab',
              'Taxi (vehicle-km)',
              'Black cab (vehicle-km)',
            ],
          },
          { label: 'Bus', options: [...BUS_TYPES] },
          { label: 'Rail', options: [...RAIL_TYPES] },
          { label: 'Ferry', options: FERRY_TYPES.map((row) => `Ferry — ${row}`) },
          { label: 'Cars (by size)', options: CAR_SIZES.map((row) => `Car — ${row}`) },
          { label: 'Cars (by market segment)', options: CAR_SEGMENTS.map((row) => `Car segment — ${row}`) },
          { label: 'Motorbike', options: MOTORBIKE_SIZES.map((row) => `Motorbike — ${row}`) },
        ],
      },
      {
        key: 'rf',
        label: 'Radiative forcing (flights)',
        type: 'select',
        options: [...RF_OPTIONS],
        optional: true,
        hint: 'DESNZ default is With RF. Ignored for non-flight rows.',
      },
      {
        key: 'car_fuel',
        label: 'Car fuel',
        type: 'select',
        optionsFrom: (v) => {
          if ((v.type || '').startsWith('Car segment — ')) {
            return carFuelsFor('car_segment', v.type.replace('Car segment — ', ''))
          }
          return carFuelsFor('car_size', (v.type || '').replace('Car — ', '') || 'Average car')
        },
        visibleWhen: {
          field: 'type',
          equals: [
            ...CAR_SIZES.map((row) => `Car — ${row}`),
            ...CAR_SEGMENTS.map((row) => `Car segment — ${row}`),
          ],
        },
      },
      {
        key: 'hotel_country',
        label: 'Hotel country',
        type: 'select',
        options: HOTEL_COUNTRY_OPTIONS,
        visibleWhen: { field: 'type', equals: 'Hotel' },
        hint: 'Used when travel type is Hotel. Only countries with a published 2026 factor are listed.',
      },
      { key: 'passengers', label: 'Passengers', type: 'number', hint: 'Flights and taxis. Leave blank for hotels.' },
      { key: 'amount', label: 'Distance or nights', type: 'number', hint: 'Kilometres for flights and taxis (passenger-km = passengers × km). Room-nights for hotels.' },
    ],
    amountField: 'amount',
    amountLabel: 'pkm / nights',
    resolveFactorKey: (v) => {
      if (v.type === 'Hotel') return hotelFactorKey(v.hotel_country || 'UK')
      const rf = v.rf || 'With RF (DESNZ default)'
      const map: Record<string, string> = {
        'Domestic flight': flightFactorKey('Domestic', 'Average passenger', rf),
        'Short-haul flight': rf === 'Without RF' ? flightFactorKey('Short-haul', 'Economy class', rf) : 'flight_shorthaul_pkm',
        'Short-haul flight (average)': flightFactorKey('Short-haul', 'Average passenger', rf),
        'Short-haul flight (business)': flightFactorKey('Short-haul', 'Business class', rf),
        'Long-haul flight (average)': flightFactorKey('Long-haul', 'Average passenger', rf),
        'Long-haul flight (economy)':
          rf === 'Without RF' ? flightFactorKey('Long-haul', 'Economy class', rf) : 'flight_longhaul_economy_pkm',
        'Long-haul flight (premium economy)': flightFactorKey('Long-haul', 'Premium economy class', rf),
        'Long-haul flight (business)':
          rf === 'Without RF' ? flightFactorKey('Long-haul', 'Business class', rf) : 'flight_longhaul_business_pkm',
        'Long-haul flight (first)': flightFactorKey('Long-haul', 'First class', rf),
        'International flight (average)': flightFactorKey('International', 'Average passenger', rf),
        'International flight (economy)': flightFactorKey('International', 'Economy class', rf),
        'International flight (premium economy)': flightFactorKey('International', 'Premium economy class', rf),
        'International flight (business)': flightFactorKey('International', 'Business class', rf),
        'International flight (first)': flightFactorKey('International', 'First class', rf),
        Taxi: 'taxi_pkm',
        'Regular taxi': 'taxi_pkm',
        'Black cab': landTravelFactorKey('Taxis', 'Black cab', 'pkm'),
        'Taxi (vehicle-km)': 'taxi_km',
        'Black cab (vehicle-km)': landTravelFactorKey('Taxis', 'Black cab', 'km'),
        'Local bus (not London)': landTravelFactorKey('Bus', 'Local bus (not London)'),
        'Local London bus': landTravelFactorKey('Bus', 'Local London bus'),
        'Average local bus': 'commute_bus_pkm',
        Coach: landTravelFactorKey('Bus', 'Coach'),
        'National rail': 'commute_rail_pkm',
        'International rail': landTravelFactorKey('Rail', 'International rail'),
        'Light rail and tram': landTravelFactorKey('Rail', 'Light rail and tram'),
        'London Underground': landTravelFactorKey('Rail', 'London Underground'),
      }
      if (v.type?.startsWith('Ferry — ')) return ferryFactorKey(v.type.replace('Ferry — ', ''))
      if (v.type?.startsWith('Car — ')) {
        return carFactorKey('car_size', v.type.replace('Car — ', ''), v.car_fuel || 'Unknown')
      }
      if (v.type?.startsWith('Car segment — ')) {
        return carFactorKey('car_segment', v.type.replace('Car segment — ', ''), v.car_fuel || 'Unknown')
      }
      if (v.type?.startsWith('Motorbike — ')) return motoFactorKey(v.type.replace('Motorbike — ', ''))
      return map[v.type] || 'flight_shorthaul_pkm'
    },
    resolveUnit: (v) => {
      if (v.type === 'Hotel') return 'nights'
      if (
        v.type?.startsWith('Car — ') ||
        v.type?.startsWith('Car segment — ') ||
        v.type?.startsWith('Motorbike — ') ||
        (v.type || '').includes('vehicle-km')
      ) {
        return 'km'
      }
      return 'pkm'
    },
    resolveActivityAmount: (v, amount) => {
      if (v.type === 'Hotel') return amount
      if (
        v.type?.startsWith('Car — ') ||
        v.type?.startsWith('Car segment — ') ||
        v.type?.startsWith('Motorbike — ') ||
        (v.type || '').includes('vehicle-km')
      ) {
        return amount
      }
      const passengers = num(v, 'passengers') || 1
      return passengers * amount
    },
    resolveDetails: (v, amount) => {
      if (v.type === 'Hotel') return `${amount.toLocaleString()} room-nights — ${v.hotel_country || 'UK'}`
      const passengers = num(v, 'passengers') || 1
      return `${passengers} passengers × ${num(v, 'amount').toLocaleString()} km = ${amount.toLocaleString()} pkm — ${v.type}`
    },
  },
  {
    id: 'employee_commuting',
    name: 'Employee Commuting',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Emissions from employees travelling between home and work, including DESNZ homeworking hours (GHG Protocol Scope 3, Category 7). Enter one-way distance; return is included. Homeworking uses published kg CO₂e per FTE hour, not a commute distance.',
    fields: [
      {
        key: 'mode',
        label: 'Commute mode',
        type: 'select',
        optionGroups: [
          {
            label: 'Quick',
            options: ['Car', 'Car (diesel)', 'Car (petrol)', 'Bus', 'Rail', 'Motorbike'],
          },
          { label: 'Homeworking (DESNZ hours)', options: [...HOMEWORKING_OPTIONS] },
          { label: 'Van class', options: VAN_CLASSES.map((row) => `Van — ${row}`) },
          { label: 'Car by size', options: CAR_SIZES.map((row) => `Car — ${row}`) },
          { label: 'Car by market segment', options: CAR_SEGMENTS.map((row) => `Car segment — ${row}`) },
          { label: 'Bus', options: [...BUS_TYPES] },
          { label: 'Rail', options: [...RAIL_TYPES] },
          { label: 'Motorbike size', options: MOTORBIKE_SIZES.map((row) => `Motorbike — ${row}`) },
        ],
      },
      {
        key: 'car_fuel',
        label: 'Car fuel',
        type: 'select',
        optionsFrom: (v) => {
          if ((v.mode || '').startsWith('Car segment — ')) {
            return carFuelsFor('car_segment', v.mode.replace('Car segment — ', ''))
          }
          if ((v.mode || '').startsWith('Car — ')) {
            return carFuelsFor('car_size', v.mode.replace('Car — ', ''))
          }
          return carFuelsFor('car_size', 'Average car')
        },
        visibleWhen: {
          field: 'mode',
          equals: [
            ...CAR_SIZES.map((row) => `Car — ${row}`),
            ...CAR_SEGMENTS.map((row) => `Car segment — ${row}`),
          ],
        },
      },
      {
        key: 'van_fuel',
        label: 'Van fuel',
        type: 'select',
        optionsFrom: (v) =>
          vanFuelsFor((v.mode || '').replace('Van — ', '') || 'Average (up to 3.5 tonnes)', 'km'),
        visibleWhen: { field: 'mode', equals: VAN_CLASSES.map((row) => `Van — ${row}`) },
      },
      {
        key: 'distance',
        label: 'One-way distance',
        type: 'number',
        unitOptions: DISTANCE_KM_UNITS,
      },
      {
        key: 'hours',
        label: 'Homeworking hours per person per day',
        type: 'number',
        hint: 'DESNZ homeworking is kg CO₂e per FTE hour. Total hours = employees × days × hours per day.',
        visibleWhen: { field: 'mode', equals: [...HOMEWORKING_OPTIONS] },
      },
      { key: 'employees', label: 'Number of employees', type: 'number' },
      { key: 'days', label: 'Working days', type: 'number', hint: 'Days in the reporting period (e.g. 230 for a year). Homeworking days if that mode is selected.' },
    ],
    amountField: 'distance',
    amountLabel: 'km',
    resolveFactorKey: (v) => {
      if (isHomeworkingMode(v.mode)) return homeworkingFactorKey(v.mode)
      if (v.mode === 'Car (diesel)') return 'car_diesel_km'
      if (v.mode === 'Car (petrol)') return 'car_petrol_km'
      if (v.mode?.startsWith('Car — ')) {
        return carFactorKey('car_size', v.mode.replace('Car — ', ''), v.car_fuel || 'Unknown')
      }
      if (v.mode?.startsWith('Car segment — ')) {
        return carFactorKey('car_segment', v.mode.replace('Car segment — ', ''), v.car_fuel || 'Unknown')
      }
      if (v.mode?.startsWith('Van — ')) {
        return vanFactorKey(v.mode.replace('Van — ', ''), v.van_fuel || 'Diesel', 'km')
      }
      if (v.mode?.startsWith('Motorbike — ')) return motoFactorKey(v.mode.replace('Motorbike — ', ''))
      if (BUS_TYPES.includes(v.mode as (typeof BUS_TYPES)[number])) {
        return v.mode === 'Average local bus' ? 'commute_bus_pkm' : landTravelFactorKey('Bus', v.mode)
      }
      if (RAIL_TYPES.includes(v.mode as (typeof RAIL_TYPES)[number])) {
        return v.mode === 'National rail' ? 'commute_rail_pkm' : landTravelFactorKey('Rail', v.mode)
      }
      const map: Record<string, string> = {
        Car: 'commute_car_km',
        Bus: 'commute_bus_pkm',
        Rail: 'commute_rail_pkm',
        Motorbike: 'commute_motorbike_km',
      }
      return map[v.mode] || 'commute_car_km'
    },
    resolveUnit: (v) => (isHomeworkingMode(v.mode) ? 'hour' : v.distance_unit || 'km'),
    resolveActivityAmount: (v) => {
      if (isHomeworkingMode(v.mode)) {
        return num(v, 'employees') * num(v, 'days') * num(v, 'hours')
      }
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      return dist * num(v, 'employees') * num(v, 'days') * 2
    },
    resolveDetails: (v) => {
      if (isHomeworkingMode(v.mode)) {
        return `${num(v, 'employees')} employees × ${num(v, 'days')} days × ${num(v, 'hours')} h — ${v.mode}`
      }
      const du = v.distance_unit || 'km'
      return `${num(v, 'employees')} employees × ${num(v, 'distance')} ${du} × ${num(v, 'days')} days × 2 (return) by ${v.mode || 'car'}`
    },
  },
  {
    id: 'wastewater',
    name: 'Wastewater',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Wastewater and sewerage from site welfare, concrete washout, process water, and compound drainage (GHG Protocol Scope 3, Category 5).',
    fields: [
      { key: 'amount', label: 'Volume', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'm³',
    unitOptions: WATER_VOLUME_UNITS,
    resolveFactorKey: () => 'wastewater_m3',
    resolveUnit: (v) => v.unit || 'm³',
    resolveDetails: (v, amount) => `${amount.toLocaleString()} ${v.unit || 'm³'} wastewater treated`,
  },
  {
    id: 'energy_wtt',
    name: 'Fuel- and energy-related (WTT)',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Well-to-tank emissions from producing the fuel and electricity you already counted in Scope 1 and 2, plus UK grid transmission and distribution losses (GHG Protocol Scope 3, Category 3). Log the same litres, kWh, tonnes, or m³ DESNZ publishes for that fuel.',
    fields: [
      {
        key: 'source',
        label: 'Energy source',
        type: 'select',
        optionGroups: [
          { label: 'UK electricity', options: [...WTT_ELECTRICITY_OPTIONS] },
          { label: 'Common (keep existing labels)', options: [...WTT_LEGACY_OPTIONS] },
          { label: 'DESNZ fuels and bioenergy', options: [...SITE_FUEL_OPTIONS] },
        ],
      },
      {
        key: 'fuel_basis',
        label: 'Published unit',
        type: 'select',
        optionsFrom: (v) => {
          if (isElectricityWttSource(v.source) || (v.source || '').endsWith('(WTT)')) {
            if ((v.source || '').includes('Natural gas')) return ['kWh (Gross CV)', 'cubic metres']
            if ((v.source || '').includes('electricity')) return []
            return ['litres']
          }
          return publishedUnitsForFuel(canonicalFuelName(v.source || 'Diesel (average biofuel blend)'))
        },
        optional: true,
        hint: 'Only units DESNZ publishes for this fuel are listed.',
      },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'L / kWh',
    resolveFactorKey: (v) => wttEnergyKey(v.source || 'Diesel (WTT)', v.fuel_basis),
    resolveUnit: (v) => {
      if (isElectricityWttSource(v.source)) return v.unit || 'kWh'
      const label = (v.source || '')
        .replace(/^WTT — /, '')
        .replace(/ \(WTT\)$/, '')
      if (label === 'Natural gas' || v.source === 'Natural gas (WTT)') {
        return energyFactorUnit('Natural gas', v.fuel_basis) || v.unit || 'kWh'
      }
      return energyFactorUnit(label || 'Diesel / gas oil', v.fuel_basis) || v.unit || 'L'
    },
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || (isElectricityWttSource(v.source) ? 'kWh' : 'L')} ${v.source || 'WTT'}`,
  },
  {
    id: 'purchased_goods',
    name: 'Purchased Goods & Services',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Spend-based estimate for bought-in goods and services where activity data is unavailable (GHG Protocol Scope 3, Category 1). Prefer activity-based methods when possible. Defra SIC-19 is kg CO₂e per £. Open CEDA by Watershed is kg CO₂e per 2023 producer-price US dollar — GBP is converted at the CEDA 2025 FX rate and is never mixed with the Defra £ factor.',
    fields: [
      {
        key: 'spend_source',
        label: 'Spend factor family',
        type: 'select',
        options: [
          'Defra SIC-19 (kg CO₂e per £)',
          'Open CEDA by Watershed (kg CO₂e per $)',
        ],
        hint: 'Defra is the UK average £ multiplier. CEDA is a sector EEIO in USD, with attribution “CEDA by Watershed”.',
      },
      {
        key: 'type',
        label: 'Category',
        type: 'select',
        options: ['Purchased goods & services', 'Capital goods'],
      },
      {
        key: 'ceda_sector',
        label: 'CEDA sector (UK)',
        type: 'select',
        options: [...CEDA_SECTOR_OPTIONS],
        hint: 'Used when the factor family is Open CEDA. Construction, mining, and logistics sectors from GHG_t_Raw United Kingdom.',
      },
      {
        key: 'spend_currency',
        label: 'Spend currency',
        type: 'select',
        options: ['GBP', 'USD'],
        hint: 'CEDA factors are USD. GBP is converted using 0.765396 GBP per USD (CEDA 2025). Defra always uses £.',
      },
      { key: 'amount', label: 'Spend', type: 'number', hint: 'Pounds or dollars as selected — not thousands.' },
    ],
    amountField: 'amount',
    amountLabel: '£ / $',
    resolveFactorKey: (v) => {
      if ((v.spend_source || '').includes('CEDA')) {
        return cedaSectorByName(v.ceda_sector)?.key ?? 'ceda_gbr_2332c0_usd'
      }
      return v.type === 'Capital goods' ? 'capital_goods_gbp' : 'purchased_goods_gbp'
    },
    resolveUnit: (v) => {
      if ((v.spend_source || '').includes('CEDA')) return v.spend_currency === 'USD' ? '$' : '£'
      return '£'
    },
    resolveDetails: (v, amount) => {
      const currency = (v.spend_source || '').includes('CEDA') && v.spend_currency === 'USD' ? '$' : '£'
      const label = (v.spend_source || '').includes('CEDA')
        ? v.ceda_sector || 'CEDA sector'
        : v.type?.toLowerCase() || 'purchased goods'
      return `${currency}${amount.toLocaleString()} spend on ${label}`
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    scope: 'Custom',
    group: 'scope3',
    instructions:
      'Enter an activity amount and a conversion value from a verified source. The last step is always tCO₂e = activity × (kg CO₂e per unit) ÷ 1,000. Build the activity first (tkm, pkm, GWP mass, or converted units).',
    fields: [
      { key: 'label', label: 'Activity name', type: 'text', placeholder: 'e.g. imported cladding or process reagent' },
      { key: 'amount', label: 'Activity amount', type: 'number' },
      {
        key: 'conversion',
        label: 'Conversion value (kg CO₂e per unit)',
        type: 'number',
        hint: 'Must come from DEFRA, EPA, GLEC, EC3, or an EPD — do not guess.',
      },
      { key: 'unit', label: 'Unit', type: 'text', placeholder: 'e.g. kg, m², tkm' },
    ],
    amountField: 'amount',
    amountLabel: 'units',
    resolveFactorKey: () => 'custom',
    resolveUnit: (v) => v.unit || 'unit',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'units'} — ${v.label || 'custom activity'}`,
  },
]

export const INPUT_CATEGORIES = CATEGORIES.filter((c) => c.group === 'input')
export const SCOPE3_CATEGORIES = CATEGORIES.filter((c) => c.group === 'scope3')

export const SCOPE_NAV_ORDER = ['Scope 1', 'Scope 2', 'Scope 3', 'Custom'] as const

export function categoriesForScope(scope: (typeof SCOPE_NAV_ORDER)[number]) {
  return CATEGORIES.filter((category) => category.scope === scope)
}

export function getCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id)
}

export function unitOptionsFor(category: CategoryConfig, values: Record<string, string>): UnitOption[] | undefined {
  if (category.id === 'fleet' && (values.method || '').startsWith('Distance')) {
    return DISTANCE_KM_UNITS
  }
  if (category.id === 'site_fuel' || category.id === 'energy_wtt' || category.id === 'heavy_machinery' || category.id === 'fleet') {
    const key = category.resolveFactorKey(values)
    const published = energyFactorUnit(values.fuel || values.source || '', values.fuel_basis)
    if (published === 'kWh' || key.includes('kwh')) return ELECTRICITY_UNITS
    if (published === 'm³' || key.includes('m3') || key.includes('_m3')) return WATER_VOLUME_UNITS
    if (published === 't' || key.endsWith('_t') || key.includes('tonnes')) return MASS_TONNE_UNITS
    if (published === 'kg' || key.endsWith('_kg')) return MASS_KG_UNITS
    if (
      published === 'L' ||
      key.includes('litre') ||
      key.includes('diesel') ||
      key.includes('petrol') ||
      key.includes('lpg') ||
      key.includes('gas_oil')
    ) {
      return FUEL_VOLUME_UNITS
    }
  }
  return category.unitOptions
}

export function adjacentCategory(id: string) {
  const index = CATEGORIES.findIndex((c) => c.id === id)
  return {
    prev: index > 0 ? CATEGORIES[index - 1] : null,
    next: index >= 0 && index < CATEGORIES.length - 1 ? CATEGORIES[index + 1] : null,
  }
}
