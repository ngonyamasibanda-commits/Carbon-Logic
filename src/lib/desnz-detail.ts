import type { EmissionFactor, FactorMethod, Scope } from './types'
import { DESNZ_DETAIL_ROWS, DESNZ_LOOKUP } from './desnz-detail-data'

const GOV_URL =
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026'
const DEFRA =
  'UK GHG Conversion Factors for Company Reporting 2026 (DESNZ / DEFRA; formerly BEIS). kg CO₂e, IPCC AR5. Published 11 June 2026; flat file revised 31 July 2026. For 2026 activity / SECR 2026.'

export function desnzLookup(path: string, fallback?: string) {
  return DESNZ_LOOKUP[path] ?? fallback ?? ''
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function paths(prefix: string) {
  return Object.keys(DESNZ_LOOKUP).filter((key) => key.startsWith(prefix))
}

export const VAN_CLASSES = [
  'Class I (up to 1.305 tonnes)',
  'Class II (1.305 to 1.74 tonnes)',
  'Class III (1.74 to 3.5 tonnes)',
  'Average (up to 3.5 tonnes)',
] as const

export const VAN_FUELS = [
  'Diesel',
  'Petrol',
  'CNG',
  'LPG',
  'Unknown',
  'Plug-in Hybrid Electric Vehicle',
  'Battery Electric Vehicle',
] as const

export const HGV_SIZE_OPTIONS = [
  'Rigid (>3.5 - 7.5 tonnes)',
  'Rigid (>7.5 tonnes-17 tonnes)',
  'Rigid (>17 tonnes)',
  'Average rigid',
  'Articulated (>3.5 - 33t)',
  'Articulated (>33t)',
  'Average artic',
  'Average HGV',
] as const

export const LADEN_OPTIONS = ['Average laden', '0% Laden', '50% Laden', '100% Laden'] as const

export const CAR_SIZES = ['Small car', 'Medium car', 'Large car', 'Average car'] as const

export const CAR_SEGMENTS = [
  'Mini',
  'Supermini',
  'Lower medium',
  'Upper medium',
  'Executive',
  'Luxury',
  'Sports',
  'Dual purpose 4X4',
  'MPV',
] as const

export const CAR_FUELS = [
  'Diesel',
  'Petrol',
  'Hybrid',
  'CNG',
  'LPG',
  'Unknown',
  'Plug-in Hybrid Electric Vehicle',
  'Battery Electric Vehicle',
] as const

export const MOTORBIKE_SIZES = ['Small', 'Medium', 'Large', 'Average'] as const

export const AIR_HAULS = ['Domestic', 'Short-haul', 'Long-haul', 'International'] as const

export const FLIGHT_CLASSES_BY_HAUL: Record<string, string[]> = {
  Domestic: ['Average passenger'],
  'Short-haul': ['Average passenger', 'Economy class', 'Business class'],
  'Long-haul': [
    'Average passenger',
    'Economy class',
    'Premium economy class',
    'Business class',
    'First class',
  ],
  International: [
    'Average passenger',
    'Economy class',
    'Premium economy class',
    'Business class',
    'First class',
  ],
}

export const RF_OPTIONS = ['With RF (DESNZ default)', 'Without RF'] as const

export const TAXI_TYPES = ['Regular taxi', 'Black cab'] as const

export const BUS_TYPES = [
  'Local bus (not London)',
  'Local London bus',
  'Average local bus',
  'Coach',
] as const

export const RAIL_TYPES = [
  'National rail',
  'International rail',
  'Light rail and tram',
  'London Underground',
] as const

export const FERRY_TYPES = ['Foot passenger', 'Car passenger', 'Average (all passenger)'] as const

export function hgvTypeName(size: string, refrigerated: boolean) {
  if (size === 'Average rigid') {
    return refrigerated ? 'Average refrigerated rigids' : 'Average non-refrigerated rigids'
  }
  if (size === 'Average artic') {
    return refrigerated ? 'Average refrigerated artics' : 'Average non-refrigerated artics'
  }
  if (size === 'Average HGV') {
    return refrigerated ? 'Average refrigerated HGVs' : 'Average non-refrigerated HGVs'
  }
  return size
}

export function vanFuelsFor(cls: string, unit: 'km' | 'tkm') {
  return VAN_FUELS.filter((fuel) => DESNZ_LOOKUP[`van|${unit}|${cls}|${fuel}`])
}

export function carFuelsFor(kind: 'car_size' | 'car_segment', label: string) {
  return CAR_FUELS.filter((fuel) => DESNZ_LOOKUP[`${kind}|km|${label}|${fuel}`])
}

export const SEA_VESSEL_TYPES = unique(
  paths('sea|').map((key) => key.split('|')[1]),
).sort((a, b) => a.localeCompare(b))

export function seaSizesFor(vessel: string) {
  const type = mapSeaVessel(vessel)
  const sizes = unique(
    paths(`sea|${type}|`).map((key) => key.split('|')[2]),
  )
  return sizes.sort((a, b) => {
    if (a === 'Average') return -1
    if (b === 'Average') return 1
    return a.localeCompare(b)
  })
}

export const WASTE_TYPES = unique(paths('waste|').map((key) => key.split('|')[1])).sort((a, b) =>
  a.localeCompare(b),
)

const WASTE_ROUTE_ORDER = [
  'Landfill',
  'Closed-loop',
  'Open-loop',
  'Combustion',
  'Composting',
  'Anaerobic digestion',
  'Re-use',
]

export function wasteRoutesFor(wasteType: string) {
  return WASTE_ROUTE_ORDER.filter((route) => DESNZ_LOOKUP[`waste|${wasteType}|${route}`])
}

export const REFRIGERANT_PRIORITY = [
  'HFC-134a',
  'R410A',
  'R404A',
  'Carbon dioxide',
  'HFC-32',
  'R407C',
  'R407A',
  'R407F',
  'R417A',
  'R422D',
  'R427A',
  'R438A',
  'R507A',
  'Sulphur hexafluoride (SF6)',
]

export const REFRIGERANT_NAMES = (() => {
  const rest = unique(paths('ref|').map((key) => key.slice(4))).filter(
    (name) => !REFRIGERANT_PRIORITY.includes(name),
  )
  rest.sort((a, b) => a.localeCompare(b))
  return [...REFRIGERANT_PRIORITY.filter((name) => DESNZ_LOOKUP[`ref|${name}`]), ...rest]
})()

export function refrigerantLabel(name: string) {
  if (name === 'HFC-134a') return 'R-134A'
  if (name === 'R410A') return 'R-410A'
  if (name === 'R404A') return 'R-404A'
  if (name === 'Carbon dioxide') return 'CO2'
  if (name === 'HFC-32') return 'R-32 (HFC-32)'
  return name
}

export const REFRIGERANT_OPTIONS = REFRIGERANT_NAMES.map(refrigerantLabel)

export function refrigerantFactorKey(label: string) {
  if (label === 'R-134A') return 'r134a_kg'
  if (label === 'R-410A') return 'r410a_kg'
  if (label === 'R-404A') return 'r404a_kg'
  if (label === 'CO2') return 'co2_kg'
  if (label === 'R-32 (HFC-32)') return desnzLookup('ref|HFC-32', 'ref_hfc_32_kg')
  return desnzLookup(`ref|${label}`, 'r134a_kg')
}

export const FUEL_NAMES = unique(paths('fuel|').map((key) => key.split('|')[1])).sort((a, b) =>
  a.localeCompare(b),
)

export const BIO_NAMES = unique(paths('bio|').map((key) => key.split('|')[1])).sort((a, b) =>
  a.localeCompare(b),
)

export const SITE_FUEL_OPTIONS = [
  'Diesel / gas oil',
  'Diesel (average biofuel blend)',
  'Diesel (100% mineral diesel)',
  'Gas oil',
  'Petrol',
  'Petrol (average biofuel blend)',
  'Petrol (100% mineral petrol)',
  'LPG',
  'Natural gas',
  'Natural gas (kWh)',
  'Natural gas (m³)',
  'Natural gas (100% mineral blend)',
  'CNG',
  'LNG',
  'Butane',
  'Propane',
  'Burning oil',
  'Fuel oil',
  'Marine gas oil',
  'Marine fuel oil',
  'Aviation turbine fuel',
  'Aviation spirit',
  'Lubricants',
  'Waste oils',
  'Coal (industrial)',
  'Coal (domestic)',
  'Coking coal',
  ...BIO_NAMES,
  ...FUEL_NAMES.filter(
    (name) =>
      ![
        'Diesel (average biofuel blend)',
        'Diesel (100% mineral diesel)',
        'Gas oil',
        'Petrol (average biofuel blend)',
        'Petrol (100% mineral petrol)',
        'LPG',
        'Natural gas',
        'Natural gas (100% mineral blend)',
        'CNG',
        'LNG',
        'Butane',
        'Propane',
        'Burning oil',
        'Fuel oil',
        'Marine gas oil',
        'Marine fuel oil',
        'Aviation turbine fuel',
        'Aviation spirit',
        'Lubricants',
        'Waste oils',
        'Coal (industrial)',
        'Coal (domestic)',
        'Coking coal',
      ].includes(name),
  ),
]

export function publishedUnitsForFuel(fuel: string) {
  const bio = paths(`bio|${fuel}|`).map((key) => key.split('|')[2])
  if (bio.length) return unique(bio)
  return unique(paths(`fuel|${fuel}|`).map((key) => key.split('|')[2]))
}

export function canonicalFuelName(label: string) {
  if (label === 'Diesel / gas oil') return 'Diesel (average biofuel blend)'
  if (label === 'Petrol') return 'Petrol (average biofuel blend)'
  if (label === 'Natural gas (kWh)') return 'Natural gas'
  if (label === 'Natural gas (m³)') return 'Natural gas'
  return label
}

export function defaultFuelBasis(label: string) {
  if (label === 'Natural gas (kWh)' || label === 'Natural gas') return 'kWh (Gross CV)'
  if (label === 'Natural gas (m³)') return 'cubic metres'
  const units = publishedUnitsForFuel(canonicalFuelName(label))
  if (units.includes('litres')) return 'litres'
  if (units.includes('cubic metres')) return 'cubic metres'
  if (units.includes('kWh (Gross CV)')) return 'kWh (Gross CV)'
  return units[0] || 'litres'
}

export function wttEnergyKey(label: string, basis?: string) {
  if (label === 'Diesel (WTT)') return 'wtt_diesel_litre'
  if (label === 'Petrol (WTT)') return 'wtt_petrol_litre'
  if (label === 'LPG (WTT)') return 'wtt_lpg_litre'
  if (label === 'Gas oil (WTT)') return 'wtt_gas_oil_litre'
  if (label === 'Natural gas (WTT)') return 'wtt_natural_gas_kwh'
  if (label.includes('electricity WTT (generation)')) return 'wtt_electricity_kwh'
  if (label.includes('T&D losses') && !label.includes('WTT (T&D)')) return 'electricity_td_kwh'
  if (label.includes('WTT (T&D)')) return 'wtt_electricity_td_kwh'
  const fuel = canonicalFuelName(label.replace(/^WTT — /, ''))
  const unit = basis || defaultFuelBasis(fuel)
  return (
    DESNZ_LOOKUP[`wtt_fuel|${fuel}|${unit}`] ||
    DESNZ_LOOKUP[`wtt_bio|${fuel}|${unit}`] ||
    'wtt_diesel_litre'
  )
}

export function energyFactorKey(label: string, basis?: string) {
  if (label === 'Diesel / gas oil' && (!basis || basis === 'litres')) return 'diesel_litre'
  if (label === 'Petrol' && (!basis || basis === 'litres')) return 'petrol_litre'
  if (label === 'Natural gas (kWh)') return 'natural_gas_kwh'
  if (label === 'Natural gas (m³)') return 'natural_gas_m3'
  if (label === 'HVO' || label === 'Biodiesel HVO') {
    return DESNZ_LOOKUP[`bio|Biodiesel HVO|${basis || 'litres'}`] || 'hvo_litre'
  }
  if (label === 'Diesel / red diesel') return energyFactorKey('Gas oil', basis || 'litres')
  const fuel = canonicalFuelName(label)
  const unit = basis || defaultFuelBasis(label)
  return (
    DESNZ_LOOKUP[`fuel|${fuel}|${unit}`] ||
    DESNZ_LOOKUP[`bio|${fuel}|${unit}`] ||
    'diesel_litre'
  )
}

export function energyFactorUnit(label: string, basis?: string) {
  const unit = basis || defaultFuelBasis(label)
  if (unit === 'litres') return 'L'
  if (unit === 'tonnes') return 't'
  if (unit === 'cubic metres') return 'm³'
  if (unit.startsWith('kWh')) return 'kWh'
  if (unit === 'kg') return 'kg'
  if (unit === 'GJ') return 'GJ'
  return unit
}

export const MATERIAL_NAMES = unique(paths('material|').map((key) => key.split('|')[1])).sort(
  (a, b) => a.localeCompare(b),
)

const MATERIAL_ORIGIN_ORDER = [
  'Primary material production',
  'Re-used',
  'Closed-loop source',
  'Open-loop source',
]

export function materialOriginsFor(name: string) {
  return MATERIAL_ORIGIN_ORDER.filter((origin) => DESNZ_LOOKUP[`material|${name}|${origin}`])
}

export function materialFactorKey(name: string, origin?: string) {
  const chosen = origin || materialOriginsFor(name)[0] || 'Primary material production'
  return desnzLookup(`material|${name}|${chosen}`, 'material_concrete_t')
}

export function motorbikeFactorKey(size: string) {
  return desnzLookup(`motorbike|km|${size || 'Average'}|Petrol`, 'commute_motorbike_km')
}

export function mapSeaVessel(mode: string) {
  if (mode === 'Container' || mode === 'Container ship') return 'Container ship'
  if (mode === 'RoRo' || mode === 'RoRo-Ferry') return 'RoRo-Ferry'
  if (mode === 'Bulk carrier') return 'Bulk carrier'
  return mode
}

export const SEA_VESSEL_OPTIONS = unique(['Container', 'RoRo', ...SEA_VESSEL_TYPES])

export const GENERIC_WASTE_TYPES = [
  'Construction & demolition',
  'Waste rock',
  'Tailings',
  'Mineral / inert',
  'Mixed / other',
]

export const CONSTRUCTION_WASTE_TYPES = [
  'Aggregates',
  'Asbestos',
  'Asphalt',
  'Average construction',
  'Bricks',
  'Concrete',
  'Insulation',
  'Metals',
  'Mineral oil',
  'Plasterboard',
  'Soils',
  'Tyres',
  'Wood',
]

export const COMMON_REFRIGERANTS = ['R-134A', 'R-410A', 'R-404A', 'CO2']

export const FLEET_METHOD_1 = 'Fuel litres (Method 1 — preferred when known)'
export const FLEET_METHOD_2 = 'Distance (Method 2 — vehicle km)'

export function isFleetDistanceMethod(method: string | undefined) {
  return (method || '').includes('Distance') || (method || '').includes('Method 2')
}

export function isVehicleKmMetric(metric: string | undefined) {
  return (metric || '').toLowerCase().includes('vehicle')
}

export function isRefrigeratedBody(value: string | undefined) {
  const text = (value || '').toLowerCase()
  return text.startsWith('refrigerated') || text === 'yes'
}

export function vanFactorKey(cls: string, fuel: string, unit: 'km' | 'tkm') {
  return (
    DESNZ_LOOKUP[`van|${unit}|${cls}|${fuel}`] ||
    DESNZ_LOOKUP[`van|${unit}|Average (up to 3.5 tonnes)|${fuel}`] ||
    (unit === 'tkm' ? 'freight_van_tkm' : 'van_average_up_to_3_5_tonnes_diesel_km')
  )
}

export function hgvFactorKey(opts: {
  size: string
  refrigerated: boolean
  laden: string
  unit: 'km' | 'tkm'
}) {
  const type = hgvTypeName(opts.size, opts.refrigerated)
  const laden = opts.laden || 'Average laden'
  return (
    DESNZ_LOOKUP[`hgv|${opts.unit}|${type}|${opts.refrigerated ? 1 : 0}|${laden}`] ||
    (opts.unit === 'tkm' ? 'freight_road_tkm' : 'hgv_nr_average_non_refrigerated_hgvs_average_laden_km')
  )
}

export function carFactorKey(kind: 'car_size' | 'car_segment', label: string, fuel: string) {
  return (
    DESNZ_LOOKUP[`${kind}|km|${label}|${fuel}`] ||
    DESNZ_LOOKUP[`car_size|km|Average car|${fuel}`] ||
    'commute_car_km'
  )
}

export function motoFactorKey(size: string) {
  return DESNZ_LOOKUP[`motorbike|km|${size}|Petrol`] || 'commute_motorbike_km'
}

export function flightFactorKey(haul: string, seatClass: string, rf: string) {
  const rfLabel = rf === 'Without RF' ? 'Without RF' : 'With RF (DESNZ default)'
  return desnzLookup(`flight|${haul}|${seatClass}|${rfLabel}`, 'flight_shorthaul_pkm')
}

export function airFreightFactorKey(haul: string, rf: string) {
  const rfLabel = rf === 'Without RF' ? 'Without RF' : 'With RF (DESNZ default)'
  const shortHaul = haul.replace(', to/from UK', '').replace(', to/from non-UK', '')
  return desnzLookup(`air|${shortHaul}|${rfLabel}`, 'freight_air_tkm')
}

export function seaFactorKey(vessel: string, size: string) {
  const type = mapSeaVessel(vessel)
  if (type === 'Container ship' && (!size || size === 'Average')) return 'freight_sea_tkm'
  if (type === 'Bulk carrier' && (!size || size === 'Average')) return 'freight_sea_bulk_tkm'
  if (type === 'RoRo-Ferry' && (!size || size === 'Average')) return 'freight_sea_roro_tkm'
  return desnzLookup(`sea|${type}|${size || 'Average'}`, 'freight_sea_tkm')
}

export function parseRoadMode(mode: string): { kind: 'van' | 'hgv'; size: string } | null {
  if (!mode) return null
  if (mode === 'Van' || mode.startsWith('Van — ') || mode === 'Van / pickup') {
    return {
      kind: 'van',
      size: mode.startsWith('Van — ') ? mode.slice('Van — '.length) : 'Average (up to 3.5 tonnes)',
    }
  }
  if (mode === 'HGV rigid') return { kind: 'hgv', size: 'Average rigid' }
  if (mode === 'HGV articulated') return { kind: 'hgv', size: 'Average artic' }
  if (mode === 'HGV' || mode === 'HGV (average)') return { kind: 'hgv', size: 'Average HGV' }
  if (mode.startsWith('HGV — ')) return { kind: 'hgv', size: mode.slice('HGV — '.length) }
  return null
}

export function roadFreightFactorKey(values: Record<string, string>) {
  const unit: 'km' | 'tkm' = isVehicleKmMetric(values.metric) ? 'km' : 'tkm'
  const parsed = parseRoadMode(values.mode || values.vehicle_kind || values.family || '')
  const family = values.vehicle_kind || values.family || ''
  const kind = family === 'Van' || family === 'HGV' ? family.toLowerCase() : parsed?.kind
  const vanClass = values.van_class || (parsed?.kind === 'van' ? parsed.size : 'Average (up to 3.5 tonnes)')
  const vanFuel = values.van_fuel || 'Diesel'
  const hgvSize = values.hgv_class || (parsed?.kind === 'hgv' ? parsed.size : 'Average HGV')
  const refrigerated = isRefrigeratedBody(values.hgv_body)
  const laden = values.laden || 'Average laden'

  if (!values.vehicle_kind && !values.family && !values.van_class && !values.hgv_class && unit === 'tkm') {
    if (values.mode === 'Van') return 'freight_van_tkm'
    if (values.mode === 'HGV rigid') return 'freight_road_rigid_tkm'
    if (values.mode === 'HGV articulated') return 'freight_road_artic_tkm'
    if (!values.mode) return 'freight_road_tkm'
  }

  if (kind === 'van' || parsed?.kind === 'van') {
    return vanFactorKey(vanClass, vanFuel, unit)
  }
  if (kind === 'hgv' || parsed?.kind === 'hgv') {
    return hgvFactorKey({ size: hgvSize, refrigerated, laden, unit })
  }
  return unit === 'km' ? hgvFactorKey({ size: 'Average HGV', refrigerated: false, laden, unit }) : 'freight_road_tkm'
}

export function wasteFactorKey(wasteType: string, route: string) {
  if (wasteType === 'Construction & demolition' || wasteType === 'Mixed / other') {
    if (route === 'Recycling' || route === 'Closed-loop' || route === 'Open-loop') return 'waste_recycling_kg'
    if (route === 'Energy recovery' || route === 'Combustion') return 'waste_combustion_kg'
    return 'waste_landfill_kg'
  }
  if (wasteType === 'Waste rock' || wasteType === 'Tailings' || wasteType === 'Mineral / inert') {
    if (route === 'Recycling' || route === 'Closed-loop' || route === 'Open-loop') {
      return desnzLookup('waste|Soils|Closed-loop', 'waste_recycling_kg')
    }
    return desnzLookup('waste|Soils|Landfill', 'waste_landfill_kg')
  }
  if (route === 'Recycling') {
    return (
      DESNZ_LOOKUP[`waste|${wasteType}|Closed-loop`] ||
      DESNZ_LOOKUP[`waste|${wasteType}|Open-loop`] ||
      'waste_recycling_kg'
    )
  }
  if (route === 'Energy recovery') {
    return DESNZ_LOOKUP[`waste|${wasteType}|Combustion`] || 'waste_combustion_kg'
  }
  return desnzLookup(`waste|${wasteType}|${route}`, 'waste_landfill_kg')
}

export function landTravelFactorKey(mode: string, detail: string, unit: 'pkm' | 'km' = 'pkm') {
  return desnzLookup(`land|${mode}|${detail}|${unit}`, unit === 'pkm' ? 'taxi_pkm' : 'taxi_km')
}

export function ferryFactorKey(kind: string) {
  return desnzLookup(`ferry|${kind}`, 'ferry_average_all_passenger_pkm')
}

export const HOMEWORKING_OPTIONS = [
  'Homeworking (office equipment + heating)',
  'Homeworking (office equipment only)',
  'Homeworking (heating only)',
] as const

export function isHomeworkingMode(mode: string | undefined) {
  return (mode || '').startsWith('Homeworking')
}

export function homeworkingFactorKey(kind: string) {
  if (kind.includes('office equipment only') || (kind.includes('Office') && !kind.toLowerCase().includes('heating'))) {
    return desnzLookup('homeworking|Office Equipment')
  }
  if (kind === 'Heating' || kind.includes('heating only')) {
    return desnzLookup('homeworking|Heating')
  }
  return desnzLookup('homeworking|Homeworking (office equipment + heating)')
}

export const WTT_ELECTRICITY_OPTIONS = [
  'UK electricity WTT (generation)',
  'UK electricity T&D losses',
  'UK electricity WTT (T&D)',
] as const

export const WTT_LEGACY_OPTIONS = [
  'Diesel (WTT)',
  'Petrol (WTT)',
  'LPG (WTT)',
  'Gas oil (WTT)',
  'Natural gas (WTT)',
] as const

export function isElectricityWttSource(label: string | undefined) {
  return (label || '').toLowerCase().includes('electricity')
}

export function isElectricVehicleFuel(fuel: string) {
  return /electric/i.test(fuel)
}

export function buildDesnzDetailFactors(meta: { year: string; verifiedAt: string }): EmissionFactor[] {
  const existing = new Set<string>()
  return DESNZ_DETAIL_ROWS.filter((row) => {
    if (existing.has(row.key) || row.unit === 'miles') return false
    existing.add(row.key)
    return true
  }).map((row) => ({
    key: row.key,
    name: row.name,
    category: row.category,
    scope: row.scope as Scope,
    conversionValue: row.kg,
    unit: row.unit,
    sourceFamily: row.category.includes('electricity') ? 'DESNZ' : 'DEFRA',
    source: `${DEFRA} ${row.category} — ${row.name}.`,
    sourceUrl: GOV_URL,
    region: 'United Kingdom',
    validFrom: `${meta.year}-01-01`,
    lastVerifiedAt: meta.verifiedAt,
    isPlaceholder: false,
    method: row.method as FactorMethod | undefined,
    wttKey: row.wttKey,
    evKey: row.evKey,
    evTdKey: row.evTdKey,
  }))
}
