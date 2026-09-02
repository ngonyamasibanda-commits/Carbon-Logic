import type { CategoryConfig } from './types'

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
      'Enter purchased or on-site electricity used at construction sites, depots, and warehouses. Link utility bills in Additional Data.',
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
    resolveFactorKey: (v) =>
      v.source?.includes('renewable')
        ? 'electricity_renewable_kwh'
        : 'electricity_grid_kwh',
    resolveUnit: () => 'kWh',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} kWh of ${v.source || 'electricity'}`,
  },
  {
    id: 'site_fuel',
    name: 'Site Fuel',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Log diesel, gas oil, petrol, or LPG used in site generators, heaters, and stationery plant.',
    fields: [
      {
        key: 'fuel',
        label: 'Fuel category',
        type: 'select',
        options: ['Diesel / gas oil', 'Petrol', 'LPG'],
      },
      {
        key: 'amount',
        label: 'Amount (litres)',
        type: 'number',
        hint: 'Amount of fuel used in the unit of measure specified above.',
      },
    ],
    amountField: 'amount',
    amountLabel: 'litres',
    resolveFactorKey: (v) => {
      if (v.fuel === 'Petrol') return 'petrol_litre'
      if (v.fuel === 'LPG') return 'lpg_litre'
      return 'diesel_litre'
    },
    resolveUnit: () => 'L',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} litres of ${v.fuel || 'fuel'}`,
  },
  {
    id: 'heavy_machinery',
    name: 'Heavy Machinery',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Capture fuel burned by excavators, cranes, loaders, and other owned construction plant.',
    fields: [
      {
        key: 'equipment',
        label: 'Equipment type',
        type: 'select',
        options: ['Excavator', 'Crane', 'Loader / dozer', 'Concrete mixer', 'Other plant'],
      },
      {
        key: 'fuel',
        label: 'Fuel type',
        type: 'select',
        options: ['Diesel / red diesel', 'HVO', 'Petrol'],
      },
      {
        key: 'amount',
        label: 'Fuel used (litres)',
        type: 'number',
      },
    ],
    amountField: 'amount',
    amountLabel: 'litres',
    resolveFactorKey: (v) => {
      if (v.fuel === 'Petrol') return 'petrol_litre'
      if (v.fuel === 'HVO') return 'hvo_litre'
      return 'gas_oil_litre'
    },
    resolveUnit: () => 'L',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} litres ${v.fuel || 'diesel'} — ${v.equipment || 'plant'}`,
  },
  {
    id: 'fleet',
    name: 'Fleet Vehicles',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Company-owned vans, pickups, and HGVs used for site supervision and material drops.',
    fields: [
      {
        key: 'vehicle',
        label: 'Vehicle type',
        type: 'select',
        options: ['Van / pickup', 'HGV', 'Company car'],
      },
      {
        key: 'fuel',
        label: 'Fuel type',
        type: 'select',
        options: ['Diesel', 'Petrol', 'LPG'],
      },
      {
        key: 'amount',
        label: 'Fuel used (litres)',
        type: 'number',
      },
    ],
    amountField: 'amount',
    amountLabel: 'litres',
    resolveFactorKey: (v) => {
      if (v.fuel === 'Petrol') return 'petrol_litre'
      if (v.fuel === 'LPG') return 'lpg_litre'
      return 'diesel_litre'
    },
    resolveUnit: () => 'L',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} litres of ${v.fuel || 'fuel'} — ${v.vehicle || 'fleet'}`,
  },
  {
    id: 'refrigerants',
    name: 'Refrigerants',
    scope: 'Scope 1',
    group: 'input',
    instructions:
      'Record refrigerant top-ups for site welfare HVAC, cold stores, and refrigerated logistics assets.',
    fields: [
      {
        key: 'gas',
        label: 'Type of gas',
        type: 'select',
        options: ['R-134A', 'R-410A', 'R-404A', 'CO2'],
      },
      {
        key: 'amount',
        label: 'Amount in kg',
        type: 'number',
      },
    ],
    amountField: 'amount',
    amountLabel: 'kg',
    resolveFactorKey: (v) => {
      if (v.gas === 'R-410A') return 'r410a_kg'
      if (v.gas === 'R-404A') return 'r404a_kg'
      if (v.gas === 'CO2') return 'co2_kg'
      return 'r134a_kg'
    },
    resolveUnit: () => 'kg',
    resolveDetails: (v, amount) => `${amount.toLocaleString()} kg ${v.gas || 'refrigerant'}`,
  },
  {
    id: 'road_freight',
    name: 'Road Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions:
      'Log contracted road haulage of materials and equipment. Activity amount is tonne-kilometres (weight × distance).',
    fields: [
      {
        key: 'mode',
        label: 'Vehicle class',
        type: 'select',
        options: ['HGV rigid', 'HGV articulated', 'Van'],
      },
      {
        key: 'weight',
        label: 'Cargo weight (tonnes)',
        type: 'number',
      },
      {
        key: 'distance',
        label: 'Distance (km)',
        type: 'number',
      },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_road_tkm',
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v, _amount) => num(v, 'weight') * num(v, 'distance'),
    resolveDetails: (v) =>
      `${num(v, 'weight').toLocaleString()} t × ${num(v, 'distance').toLocaleString()} km by ${v.mode || 'road'}`,
  },
  {
    id: 'rail_freight',
    name: 'Rail Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Record inbound or outbound rail movements of bulk construction materials.',
    fields: [
      { key: 'weight', label: 'Cargo weight (tonnes)', type: 'number' },
      { key: 'distance', label: 'Distance (km)', type: 'number' },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_rail_tkm',
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => num(v, 'weight') * num(v, 'distance'),
    resolveDetails: (v) =>
      `${num(v, 'weight').toLocaleString()} t × ${num(v, 'distance').toLocaleString()} km by rail`,
  },
  {
    id: 'sea_freight',
    name: 'Sea Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Log ocean or coastal shipping of steel, plant, and other imported materials.',
    fields: [
      {
        key: 'mode',
        label: 'Vessel type',
        type: 'select',
        options: ['Container', 'Bulk carrier', 'RoRo'],
      },
      { key: 'weight', label: 'Cargo weight (tonnes)', type: 'number' },
      { key: 'distance', label: 'Distance (km)', type: 'number' },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_sea_tkm',
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => num(v, 'weight') * num(v, 'distance'),
    resolveDetails: (v) =>
      `${num(v, 'weight').toLocaleString()} t × ${num(v, 'distance').toLocaleString()} km by sea (${v.mode || 'vessel'})`,
  },
  {
    id: 'air_freight',
    name: 'Air Freight',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Use for time-critical plant parts and high-value construction materials moved by air.',
    fields: [
      { key: 'weight', label: 'Cargo weight (tonnes)', type: 'number' },
      { key: 'distance', label: 'Distance (km)', type: 'number' },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_air_tkm',
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => num(v, 'weight') * num(v, 'distance'),
    resolveDetails: (v) =>
      `${num(v, 'weight').toLocaleString()} t × ${num(v, 'distance').toLocaleString()} km by air`,
  },
  {
    id: 'waste',
    name: 'Construction Waste',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Enter demolition and construction waste by disposal route (landfill, recycling, or recovery).',
    fields: [
      {
        key: 'route',
        label: 'Disposal route',
        type: 'select',
        options: ['Landfill', 'Recycling', 'Energy recovery'],
      },
      { key: 'amount', label: 'Amount (kg)', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'kg',
    resolveFactorKey: (v) =>
      v.route === 'Recycling' ? 'waste_recycling_kg' : 'waste_landfill_kg',
    resolveUnit: () => 'kg',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} kg construction waste — ${v.route || 'disposal'}`,
  },
  {
    id: 'water',
    name: 'Water',
    scope: 'Scope 3',
    group: 'input',
    instructions: 'Site potable and process water supplied to construction compounds and wash-out areas.',
    fields: [
      {
        key: 'type',
        label: 'Water type',
        type: 'select',
        options: ['Potable + process water', 'Potable only', 'Process only'],
      },
      { key: 'amount', label: 'Usage amount (m³)', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'm³',
    resolveFactorKey: () => 'water_m3',
    resolveUnit: () => 'm³',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} m³ ${v.type || 'water'}`,
  },
  {
    id: 'crew_transport',
    name: 'Crew Transport',
    scope: 'Scope 3',
    group: 'input',
    instructions:
      'Workforce travel to remote job sites by shuttle, van, or public transport. Enter one-way distance; return trips are included.',
    fields: [
      {
        key: 'mode',
        label: 'Transport type',
        type: 'select',
        options: ['Crew van', 'Shuttle bus', 'Rail', 'Car'],
      },
      { key: 'distance', label: 'One-way distance (km)', type: 'number' },
      { key: 'trips', label: 'Return trips', type: 'number' },
    ],
    amountField: 'distance',
    amountLabel: 'km',
    resolveFactorKey: (v) => {
      if (v.mode === 'Shuttle bus') return 'crew_bus_pkm'
      if (v.mode === 'Rail') return 'crew_rail_pkm'
      return 'crew_van_km'
    },
    resolveUnit: () => 'km',
    resolveActivityAmount: (v) => num(v, 'distance') * num(v, 'trips') * 2,
    resolveDetails: (v) =>
      `${num(v, 'distance').toLocaleString()} km ${v.mode || 'crew transport'}, ${num(v, 'trips')} return trips`,
  },
  {
    id: 'bulk_materials',
    name: 'Bulk Materials',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Embodied carbon of concrete, steel, timber, asphalt, and aggregates (EN 15978 A1–A3 cradle-to-gate).',
    fields: [
      {
        key: 'material',
        label: 'Material',
        type: 'select',
        options: ['Concrete', 'Steel', 'Timber', 'Asphalt', 'Aggregates', 'Cement', 'Rebar'],
      },
      { key: 'amount', label: 'Quantity (tonnes)', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'tonnes',
    resolveFactorKey: (v) => {
      const map: Record<string, string> = {
        Concrete: 'material_concrete_t',
        Steel: 'material_steel_t',
        Timber: 'material_timber_t',
        Asphalt: 'material_asphalt_t',
        Aggregates: 'material_aggregates_t',
        Cement: 'material_cement_t',
        Rebar: 'material_rebar_t',
      }
      return map[v.material] || 'material_concrete_t'
    },
    resolveUnit: () => 't',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} tonnes ${v.material || 'material'} (A1–A3)`,
  },
  {
    id: 'heat_steam',
    name: 'Heat and steam',
    scope: 'Scope 2',
    group: 'scope3',
    instructions: 'Purchased heat or steam supplied to site compounds, curing, or workshops.',
    fields: [
      {
        key: 'type',
        label: 'Supply type',
        type: 'select',
        options: ['District heat', 'Steam', 'On-site heat network'],
      },
      { key: 'amount', label: 'Usage (kWh)', type: 'number' },
    ],
    amountField: 'amount',
    amountLabel: 'kWh',
    resolveFactorKey: () => 'heat_steam_kwh',
    resolveUnit: () => 'kWh',
    resolveDetails: (v, amount) =>
      `${amount.toLocaleString()} kWh ${v.type || 'heat'}`,
  },
  {
    id: 'subcontractor',
    name: 'Subcontractor Logistics',
    scope: 'Scope 3',
    group: 'scope3',
    instructions:
      'Third-party haulage and plant moves organised by subcontractors (upstream Scope 3 category 4).',
    fields: [
      { key: 'weight', label: 'Cargo weight (tonnes)', type: 'number' },
      { key: 'distance', label: 'Distance (km)', type: 'number' },
    ],
    amountField: 'weight',
    amountLabel: 'tkm',
    resolveFactorKey: () => 'freight_road_tkm',
    resolveUnit: () => 'tkm',
    resolveActivityAmount: (v) => num(v, 'weight') * num(v, 'distance'),
    resolveDetails: (v) =>
      `${num(v, 'weight').toLocaleString()} t × ${num(v, 'distance').toLocaleString()} km subcontracted haulage`,
  },
  {
    id: 'custom',
    name: 'Custom',
    scope: 'Custom',
    group: 'scope3',
    instructions:
      'Enter an activity amount and conversion value from a verified source. tCO₂e = (activity × conversion value) / 1000.',
    fields: [
      { key: 'label', label: 'Activity name', type: 'text', placeholder: 'e.g. imported cladding' },
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
