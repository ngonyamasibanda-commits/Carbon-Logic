import type { CategoryConfig, UnitOption } from './types'
import { HOTEL_COUNTRY_OPTIONS, hotelFactorKey } from './factor-catalog'
import { CEDA_SECTOR_OPTIONS, cedaSectorByName } from './ceda'

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
          'Purchased electricity',
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
      'Log diesel, gas oil, petrol, LPG, or natural gas used in generators, heaters, pumps, and stationary plant at sites, mines, and processing plants.',
    fields: [
      {
        key: 'fuel',
        label: 'Fuel category',
        type: 'select',
        options: ['Diesel / gas oil', 'Petrol', 'LPG', 'Natural gas (kWh)', 'Natural gas (m³)'],
      },
      {
        key: 'amount',
        label: 'Fuel amount',
        type: 'number',
        hint: 'Amount of fuel used. For liquids, choose volume unit below. For natural gas, enter kWh or m³ as selected.',
      },
    ],
    amountField: 'amount',
    amountLabel: 'L',
    unitOptions: FUEL_VOLUME_UNITS,
    chainExtras: ['wtt'],
    resolveFactorKey: (v) => {
      if (v.fuel === 'Petrol') return 'petrol_litre'
      if (v.fuel === 'LPG') return 'lpg_litre'
      if (v.fuel === 'Natural gas (kWh)') return 'natural_gas_kwh'
      if (v.fuel === 'Natural gas (m³)') return 'natural_gas_m3'
      return 'diesel_litre'
    },
    resolveUnit: (v) => v.unit || 'L',
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
        label: 'Fuel type',
        type: 'select',
        options: ['Diesel / red diesel', 'HVO', 'Petrol'],
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
      if (v.fuel === 'Petrol') return 'petrol_litre'
      if (v.fuel === 'HVO') return 'hvo_litre'
      return 'gas_oil_litre'
    },
    resolveUnit: (v) => v.unit || 'L',
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
      'Company-owned vans, pickups, light vehicles, and HGVs used for site supervision, shift changes, and material drops. Mine haul trucks belong under Heavy Machinery.',
    fields: [
      {
        key: 'vehicle',
        label: 'Vehicle type',
        type: 'select',
        options: ['Van / pickup', 'Light vehicle', 'HGV', 'Company car'],
      },
      {
        key: 'fuel',
        label: 'Fuel type',
        type: 'select',
        options: ['Diesel', 'Petrol', 'LPG'],
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
      if (v.fuel === 'Petrol') return 'petrol_litre'
      if (v.fuel === 'LPG') return 'lpg_litre'
      return 'diesel_litre'
    },
    resolveUnit: (v) => v.unit || 'L',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'L'} of ${v.fuel || 'fuel'} — ${v.vehicle || 'fleet'}`,
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
        options: ['R-134A', 'R-410A', 'R-404A', 'CO2'],
      },
      {
        key: 'gwp_set',
        label: 'GWP set',
        type: 'select',
        options: ['DESNZ 2026 (IPCC AR5, UK default)', 'EPA Hub 2026 (IPCC AR6)'],
        hint: 'UK inventory stays on DESNZ AR5. EPA AR6 is only for US-style reporting and does not replace the DESNZ row.',
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
      if (v.gas === 'R-410A') return epa ? 'r410a_epa_kg' : 'r410a_kg'
      if (v.gas === 'R-404A') return epa ? 'r404a_epa_kg' : 'r404a_kg'
      if (v.gas === 'CO2') return 'co2_kg'
      return epa ? 'r134a_epa_kg' : 'r134a_kg'
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
      'Log contracted road haulage of materials, equipment, ore, concentrate, and waste. Activity amount is tonne-kilometres (weight × distance).',
    fields: [
      {
        key: 'mode',
        label: 'Vehicle class',
        type: 'select',
        options: ['HGV rigid', 'HGV articulated', 'Van'],
      },
      { key: 'weight', label: 'Cargo weight', type: 'number', unitOptions: MASS_TONNE_UNITS },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: (v) => {
      if (v.mode === 'Van') return 'freight_van_tkm'
      if (v.mode === 'HGV rigid') return 'freight_road_rigid_tkm'
      if (v.mode === 'HGV articulated') return 'freight_road_artic_tkm'
      return 'freight_road_tkm'
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
      return `${num(v, 'weight').toLocaleString()} ${wu} × ${num(v, 'distance').toLocaleString()} ${du} by ${v.mode || 'road'}`
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
        options: ['Container', 'Bulk carrier', 'RoRo'],
      },
      { key: 'weight', label: 'Cargo weight', type: 'number', unitOptions: MASS_TONNE_UNITS },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: (v) => {
      if (v.mode === 'Bulk carrier') return 'freight_sea_bulk_tkm'
      if (v.mode === 'RoRo') return 'freight_sea_roro_tkm'
      return 'freight_sea_tkm'
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
      { key: 'weight', label: 'Cargo weight', type: 'number', unitOptions: MASS_TONNE_UNITS },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
      {
        key: 'rf',
        label: 'Radiative forcing',
        type: 'select',
        options: ['With RF (DESNZ default)', 'Without RF'],
      },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: (v) => (v.rf === 'Without RF' ? 'freight_air_tkm_no_rf' : 'freight_air_tkm'),
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
        options: [
          'Construction & demolition',
          'Waste rock',
          'Tailings',
          'Mineral / inert',
          'Mixed / other',
        ],
      },
      {
        key: 'route',
        label: 'Disposal route',
        type: 'select',
        options: ['Landfill', 'Recycling', 'Energy recovery'],
      },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 't',
    unitOptions: MASS_TONNE_UNITS,
    resolveFactorKey: (v) => {
      if (v.route === 'Recycling') return 'waste_recycling_kg'
      if (v.route === 'Energy recovery') return 'waste_combustion_kg'
      return 'waste_landfill_kg'
    },
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
        options: ['Crew van', 'Shuttle bus', 'Rail', 'Car'],
      },
      { key: 'distance', label: 'One-way distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
      { key: 'trips', label: 'Return trips', type: 'number' },
      { key: 'passengers', label: 'Passengers per trip', type: 'number', hint: 'Used for bus and rail (passenger-km). Vans use vehicle-km.' },
    ],
    amountField: 'distance',
    amountLabel: 'km',
    resolveFactorKey: (v) => {
      if (v.mode === 'Shuttle bus') return 'crew_bus_pkm'
      if (v.mode === 'Rail') return 'crew_rail_pkm'
      return 'crew_van_km'
    },
    resolveUnit: (v) => v.distance_unit || 'km',
    resolveActivityAmount: (v) => {
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      const trips = num(v, 'trips')
      const passengers = num(v, 'passengers') || 1
      if (v.mode === 'Shuttle bus' || v.mode === 'Rail') return dist * trips * 2 * passengers
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
        ],
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
      }
      return map[v.material] || 'material_concrete_t'
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
        options: ['District heat', 'Steam', 'On-site heat network', 'US purchased steam (EPA Hub)'],
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
      'Third-party haulage and plant moves organised by subcontractors (upstream Scope 3 category 4), including contract mining and concentrate haulage.',
    fields: [
      { key: 'weight', label: 'Cargo weight', type: 'number', unitOptions: MASS_TONNE_UNITS },
      { key: 'distance', label: 'Distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_road_tkm',
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => {
      const wt = num(v, 'weight') * (num(v, 'weight_unit_factor') || 1)
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      return wt * dist
    },
    resolveDetails: (v) => {
      const wu = v.weight_unit || 't'
      const du = v.distance_unit || 'km'
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
        options: [
          'Domestic flight', 'Short-haul flight', 'Long-haul flight (economy)',
          'Long-haul flight (business)', 'Hotel', 'Taxi',
        ],
      },
      {
        key: 'hotel_country',
        label: 'Hotel country',
        type: 'select',
        options: HOTEL_COUNTRY_OPTIONS,
        hint: 'Used when travel type is Hotel. Only countries with a published 2026 factor are listed.',
      },
      { key: 'passengers', label: 'Passengers', type: 'number', hint: 'Flights and taxis. Leave blank for hotels.' },
      { key: 'amount', label: 'Distance or nights', type: 'number', hint: 'Kilometres for flights and taxis (passenger-km = passengers × km). Room-nights for hotels.' },
    ],
    amountField: 'amount',
    amountLabel: 'pkm / nights',
    resolveFactorKey: (v) => {
      if (v.type === 'Hotel') return hotelFactorKey(v.hotel_country || 'UK')
      const map: Record<string, string> = {
        'Domestic flight': 'flight_domestic_pkm',
        'Short-haul flight': 'flight_shorthaul_pkm',
        'Long-haul flight (economy)': 'flight_longhaul_economy_pkm',
        'Long-haul flight (business)': 'flight_longhaul_business_pkm',
        Taxi: 'taxi_pkm',
      }
      return map[v.type] || 'flight_shorthaul_pkm'
    },
    resolveUnit: (v) => (v.type === 'Hotel' ? 'nights' : 'pkm'),
    resolveActivityAmount: (v, amount) => {
      if (v.type === 'Hotel') return amount
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
      'Emissions from employees travelling between home and work (GHG Protocol Scope 3, Category 7). Enter one-way distance; return is included.',
    fields: [
      {
        key: 'mode',
        label: 'Commute mode',
        type: 'select',
        options: ['Car', 'Car (diesel)', 'Car (petrol)', 'Bus', 'Rail', 'Motorbike'],
      },
      { key: 'distance', label: 'One-way distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
      { key: 'employees', label: 'Number of employees', type: 'number' },
      { key: 'days', label: 'Working days', type: 'number', hint: 'Days in the reporting period (e.g. 230 for a year).' },
    ],
    amountField: 'distance',
    amountLabel: 'km',
    resolveFactorKey: (v) => {
      if (v.mode === 'Car (diesel)') return 'car_diesel_km'
      if (v.mode === 'Car (petrol)') return 'car_petrol_km'
      const map: Record<string, string> = {
        Car: 'commute_car_km',
        Bus: 'commute_bus_pkm',
        Rail: 'commute_rail_pkm',
        Motorbike: 'commute_motorbike_km',
      }
      return map[v.mode] || 'commute_car_km'
    },
    resolveUnit: (v) => v.distance_unit || 'km',
    resolveActivityAmount: (v) => {
      const dist = num(v, 'distance') * (num(v, 'distance_unit_factor') || 1)
      return dist * num(v, 'employees') * num(v, 'days') * 2
    },
    resolveDetails: (v) => {
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
      'Well-to-tank emissions from producing the fuel and electricity you already counted in Scope 1 and 2, plus UK grid transmission and distribution losses (GHG Protocol Scope 3, Category 3). Log the same litres or kWh you logged under site fuel or electricity.',
    fields: [
      {
        key: 'source',
        label: 'Energy source',
        type: 'select',
        options: [
          'Diesel (WTT)',
          'Petrol (WTT)',
          'LPG (WTT)',
          'Gas oil (WTT)',
          'Natural gas (WTT)',
          'UK electricity WTT (generation)',
          'UK electricity T&D losses',
          'UK electricity WTT (T&D)',
        ],
      },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'L / kWh',
    resolveFactorKey: (v) => {
      const map: Record<string, string> = {
        'Diesel (WTT)': 'wtt_diesel_litre',
        'Petrol (WTT)': 'wtt_petrol_litre',
        'LPG (WTT)': 'wtt_lpg_litre',
        'Gas oil (WTT)': 'wtt_gas_oil_litre',
        'Natural gas (WTT)': 'wtt_natural_gas_kwh',
        'UK electricity WTT (generation)': 'wtt_electricity_kwh',
        'UK electricity T&D losses': 'electricity_td_kwh',
        'UK electricity WTT (T&D)': 'wtt_electricity_td_kwh',
      }
      return map[v.source] || 'wtt_diesel_litre'
    },
    resolveUnit: (v) => (v.source?.includes('electricity') || v.source?.includes('Natural gas') ? 'kWh' : 'L'),
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.source?.includes('electricity') || v.source?.includes('Natural gas') ? 'kWh' : 'L'} ${v.source || 'WTT'}`,
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
  if (category.id === 'site_fuel' || category.id === 'energy_wtt') {
    const key = category.resolveFactorKey(values)
    if (key.includes('kwh')) return ELECTRICITY_UNITS
    if (key.includes('m3') || key.includes('_m3')) return WATER_VOLUME_UNITS
    if (
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
