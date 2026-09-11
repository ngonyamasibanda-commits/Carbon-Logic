import type { EmissionFactor } from './types'

export const EPA_HUB_2026_URL = 'https://doi.org/10.5281/zenodo.20403776'
export const EPA_HUB_2026 =
  'EPA Emission Factors Hub, last modified 26 May 2026 (eGRID2024 electricity; IPCC AR6 GWPs). Do not use these US rows in place of DESNZ 2026 UK activity factors.'

const LB_TO_KG = 0.45359237
const GWP_CH4_AR6 = 27
const GWP_N2O_AR6 = 273
const GRID_GROSS_LOSS = 0.044

/** Table 6 US Average total-output lb/MWh → kg CO₂e/kWh using Table 11 AR6 GWPs. */
export function lbPerMwhToKgPerKwh(lbCo2: number, lbCh4: number, lbN2o: number) {
  return (lbCo2 * LB_TO_KG + lbCh4 * LB_TO_KG * GWP_CH4_AR6 + lbN2o * LB_TO_KG * GWP_N2O_AR6) / 1000
}

export const EPA_US_EGRID_AVG_KG_PER_KWH = lbPerMwhToKgPerKwh(747.9, 0.054, 0.007)
export const EPA_US_TD_KG_PER_KWH = (EPA_US_EGRID_AVG_KG_PER_KWH * GRID_GROSS_LOSS) / (1 - GRID_GROSS_LOSS)

const MMBTU_KWH = 293.07107
export const EPA_STEAM_KG_PER_KWH =
  (66.33 + (1.25 / 1000) * GWP_CH4_AR6 + (0.125 / 1000) * GWP_N2O_AR6) / MMBTU_KWH

export function buildEpaFactors(meta: { year: string; verifiedAt: string }): EmissionFactor[] {
  const common = {
    validFrom: `${meta.year}-01-01`,
    lastVerifiedAt: meta.verifiedAt,
    isPlaceholder: false as const,
    sourceUrl: EPA_HUB_2026_URL,
    region: 'United States',
  }
  return [
    {
      key: 'electricity_us_egrid_kwh',
      name: 'US eGRID 2024 average electricity (generated)',
      category: 'Site energy',
      scope: 'Scope 2',
      conversionValue: EPA_US_EGRID_AVG_KG_PER_KWH,
      unit: 'kWh',
      sourceFamily: 'EPA',
      source: `${EPA_HUB_2026} Table 6 US Average total output 747.9 lb CO₂, 0.054 lb CH₄, 0.007 lb N₂O per MWh, converted with AR6 GWP CH₄ 27 / N₂O 273 and 0.45359237 kg/lb. tCO₂e = kWh × ${EPA_US_EGRID_AVG_KG_PER_KWH} ÷ 1,000. Location-based only — T&D is electricity_us_td_kwh (grid gross loss 4.4%, not part of Scope 2).`,
      ...common,
      tdKey: 'electricity_us_td_kwh',
    },
    {
      key: 'electricity_us_td_kwh',
      name: 'US electricity T&D losses (eGRID 4.4%)',
      category: 'Site energy',
      scope: 'Scope 3',
      conversionValue: EPA_US_TD_KG_PER_KWH,
      unit: 'kWh',
      sourceFamily: 'EPA',
      source: `${EPA_HUB_2026} Table 6 Grid Gross Loss 4.4%. EPA: apply to Scope 3 Category 3 Activity C, not to Scope 2. kg/kWh = generation factor × 0.044 ÷ 0.956.`,
      ...common,
    },
    {
      key: 'heat_steam_us_kwh',
      name: 'US purchased steam and heat (natural gas, 80% efficiency)',
      category: 'Heat and steam',
      scope: 'Scope 2',
      conversionValue: EPA_STEAM_KG_PER_KWH,
      unit: 'kWh',
      sourceFamily: 'EPA',
      source: `${EPA_HUB_2026} Table 7 Steam and Heat 66.33 kg CO₂ / mmBtu, 1.250 g CH₄, 0.125 g N₂O, converted with AR6 GWPs and 293.07107 kWh/mmBtu. Does not replace the DESNZ UK heat row.`,
      ...common,
    },
    {
      key: 'diesel_us_gallon',
      name: 'US diesel (mobile combustion, CO₂ only)',
      category: 'Site fuel',
      scope: 'Scope 1',
      conversionValue: 10.21,
      unit: 'gal (US)',
      sourceFamily: 'EPA',
      source: `${EPA_HUB_2026} Table 2 Mobile Combustion CO₂ — Diesel Fuel 10.21 kg CO₂ per US gallon. Combustion CO₂ only; CH₄/N₂O are separate per-mile or per-gallon tables. Not the DESNZ UK litre row.`,
      ...common,
    },
    {
      key: 'petrol_us_gallon',
      name: 'US motor gasoline (mobile combustion, CO₂ only)',
      category: 'Site fuel',
      scope: 'Scope 1',
      conversionValue: 8.78,
      unit: 'gal (US)',
      sourceFamily: 'EPA',
      source: `${EPA_HUB_2026} Table 2 Motor Gasoline 8.78 kg CO₂ per US gallon. Combustion CO₂ only. Not the DESNZ UK litre row.`,
      ...common,
    },
    {
      key: 'r404a_epa_kg',
      name: 'R-404A refrigerant (EPA AR6 GWP)',
      category: 'Refrigerants',
      scope: 'Scope 1',
      conversionValue: 4728,
      unit: 'kg',
      sourceFamily: 'EPA',
      method: 'gwp',
      source: `${EPA_HUB_2026} Table 12 blended refrigerants, IPCC AR6 100-year GWP for R-404A = 4,728. UK DESNZ 2026 still publishes AR5 3,943 as r404a_kg.`,
      ...common,
    },
    {
      key: 'r410a_epa_kg',
      name: 'R-410A refrigerant (EPA AR6 GWP)',
      category: 'Refrigerants',
      scope: 'Scope 1',
      conversionValue: 2256,
      unit: 'kg',
      sourceFamily: 'EPA',
      method: 'gwp',
      source: `${EPA_HUB_2026} Table 12 IPCC AR6 GWP for R-410A = 2,256. UK DESNZ 2026 still publishes AR5 1,924 as r410a_kg.`,
      ...common,
    },
    {
      key: 'r134a_epa_kg',
      name: 'HFC-134a refrigerant (EPA AR6 GWP)',
      category: 'Refrigerants',
      scope: 'Scope 1',
      conversionValue: 1530,
      unit: 'kg',
      sourceFamily: 'EPA',
      method: 'gwp',
      source: `${EPA_HUB_2026} Table 11 IPCC AR6 GWP for HFC-134a = 1,530. UK DESNZ 2026 still publishes AR5 1,300 as r134a_kg.`,
      ...common,
    },
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
}
