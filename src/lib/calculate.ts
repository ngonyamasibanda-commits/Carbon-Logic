import { loadFactorLibrary } from './factors-store'
import { factorFromEpd, isEpdRequiredKey } from './epd-materials'
import { inventoryTco2e } from './emissions'
import type { EmissionFactor } from './types'

export { inventoryTco2e } from './emissions'

/**
 * DESNZ company-reporting step: tCO₂e = activity × (kg CO₂e per unit) ÷ 1,000.
 * Do not use this as the only step — freight needs tkm, flights need pkm, waste
 * is per tonne, spend is per £, refrigerants are GWP. See `workingFromForm`.
 */
export function calculateTco2e(activityAmount: number, conversionValue: number): number {
  return inventoryTco2e(activityAmount, conversionValue)
}

export async function loadFactors(organizationId?: string): Promise<Map<string, EmissionFactor>> {
  return loadFactorLibrary(organizationId)
}

export function lookupFactor(
  factors: Map<string, EmissionFactor>,
  key: string,
  customConversion?: number,
): EmissionFactor | null {
  if (key === 'custom' || (!factors.get(key) && isEpdRequiredKey(key))) {
    if (!customConversion || !Number.isFinite(customConversion) || customConversion <= 0) {
      return factors.get(key) ?? null
    }
    if (key === 'custom') {
      return {
        key: 'custom',
        name: 'Custom factor',
        category: 'Custom',
        scope: 'Custom',
        conversionValue: customConversion,
        unit: 'unit',
        sourceFamily: 'User',
        source: 'User-supplied verified factor',
        sourceUrl: '',
        region: '',
        validFrom: new Date().toISOString().slice(0, 10),
        lastVerifiedAt: new Date().toISOString().slice(0, 10),
        isPlaceholder: false,
      }
    }
    return factorFromEpd({
      key,
      conversionValue: customConversion,
      source: 'Environmental Product Declaration (entered on the activity form)',
    })
  }
  return factors.get(key) ?? null
}
