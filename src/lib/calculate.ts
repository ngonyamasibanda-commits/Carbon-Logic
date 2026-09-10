import { loadFactorLibrary } from './factors-store'
import type { EmissionFactor } from './types'

/**
 * Calculated tCO₂e = (Activity Amount × Conversion Value) / 1000
 * Conversion value is kg CO₂e per activity unit.
 */
export function calculateTco2e(activityAmount: number, conversionValue: number): number {
  return (activityAmount * conversionValue) / 1000
}

export async function loadFactors(organizationId?: string): Promise<Map<string, EmissionFactor>> {
  return loadFactorLibrary(organizationId)
}

export function lookupFactor(
  factors: Map<string, EmissionFactor>,
  key: string,
  customConversion?: number,
): EmissionFactor | null {
  if (key === 'custom') {
    if (!customConversion || !Number.isFinite(customConversion) || customConversion <= 0) {
      return null
    }
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
  return factors.get(key) ?? null
}
