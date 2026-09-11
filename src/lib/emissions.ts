import type { CategoryConfig, EmissionFactor, FactorMethod } from './types'
import { formatNumber, formatTco2e } from './format'

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
      value: formatNumber(factor.conversionValue),
    },
    {
      label: 'kg CO₂e',
      value: `${formatNumber(activityInFactorUnit)} × ${formatNumber(factor.conversionValue)} = ${formatNumber(kg)}`,
    },
    {
      label: 'Convert kg to tonnes (÷ 1,000)',
      value: formatTco2e(tco2e, true),
    },
  ]
  const formula =
    method === 'gwp'
      ? `tCO₂e = mass × GWP ÷ 1,000 = ${formatNumber(activityInFactorUnit)} ${factor.unit} × ${formatNumber(factor.conversionValue)} ÷ 1,000 = ${formatTco2e(tco2e, true)}`
      : `tCO₂e = activity × (kg CO₂e / ${factor.unit}) ÷ 1,000 = ${formatNumber(activityInFactorUnit)} × ${formatNumber(factor.conversionValue)} ÷ 1,000 = ${formatTco2e(tco2e, true)}`
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
      steps.push({
        label: 'Tonne-kilometres (cargo tonnes × km)',
        value: `${formatNumber(tonnes)} t × ${formatNumber(km)} km = ${formatNumber(derived)} tkm`,
      })
    } else if (category.id === 'employee_commuting') {
      const dist = fieldAmount(values, 'distance')
      const people = num(values, 'employees')
      const days = num(values, 'days')
      steps.push({
        label: 'Return commuting (one-way × people × days × 2)',
        value: `${formatNumber(dist)} km × ${formatNumber(people)} × ${formatNumber(days)} × 2 = ${formatNumber(derived)} ${factor.unit}`,
      })
    } else if (category.id === 'crew_transport') {
      const dist = fieldAmount(values, 'distance')
      const trips = num(values, 'trips')
      const passengers = num(values, 'passengers') || 1
      if (factor.unit === 'pkm') {
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

  if (unitFactor !== 1 && Number.isFinite(primaryRaw)) {
    steps.push({
      label: `Convert to ${factor.unit}`,
      value: `${formatNumber(primaryRaw)} × ${formatNumber(unitFactor)} = ${formatNumber(primary)} ${factor.unit}`,
    })
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
