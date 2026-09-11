import type { EmissionFactor } from './types'
import {
  EPA_EGRID_SUBREGIONS,
  EPA_FREIGHT_ROWS,
  EPA_GWP_GASES,
  EPA_MOBILE_CO2_FUELS,
  EPA_STATIONARY_FUELS,
  EPA_TRAVEL_ROWS,
  EPA_WASTE_ROWS,
  type EpaEgridRow,
} from './epa-hub-data'

export { EPA_EGRID_SUBREGIONS, EPA_FREIGHT_ROWS, EPA_TRAVEL_ROWS, EPA_WASTE_ROWS }

export const EPA_HUB_2026_URL = 'https://doi.org/10.5281/zenodo.20403776'
export const EPA_HUB_2026 =
  'EPA Emission Factors Hub, last modified 26 May 2026 (eGRID2024 electricity; IPCC AR6 GWPs). Do not use these US rows in place of DESNZ 2026 UK activity factors.'

const LB_TO_KG = 0.45359237
const GWP_CH4_AR6 = 27
const GWP_N2O_AR6 = 273
const MMBTU_KWH = 293.07107

/** Table 6 US Average total-output lb/MWh → kg CO₂e/kWh using Table 11 AR6 GWPs. */
export function lbPerMwhToKgPerKwh(lbCo2: number, lbCh4: number, lbN2o: number) {
  return (lbCo2 * LB_TO_KG + lbCh4 * LB_TO_KG * GWP_CH4_AR6 + lbN2o * LB_TO_KG * GWP_N2O_AR6) / 1000
}

export function egridKgPerKwh(row: EpaEgridRow) {
  return lbPerMwhToKgPerKwh(row.lbCo2, row.lbCh4, row.lbN2o)
}

export function egridTdKgPerKwh(row: EpaEgridRow) {
  const generated = egridKgPerKwh(row)
  return (generated * row.ggl) / (1 - row.ggl)
}

export function egridFactorKey(acronym: string) {
  return acronym === 'US' ? 'electricity_us_egrid_kwh' : `electricity_us_egrid_${acronym.toLowerCase()}_kwh`
}

export function egridTdFactorKey(acronym: string) {
  return acronym === 'US' ? 'electricity_us_td_kwh' : `electricity_us_td_${acronym.toLowerCase()}_kwh`
}

const US_AVG = EPA_EGRID_SUBREGIONS.find((row) => row.acronym === 'US')!

export const EPA_US_EGRID_AVG_KG_PER_KWH = egridKgPerKwh(US_AVG)
export const EPA_US_TD_KG_PER_KWH = egridTdKgPerKwh(US_AVG)
export const EPA_STEAM_KG_PER_KWH =
  (66.33 + (1.25 / 1000) * GWP_CH4_AR6 + (0.125 / 1000) * GWP_N2O_AR6) / MMBTU_KWH

const SKIP_REFRIGERANT_GWP = new Set([
  'Carbon dioxide',
  'Methane (non-fossil)',
  'Fossil methane',
  'Nitrous oxide',
])

export const EPA_REFRIGERANT_GASES = EPA_GWP_GASES.filter((row) => !SKIP_REFRIGERANT_GWP.has(row.name))

export const EPA_EGRID_OPTIONS = EPA_EGRID_SUBREGIONS.map((row) =>
  row.acronym === 'US' ? 'US Average' : `${row.acronym} — ${row.name}`,
)

export function parseEgridOption(label: string) {
  if (!label || label === 'US Average' || label.includes('average')) return 'US'
  const acronym = label.split('—')[0].trim()
  return EPA_EGRID_SUBREGIONS.some((row) => row.acronym === acronym) ? acronym : 'US'
}

const MOBILE_FUEL_NAMES = new Set(EPA_MOBILE_CO2_FUELS.map((row) => row.name))

export function epaStationaryFuelLabel(name: string) {
  return MOBILE_FUEL_NAMES.has(name) ? `${name} (stationary)` : name
}

export function parseEpaFuelName(label: string) {
  return label.replace(/ \(stationary\)$/, '')
}

export const EPA_STATIONARY_FUEL_GROUPS = ['Solid', 'Gaseous', 'Liquid']
  .map((label) => ({
    label: `Stationary combustion — ${label} (Table 1, AR6 CO₂e)`,
    options: EPA_STATIONARY_FUELS.filter((row) => row.group === label).map((row) =>
      epaStationaryFuelLabel(row.name),
    ),
  }))
  .filter((group) => group.options.length > 0)

export const EPA_MOBILE_FUEL_OPTIONS = EPA_MOBILE_CO2_FUELS.map((row) => row.name)

export const EPA_FUEL_GROUPS = [
  { label: 'Mobile combustion CO₂ (Table 2)', options: EPA_MOBILE_FUEL_OPTIONS },
  ...EPA_STATIONARY_FUEL_GROUPS,
]

export function epaFuelFactorKey(name: string) {
  const stationary = name.includes('(stationary)')
  const cleaned = parseEpaFuelName(name)
  if (!stationary) {
    const mobile = EPA_MOBILE_CO2_FUELS.find((row) => row.name === cleaned)
    if (mobile) return mobile.key
  }
  return EPA_STATIONARY_FUELS.find((row) => row.name === cleaned)?.key ?? 'diesel_us_gallon'
}

export function epaFuelUnit(name: string) {
  const key = epaFuelFactorKey(name)
  const row =
    EPA_MOBILE_CO2_FUELS.find((item) => item.key === key) ??
    EPA_STATIONARY_FUELS.find((item) => item.key === key)
  return row?.unit || 'gal (US)'
}

export function epaTravelUnit(name: string) {
  return EPA_TRAVEL_ROWS.find((row) => row.name === name)?.unit ?? 'vehicle-mile'
}

export function epaFreightUnit(name: string) {
  return EPA_FREIGHT_ROWS.find((row) => row.name === name)?.unit ?? 'short ton-mile'
}

export const EPA_REFRIGERANT_GROUPS = [
  {
    label: 'Common (keep UK labels)',
    options: ['R-134A', 'R-410A', 'R-404A'],
  },
  {
    label: 'EPA Hub 2026 AR6 — HFCs, PFCs, SF₆, NF₃',
    options: EPA_REFRIGERANT_GASES.filter((row) => row.kind === 'pure').map((row) => row.name),
  },
  {
    label: 'EPA Hub 2026 AR6 — blended refrigerants',
    options: EPA_REFRIGERANT_GASES.filter((row) => row.kind === 'blend').map((row) => row.name),
  },
]

export function epaRefrigerantFactorKey(label: string) {
  if (label === 'R-134A' || label === 'HFC-134a') return 'r134a_epa_kg'
  if (label === 'R-410A') return 'r410a_epa_kg'
  if (label === 'R-404A') return 'r404a_epa_kg'
  return EPA_REFRIGERANT_GASES.find((row) => row.name === label)?.key ?? 'r134a_epa_kg'
}

export const EPA_FREIGHT_OPTIONS = EPA_FREIGHT_ROWS.map((row) => row.name)
export const EPA_TRAVEL_OPTIONS = EPA_TRAVEL_ROWS.map((row) => row.name)
export const EPA_WASTE_MATERIALS = [...new Set(EPA_WASTE_ROWS.map((row) => row.material))]

export function epaWasteRoutesFor(material: string) {
  return EPA_WASTE_ROWS.filter((row) => row.material === material).map((row) => row.route)
}

export function epaWasteFactorKey(material: string, route: string) {
  return (
    EPA_WASTE_ROWS.find((row) => row.material === material && row.route === route)?.key ??
    'epa_waste_mixed_msw_landfilled'
  )
}

export function epaFreightFactorKey(name: string) {
  return EPA_FREIGHT_ROWS.find((row) => row.name === name)?.key ?? EPA_FREIGHT_ROWS[0].key
}

export function epaTravelFactorKey(name: string) {
  return EPA_TRAVEL_ROWS.find((row) => row.name === name)?.key ?? EPA_TRAVEL_ROWS[0].key
}

export function buildEpaFactors(meta: { year: string; verifiedAt: string }): EmissionFactor[] {
  const common = {
    validFrom: `${meta.year}-01-01`,
    lastVerifiedAt: meta.verifiedAt,
    isPlaceholder: false as const,
    sourceUrl: EPA_HUB_2026_URL,
    region: 'United States',
  }

  const electricity: EmissionFactor[] = EPA_EGRID_SUBREGIONS.flatMap((row) => {
    const kg = egridKgPerKwh(row)
    const td = egridTdKgPerKwh(row)
    const genKey = egridFactorKey(row.acronym)
    const tdKey = egridTdFactorKey(row.acronym)
    const label = row.acronym === 'US' ? 'US eGRID 2024 average' : `US eGRID 2024 ${row.acronym} (${row.name})`
    return [
      {
        key: genKey,
        name: `${label} electricity (generated)`,
        category: 'Site energy',
        scope: 'Scope 2' as const,
        conversionValue: kg,
        unit: 'kWh',
        sourceFamily: 'EPA' as const,
        source: `${EPA_HUB_2026} Table 6 ${row.name} total output ${row.lbCo2} lb CO₂, ${row.lbCh4} lb CH₄, ${row.lbN2o} lb N₂O per MWh, converted with AR6 GWP CH₄ 27 / N₂O 273. T&D is ${tdKey} (grid gross loss ${(row.ggl * 100).toFixed(1)}%, not part of Scope 2).`,
        ...common,
        tdKey,
      },
      {
        key: tdKey,
        name: `${label} electricity T&D losses`,
        category: 'Site energy',
        scope: 'Scope 3' as const,
        conversionValue: td,
        unit: 'kWh',
        sourceFamily: 'EPA' as const,
        source: `${EPA_HUB_2026} Table 6 Grid Gross Loss ${(row.ggl * 100).toFixed(1)}% for ${row.name}. EPA: apply to Scope 3 Category 3 Activity C, not to Scope 2.`,
        ...common,
      },
    ]
  })

  const steam: EmissionFactor = {
    key: 'heat_steam_us_kwh',
    name: 'US purchased steam and heat (natural gas, 80% efficiency)',
    category: 'Heat and steam',
    scope: 'Scope 2',
    conversionValue: EPA_STEAM_KG_PER_KWH,
    unit: 'kWh',
    sourceFamily: 'EPA',
    source: `${EPA_HUB_2026} Table 7 Steam and Heat 66.33 kg CO₂ / mmBtu, 1.250 g CH₄, 0.125 g N₂O, converted with AR6 GWPs and 293.07107 kWh/mmBtu. Does not replace the DESNZ UK heat row.`,
    ...common,
  }

  const fuels: EmissionFactor[] = [...EPA_MOBILE_CO2_FUELS, ...EPA_STATIONARY_FUELS].map((row) => ({
    key: row.key,
    name: `US ${row.name} (${row.table === '2' ? 'mobile CO₂' : 'stationary CO₂e'})`,
    category: 'Site fuel',
    scope: 'Scope 1' as const,
    conversionValue: row.kg,
    unit: row.unit,
    sourceFamily: 'EPA' as const,
    source:
      row.table === '2'
        ? `${EPA_HUB_2026} Table 2 Mobile Combustion CO₂ — ${row.name} ${row.kg} kg CO₂ per ${row.unit}. Combustion CO₂ only. Not the DESNZ UK litre row.`
        : `${EPA_HUB_2026} Table 1 Stationary Combustion — ${row.name}, kg CO₂e per ${row.unit} using published CO₂ + CH₄ + N₂O converted with AR6 GWP 27 / 273.`,
    ...common,
  }))

  const refrigerants: EmissionFactor[] = EPA_REFRIGERANT_GASES.map((row) => ({
    key: row.key,
    name: `${row.name} (EPA AR6 GWP)`,
    category: 'Refrigerants',
    scope: 'Scope 1' as const,
    conversionValue: row.gwp,
    unit: 'kg',
    sourceFamily: 'EPA' as const,
    method: 'gwp' as const,
    source: `${EPA_HUB_2026} Table ${row.kind === 'blend' ? '12' : '11'} IPCC AR6 100-year GWP for ${row.name} = ${row.gwp}. Does not replace the DESNZ AR5 row for the same gas.`,
    ...common,
  }))

  const methane: EmissionFactor[] = [
    {
      key: 'mine_ch4_epa_fossil_kg',
      name: 'Fossil methane (EPA AR6 GWP, kg CH₄)',
      category: 'Mine gas',
      scope: 'Scope 1',
      conversionValue: 29.8,
      unit: 'kg',
      sourceFamily: 'EPA',
      method: 'gwp',
      source: `${EPA_HUB_2026} Table 11 fossil methane GWP = 29.8, for oil & gas and coal-mine fugitive CH₄. Default UK inventory rows stay on IPCC AR5 GWP 28 to match DESNZ 2026 refrigerants.`,
      ...common,
    },
    {
      key: 'mine_ch4_epa_fossil_t',
      name: 'Fossil methane (EPA AR6 GWP, tonnes CH₄)',
      category: 'Mine gas',
      scope: 'Scope 1',
      conversionValue: 29800,
      unit: 't',
      sourceFamily: 'EPA',
      method: 'gwp',
      source: `${EPA_HUB_2026} Table 11 fossil methane GWP 29.8. 1 t CH₄ × 29.8 = 29.8 tCO₂e, stored as 29,800 kg CO₂e per tonne so the DESNZ kg→tonne step still applies.`,
      ...common,
    },
  ]

  const freight: EmissionFactor[] = EPA_FREIGHT_ROWS.map((row) => ({
    key: row.key,
    name: `US ${row.name}`,
    category: 'Road freight',
    scope: 'Scope 3' as const,
    conversionValue: row.kg,
    unit: row.unit,
    sourceFamily: 'EPA' as const,
    source: `${EPA_HUB_2026} Table 8 ${row.name}. kg CO₂e per ${row.unit} from published CO₂ + CH₄ + N₂O with AR6 GWPs. Combustion only; not a DESNZ tkm row.`,
    ...common,
  }))

  const travel: EmissionFactor[] = EPA_TRAVEL_ROWS.map((row) => ({
    key: row.key,
    name: `US ${row.name}`,
    category: 'Business travel',
    scope: 'Scope 3' as const,
    conversionValue: row.kg,
    unit: row.unit,
    sourceFamily: 'EPA' as const,
    source: `${EPA_HUB_2026} Table 10 ${row.name}. kg CO₂e per ${row.unit} from published CO₂ + CH₄ + N₂O with AR6 GWPs. Combustion only; not a DESNZ pkm/km row.`,
    ...common,
  }))

  const waste: EmissionFactor[] = EPA_WASTE_ROWS.map((row) => ({
    key: row.key,
    name: `US ${row.material} — ${row.route}`,
    category: 'Waste',
    scope: 'Scope 3' as const,
    conversionValue: row.kgPerShortTon,
    unit: 'short ton',
    sourceFamily: 'EPA' as const,
    source: `${EPA_HUB_2026} Table 9 ${row.material} ${row.route}. Metric tons CO₂e per short ton × 1,000 = kg CO₂e per short ton (${row.kgPerShortTon}). WARM factors without avoided emissions. AR4 GWPs as published in the Hub. Not a DESNZ kg/t row.`,
    ...common,
  }))

  return [...electricity, steam, ...fuels, ...refrigerants, ...methane, ...freight, ...travel, ...waste]
}
