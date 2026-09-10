import type { CategoryConfig, UnitOption } from './types'

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
      'Enter purchased or on-site electricity used at construction sites, mines, processing plants, depots, and warehouses. Link utility bills in Additional Data.',
    fields: [
      {
        key: 'source',
        label: 'Energy source',
        type: 'select',
        options: ['Purchased electricity', 'On-site renewable electricity'],
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
    resolveFactorKey: (v) =>
      v.source?.includes('renewable')
        ? 'electricity_renewable_kwh'
        : 'electricity_grid_kwh',
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
      'Log ANFO, emulsion, or other explosives used in blasting at mines and quarries. Combustion CO₂ from the blast is Scope 1. Prefer a manufacturer or NGER factor when you have one.',
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
        key: 'amount',
        label: 'Amount',
        type: 'number',
      },
    ],
    amountField: 'amount',
    amountLabel: 'kg',
    unitOptions: MASS_KG_UNITS,
    resolveFactorKey: (v) => {
      if (v.gas === 'R-410A') return 'r410a_kg'
      if (v.gas === 'R-404A') return 'r404a_kg'
      if (v.gas === 'CO2') return 'co2_kg'
      return 'r134a_kg'
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
        key: 'amount',
        label: 'Amount',
        type: 'number',
        hint: 'Quantity of methane (CH₄), not total ventilation air.',
      },
    ],
    amountField: 'amount',
    amountLabel: 't',
    resolveFactorKey: (v) => {
      if (v.measure === 'Kilograms of CH₄') return 'mine_ch4_kg'
      if (v.measure === 'Cubic metres of CH₄') return 'mine_ch4_m3'
      return 'mine_ch4_t'
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
    resolveFactorKey: () => 'freight_sea_tkm',
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
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_air_tkm',
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
      'Enter construction and demolition waste, waste rock, tailings, and other site arisings by disposal route (landfill, recycling, or recovery).',
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
    amountLabel: 'kg',
    unitOptions: MASS_KG_UNITS,
    resolveFactorKey: (v) =>
      v.route === 'Recycling' ? 'waste_recycling_kg' : 'waste_landfill_kg',
    resolveUnit: (v) => v.unit || 'kg',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} ${v.unit || 'kg'} ${v.waste_type || 'site waste'} — ${v.route || 'disposal'}`,
  },
  {
    id: 'water',
    name: 'Water',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Site potable and process water supplied to construction compounds, mines, processing plants, and wash-out areas.',
    fields: [
      {
        key: 'type',
        label: 'Water type',
        type: 'select',
        options: ['Potable + process water', 'Potable only', 'Process only'],
      },
      { key: 'amount', label: 'Usage amount', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'm³',
    unitOptions: WATER_VOLUME_UNITS,
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
      return dist * num(v, 'trips') * 2
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
      'Embodied carbon of concrete, steel, timber, asphalt, aggregates, lime, and other bulk materials (EN 15978 A1–A3 cradle-to-gate). Mining reagents such as lime sit here; ore haulage belongs under freight.',
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
    instructions: 'Purchased heat or steam supplied to site compounds, curing, processing plants, or workshops.',
    fields: [
      {
        key: 'type',
        label: 'Supply type',
        type: 'select',
        options: ['District heat', 'Steam', 'On-site heat network'],
      },
      { key: 'amount', label: 'Usage', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'kWh',
    unitOptions: ELECTRICITY_UNITS,
    resolveFactorKey: () => 'heat_steam_kwh',
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
      'Staff flights, hotel stays, and taxi journeys for business purposes (GHG Protocol Scope 3, Category 6).',
    fields: [
      {
        key: 'type',
        label: 'Travel type',
        type: 'select',
        options: [
          'Domestic flight', 'Short-haul flight', 'Long-haul flight (economy)',
          'Long-haul flight (business)', 'Hotel (UK)', 'Hotel (overseas)', 'Taxi',
        ],
      },
      { key: 'amount', label: 'Amount', type: 'number', hint: 'Passenger-km for flights, nights for hotels, km for taxis.' },
    ],
    amountField: 'amount',
    amountLabel: 'pkm / nights / km',
    resolveFactorKey: (v) => {
      const map: Record<string, string> = {
        'Domestic flight': 'flight_domestic_pkm',
        'Short-haul flight': 'flight_shorthaul_pkm',
        'Long-haul flight (economy)': 'flight_longhaul_economy_pkm',
        'Long-haul flight (business)': 'flight_longhaul_business_pkm',
        'Hotel (UK)': 'hotel_uk_night',
        'Hotel (overseas)': 'hotel_overseas_night',
        'Taxi': 'taxi_km',
      }
      return map[v.type] || 'flight_shorthaul_pkm'
    },
    resolveUnit: (v) => {
      if (v.type?.includes('Hotel')) return 'nights'
      if (v.type?.includes('Taxi')) return 'km'
      return 'pkm'
    },
    resolveDetails: (v, amount) => `${amount.toLocaleString()} — ${v.type || 'business travel'}`,
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
        options: ['Car', 'Bus', 'Rail', 'Motorbike'],
      },
      { key: 'distance', label: 'One-way distance', type: 'number', unitOptions: DISTANCE_KM_UNITS },
      { key: 'employees', label: 'Number of employees', type: 'number' },
      { key: 'days', label: 'Working days', type: 'number', hint: 'Days in the reporting period (e.g. 230 for a year).' },
    ],
    amountField: 'distance',
    amountLabel: 'km',
    resolveFactorKey: (v) => {
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
          'UK grid electricity T&D',
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
        'UK grid electricity T&D': 'wtt_electricity_kwh',
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
      'Spend-based estimate for bought-in goods and services where activity data is unavailable (GHG Protocol Scope 3, Category 1). Use £ thousands. Prefer activity-based methods when possible.',
    fields: [
      {
        key: 'type',
        label: 'Category',
        type: 'select',
        options: ['Purchased goods & services', 'Capital goods'],
      },
      { key: 'amount', label: 'Spend (£ thousands)', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: '£k',
    resolveFactorKey: (v) =>
      v.type === 'Capital goods' ? 'capital_goods_gbp' : 'purchased_goods_gbp',
    resolveUnit: () => '£k',
    resolveDetails: (v, amount) =>
      `£${(amount * 1000).toLocaleString()} spend on ${v.type?.toLowerCase() || 'purchased goods'}`,
  },
  {
    id: 'custom',
    name: 'Custom',
    scope: 'Custom',
    group: 'scope3',
    instructions:
      'Enter an activity amount and conversion value from a verified source. tCO₂e = (activity × conversion value) / 1000.',
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

export function adjacentCategory(id: string) {
  const index = CATEGORIES.findIndex((c) => c.id === id)
  return {
    prev: index > 0 ? CATEGORIES[index - 1] : null,
    next: index >= 0 && index < CATEGORIES.length - 1 ? CATEGORIES[index + 1] : null,
  }
}
