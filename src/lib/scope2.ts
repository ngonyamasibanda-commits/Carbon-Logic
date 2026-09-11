import { calculateTco2e } from './calculate'
import type { CustomField, EmissionEntry } from './types'

export const SCOPE2_META_LABEL = '_scope2'

export type MarketInstrument = 'residual-mix' | 'supplier-specific' | 'rego' | 'onsite-renewable'

export type Scope2Meta = {
  locationTco2e: number
  marketTco2e: number
  instrument: MarketInstrument
  marketFactorKg: number
  kwh: number
}

export type Scope2Dual = {
  locationTco2e: number
  marketTco2e: number
  electricityKwh: number
  heatKwh: number
  marketCoveredKwh: number
  assumedLocationForMarket: boolean
  residualMixMissing: boolean
}

export function isScope2EnergyEntry(entry: Pick<EmissionEntry, 'category' | 'scope'>): boolean {
  return entry.category === 'site_electricity' || entry.category === 'heat_steam' || entry.scope === 'Scope 2'
}

export function parseScope2Meta(fields: CustomField[] | undefined): Scope2Meta | undefined {
  const raw = fields?.find((field) => field.label === SCOPE2_META_LABEL)?.value
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<Scope2Meta>
    if (
      typeof parsed.locationTco2e !== 'number' ||
      typeof parsed.marketTco2e !== 'number' ||
      typeof parsed.kwh !== 'number'
    ) {
      return undefined
    }
    return {
      locationTco2e: parsed.locationTco2e,
      marketTco2e: parsed.marketTco2e,
      instrument: parsed.instrument ?? 'residual-mix',
      marketFactorKg: parsed.marketFactorKg ?? 0,
      kwh: parsed.kwh,
    }
  } catch {
    return undefined
  }
}

export function customFieldsWithScope2(fields: CustomField[] | undefined, meta: Scope2Meta | undefined): CustomField[] {
  const rest = (fields ?? []).filter((field) => field.label !== SCOPE2_META_LABEL && !field.label.startsWith('_'))
  if (!meta) return rest
  return [...rest, { label: SCOPE2_META_LABEL, value: JSON.stringify(meta) }]
}

export function visibleCustomFields(fields: CustomField[] | undefined): CustomField[] {
  return (fields ?? []).filter((field) => field.label && !field.label.startsWith('_'))
}

export function marketFactorKg(input: {
  instrument: MarketInstrument
  residualMixKg: number
  supplierKg?: number
  locationKg: number
}): { kg: number; residualMixMissing: boolean } {
  if (input.instrument === 'onsite-renewable' || input.instrument === 'rego') {
    return { kg: 0, residualMixMissing: false }
  }
  if (input.instrument === 'supplier-specific') {
    const kg = Number(input.supplierKg)
    if (Number.isFinite(kg) && kg >= 0) return { kg, residualMixMissing: false }
    return { kg: input.locationKg, residualMixMissing: false }
  }
  if (input.residualMixKg > 0) return { kg: input.residualMixKg, residualMixMissing: false }
  return { kg: input.locationKg, residualMixMissing: true }
}

export function dualFromActivity(input: {
  kwh: number
  locationKg: number
  instrument: MarketInstrument
  residualMixKg: number
  supplierKg?: number
}): { meta: Scope2Meta; residualMixMissing: boolean } {
  const market = marketFactorKg({
    instrument: input.instrument,
    residualMixKg: input.residualMixKg,
    supplierKg: input.supplierKg,
    locationKg: input.locationKg,
  })
  return {
    residualMixMissing: market.residualMixMissing,
    meta: {
      locationTco2e: calculateTco2e(input.kwh, input.locationKg),
      marketTco2e: calculateTco2e(input.kwh, market.kg),
      instrument: input.instrument,
      marketFactorKg: market.kg,
      kwh: input.kwh,
    },
  }
}

export function instrumentFromForm(source: string, marketInstrument: string): MarketInstrument {
  if (source.toLowerCase().includes('renewable')) return 'onsite-renewable'
  const value = marketInstrument.toLowerCase()
  if (value.includes('rego') || value.includes('goo') || /\brec\b/.test(value) || value.includes('100%')) {
    return 'rego'
  }
  if (value.includes('supplier')) return 'supplier-specific'
  return 'residual-mix'
}

function electricityKwh(entry: EmissionEntry): number {
  if (entry.category !== 'site_electricity') return 0
  const meta = parseScope2Meta(entry.customFields)
  if (meta) return meta.kwh
  return Number(entry.amount) || 0
}

function heatKwh(entry: EmissionEntry): number {
  if (entry.category !== 'heat_steam') return 0
  const meta = parseScope2Meta(entry.customFields)
  if (meta) return meta.kwh
  return Number(entry.amount) || 0
}

/**
 * Dual Scope 2 totals. Location-based uses the DESNZ grid (or stored tCO₂e).
 * Market-based uses stored instruments, then residual mix × kWh, then location as a last resort.
 */
export function summarizeScope2(
  entries: EmissionEntry[],
  residualMixKg: number,
  locationElectricityKg: number,
): Scope2Dual {
  let locationTco2e = 0
  let marketTco2e = 0
  let electricityKwhTotal = 0
  let heatKwhTotal = 0
  let marketCoveredKwh = 0
  let assumedLocationForMarket = false
  let residualMixMissing = residualMixKg <= 0

  for (const entry of entries) {
    if (!isScope2EnergyEntry(entry)) continue
    const meta = parseScope2Meta(entry.customFields)
    const kwh = electricityKwh(entry) + heatKwh(entry)
    electricityKwhTotal += electricityKwh(entry)
    heatKwhTotal += heatKwh(entry)

    if (meta) {
      locationTco2e += meta.locationTco2e
      marketTco2e += meta.marketTco2e
      if (meta.instrument !== 'residual-mix' || residualMixKg > 0) {
        marketCoveredKwh += meta.kwh
      } else {
        assumedLocationForMarket = true
      }
      continue
    }

    locationTco2e += entry.emissions_tco2e
    if (entry.category === 'site_electricity' && kwh > 0 && residualMixKg > 0) {
      marketTco2e += calculateTco2e(kwh, residualMixKg)
      marketCoveredKwh += kwh
    } else if (entry.category === 'site_electricity' && kwh > 0 && locationElectricityKg > 0) {
      marketTco2e += calculateTco2e(kwh, locationElectricityKg)
      assumedLocationForMarket = true
    } else {
      marketTco2e += entry.emissions_tco2e
      if (entry.category === 'site_electricity') assumedLocationForMarket = true
    }
  }

  return {
    locationTco2e,
    marketTco2e,
    electricityKwh: electricityKwhTotal,
    heatKwh: heatKwhTotal,
    marketCoveredKwh,
    assumedLocationForMarket,
    residualMixMissing: residualMixMissing && assumedLocationForMarket,
  }
}
