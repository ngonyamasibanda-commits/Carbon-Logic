import type { CategoryConfig, EmissionFactor, FactorMethod } from './types'
import { formatFactor, formatNumber, formatWorkingTco2e } from './format'
import { CEDA_ATTRIBUTION, cedaProducerUsd2023, isCedaFactor } from './ceda'

export type CalcStep = {
  label: string
  value: string
}

export type EmissionWorking = {
  tco2e: number
  kgCo2e: number
  activityAmount: number
  activityUnit: string
  method: FactorMethod
  formula: string
  steps: CalcStep[]
  wttKey?: string
  tdKey?: string
}

const KG_PER_TONNE = 1000

/**
 * DESNZ/DEFRA company-reporting formula:
 *   tCO₂e = activity × (kg CO₂e per unit) ÷ 1,000
 * The conversion value is always kg CO₂e (or a GWP, which is kg CO₂e per kg of gas).
 * Extra steps (tkm, pkm, unit conversion, GWP) happen before this line.
 */
export function inventoryTco2e(activityInFactorUnit: number, kgCo2ePerUnit: number): number {
  return (activityInFactorUnit * kgCo2ePerUnit) / KG_PER_TONNE
}

/** @deprecated Use inventoryTco2e — same DESNZ kg→tonne step. */
export function calculateTco2e(activityAmount: number, conversionValue: number): number {
  return inventoryTco2e(activityAmount, conversionValue)
}

function num(values: Record<string, string>, key: string) {
  return Number(values[key] || 0)
}

function fieldAmount(values: Record<string, string>, key: string) {
  const raw = num(values, key)
  const factor = num(values, `${key}_unit_factor`) || 1
  return raw * factor
}

export function methodOf(factor: EmissionFactor): FactorMethod {
  if (factor.method) return factor.method
  if (factor.sourceFamily === 'IPCC') return 'gwp'
  if (/refrigerant|methane|gwp/i.test(`${factor.name} ${factor.source}`)) return 'gwp'
  if (isCedaFactor(factor) || factor.spendCurrency === 'USD') return 'spend'
  return 'kg_per_unit'
}

export function computeWorking(factor: EmissionFactor, activityInFactorUnit: number, extraSteps: CalcStep[] = []): EmissionWorking {
  const method = methodOf(factor)
  const kg = activityInFactorUnit * factor.conversionValue
  const tco2e = kg / KG_PER_TONNE
  const steps: CalcStep[] = [
    ...extraSteps,
    {
      label: 'Activity in the factor unit',
      value: `${formatNumber(activityInFactorUnit)} ${factor.unit}`,
    },
    {
      label:
        method === 'gwp'
          ? `GWP (kg CO₂e per kg of gas)`
          : `Published factor (kg CO₂e / ${factor.unit})`,
      value: formatFactor(factor.conversionValue),
    },
    {
      label: 'kg CO₂e',
      value: `${formatFactor(activityInFactorUnit)} × ${formatFactor(factor.conversionValue)} = ${formatFactor(kg)}`,
    },
    {
      label: 'Convert kg to tonnes (÷ 1,000)',
      value: formatWorkingTco2e(tco2e),
    },
  ]
  const formula =
    method === 'gwp'
      ? `tCO₂e = mass × GWP ÷ 1,000 = ${formatFactor(activityInFactorUnit)} ${factor.unit} × ${formatFactor(factor.conversionValue)} ÷ 1,000 = ${formatWorkingTco2e(tco2e)}`
      : method === 'spend'
        ? `tCO₂e = 2023 producer-price USD × (kg CO₂e / $) ÷ 1,000 = ${formatFactor(activityInFactorUnit)} × ${formatFactor(factor.conversionValue)} ÷ 1,000 = ${formatWorkingTco2e(tco2e)}`
        : `tCO₂e = activity × (kg CO₂e / ${factor.unit}) ÷ 1,000 = ${formatFactor(activityInFactorUnit)} × ${formatFactor(factor.conversionValue)} ÷ 1,000 = ${formatWorkingTco2e(tco2e)}`
  return {
    tco2e,
    kgCo2e: kg,
    activityAmount: activityInFactorUnit,
    activityUnit: factor.unit,
    method,
    formula,
    steps,
    wttKey: factor.wttKey,
    tdKey: factor.tdKey,
  }
}

/**
 * Build the activity quantity in the factor's published unit, with the extra
 * conversion steps that category needs (tkm, pkm, return trips, spend in £).
 */
export function activityForCategory(
  category: CategoryConfig,
  values: Record<string, string>,
  factor: EmissionFactor,
): { quantity: number; steps: CalcStep[]; error?: string } {
  const unitFactor = num(values, 'unit_factor') || 1
  const primaryRaw = num(values, category.amountField)
  const primary = primaryRaw * unitFactor
  const steps: CalcStep[] = []

  if (category.resolveActivityAmount) {
    const derived = category.resolveActivityAmount(values, primary)
    if (category.id === 'road_freight' || category.id === 'rail_freight' || category.id === 'sea_freight' || category.id === 'air_freight' || category.id === 'subcontractor') {
      const tonnes = fieldAmount(values, 'weight')
      const km = fieldAmount(values, 'distance')
      const vehicleKm =
        factor.unit === 'km' ||
        factor.unit === 'vehicle-mile' ||
        (values.metric || '').toLowerCase().includes('vehicle')
      if (factor.unit === 'short ton-mile') {
        steps.push({
          label: 'Short ton-miles (EPA Hub Table 8)',
          value: `${formatNumber(derived)} short ton-mile`,
        })
      } else if (factor.unit === 'vehicle-mile') {
        steps.push({
          label: 'Vehicle-miles (EPA Hub Table 8)',
          value: `${formatNumber(derived)} vehicle-mile`,
        })
      } else if (vehicleKm) {
        steps.push({
          label: 'Vehicle-kilometres',
          value: `${formatNumber(km)} km`,
        })
      } else {
        steps.push({
          label: 'Tonne-kilometres (cargo tonnes × km)',
          value: `${formatNumber(tonnes)} t × ${formatNumber(km)} km = ${formatNumber(derived)} tkm`,
        })
      }
    } else if (category.id === 'employee_commuting') {
      const people = num(values, 'employees')
      const days = num(values, 'days')
      if ((values.mode || '').startsWith('Homeworking')) {
        const hours = num(values, 'hours')
        steps.push({
          label: 'Homeworking hours (people × days × hours per day)',
          value: `${formatNumber(people)} × ${formatNumber(days)} × ${formatNumber(hours)} = ${formatNumber(derived)} h`,
        })
      } else {
        const dist = fieldAmount(values, 'distance')
        steps.push({
          label: 'Return commuting (one-way × people × days × 2)',
          value: `${formatNumber(dist)} km × ${formatNumber(people)} × ${formatNumber(days)} × 2 = ${formatNumber(derived)} ${factor.unit}`,
        })
      }
    } else if (category.id === 'crew_transport') {
      const dist = fieldAmount(values, 'distance')
      const trips = num(values, 'trips')
      const passengers = num(values, 'passengers') || 1
      if (factor.unit === 'passenger-mile' || factor.unit === 'vehicle-mile') {
        steps.push({
          label: `EPA Hub Table 10 (${factor.unit})`,
          value: `${formatNumber(derived)} ${factor.unit}`,
        })
      } else if (factor.unit === 'pkm') {
        steps.push({
          label: 'Passenger-km (one-way × return trips × 2 × passengers)',
          value: `${formatNumber(dist)} km × ${formatNumber(trips)} × 2 × ${formatNumber(passengers)} = ${formatNumber(derived)} pkm`,
        })
      } else {
        steps.push({
          label: 'Vehicle-km (one-way × return trips × 2)',
          value: `${formatNumber(dist)} km × ${formatNumber(trips)} × 2 = ${formatNumber(derived)} km`,
        })
      }
    } else if (category.id === 'business_travel') {
      if (factor.unit === 'pkm') {
        const passengers = num(values, 'passengers') || 1
        const km = fieldAmount(values, 'distance') || primary
        steps.push({
          label: 'Passenger-km (passengers × km)',
          value: `${formatNumber(passengers)} × ${formatNumber(km)} km = ${formatNumber(derived)} pkm`,
        })
      } else if (factor.unit === 'passenger-mile' || factor.unit === 'vehicle-mile') {
        steps.push({
          label: `EPA Hub Table 10 (${factor.unit})`,
          value: `${formatNumber(derived)} ${factor.unit}`,
        })
      }
    }
    if (!Number.isFinite(derived) || derived <= 0) {
      return { quantity: derived, steps, error: 'Enter a valid activity amount greater than zero.' }
    }
    return { quantity: derived, steps }
  }

  if (!Number.isFinite(primary) || primary <= 0) {
    return { quantity: primary, steps, error: 'Enter a valid activity amount greater than zero.' }
  }

  if (methodOf(factor) === 'spend' || isCedaFactor(factor)) {
    const currency = values.spend_currency === 'USD' ? 'USD' : 'GBP'
    const converted = cedaProducerUsd2023({
      spend: primary,
      currency,
      fxGbpPerUsd: factor.fxGbpPerUsd,
      priceIndex2025: factor.priceIndex,
      purchaserProducer: factor.purchaserProducer,
    })
    steps.push(...converted.steps)
    steps.push({
      label: `Attribution`,
      value: CEDA_ATTRIBUTION,
    })
    if (!Number.isFinite(converted.producerUsd2023) || converted.producerUsd2023 <= 0) {
      return { quantity: converted.producerUsd2023, steps, error: 'Enter a valid activity amount greater than zero.' }
    }
    return { quantity: converted.producerUsd2023, steps }
  }

  if (unitFactor !== 1 && Number.isFinite(primaryRaw)) {
    steps.push({
      label: `Convert to ${factor.unit}`,
      value: `${formatNumber(primaryRaw)} × ${formatNumber(unitFactor)} = ${formatNumber(primary)} ${factor.unit}`,
    })
  }

  if (category.id === 'water') {
    const reused = num(values, 'reused') * unitFactor
    const replenished = num(values, 'replenished') * unitFactor
    const sustainable = num(values, 'sustainable') * unitFactor
    const returned = reused + replenished + sustainable
    if (returned > 0 && primary > 0) {
      const pct = (returned / primary) * 100
      steps.push({
        label: 'Water-positive volume (not converted to tCO₂e)',
        value: `(reused ${formatNumber(reused)} + replenished ${formatNumber(replenished)} + sustainable ${formatNumber(sustainable)}) ÷ withdrawal ${formatNumber(primary)} m³ = ${formatFactor(pct)}%`,
      })
    }
  }

  if (category.id === 'site_electricity') {
    const instrument = (values.market_instrument || '').toLowerCase()
    if (instrument.includes('rego') || instrument.includes('goo') || instrument.includes('rec') || instrument.includes('100%')) {
      steps.push({
        label: 'Market-based renewable matching',
        value: 'Retired REGO / GoO / REC covers this kWh, so market-based Scope 2 is 0. Location-based still uses the grid generation factor.',
      })
    } else if (instrument.includes('supplier')) {
      steps.push({
        label: 'Market-based hierarchy',
        value: 'Supplier-specific kg CO₂e/kWh from the bill or PPA is used for market-based Scope 2. Location-based stays on the grid factor.',
      })
    } else if ((values.source || '').toLowerCase().includes('purchased')) {
      steps.push({
        label: 'Market-based hierarchy',
        value: 'No contractual instrument: residual mix if set, otherwise location-based. Grid T&D stays a separate Scope 3 line.',
      })
    }
  }

  return { quantity: primary, steps }
}

export function workingFromForm(
  category: CategoryConfig,
  values: Record<string, string>,
  factor: EmissionFactor,
): EmissionWorking & { error?: string } {
  const activity = activityForCategory(category, values, factor)
  if (activity.error) {
    return {
      tco2e: 0,
      kgCo2e: 0,
      activityAmount: 0,
      activityUnit: factor.unit,
      method: methodOf(factor),
      formula: '',
      steps: activity.steps,
      error: activity.error,
    }
  }
  return computeWorking(factor, activity.quantity, activity.steps)
}

export function chainWorking(
  kwhOrLitres: number,
  extra: EmissionFactor,
  extraSteps: CalcStep[],
): EmissionWorking {
  return computeWorking(extra, kwhOrLitres, extraSteps)
}
