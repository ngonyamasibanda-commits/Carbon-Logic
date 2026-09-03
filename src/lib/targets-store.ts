import type { SbtiConfig } from './sbti'

const TARGET_KEY = 'carbon-logic-sbti-target'

export function defaultSbtiConfig(): SbtiConfig {
  const submissionYear = new Date().getFullYear()
  const lastFullYear = submissionYear - 1
  return {
    baseYear: lastFullYear,
    targetYear: submissionYear + 9,
    submissionYear,
    netZeroYear: 2050,
    useLiveInventory: true,
    baseScope1: 0,
    baseScope2: 0,
    baseScope3: 0,
    mostRecentYear: lastFullYear,
    recentScope1: 0,
    recentScope2: 0,
    recentScope3: 0,
    scope3Ambition: 'WB2C',
    scope12Coverage: 100,
    scope3Coverage: 67,
    scope2Approach: 'location-based',
    renewableElectricityTarget: false,
    renewableShareBaseYear: 0,
    sellsFossilFuels: false,
  }
}

export function loadSbtiConfig(organizationId?: string | null): SbtiConfig {
  try {
    const key = organizationId ? `${TARGET_KEY}:${organizationId}` : TARGET_KEY
    const raw = localStorage.getItem(key) ?? (organizationId ? localStorage.getItem(TARGET_KEY) : null)
    if (!raw) return defaultSbtiConfig()
    return { ...defaultSbtiConfig(), ...(JSON.parse(raw) as Partial<SbtiConfig>) }
  } catch {
    return defaultSbtiConfig()
  }
}

export function saveSbtiConfig(config: SbtiConfig, organizationId?: string | null) {
  const key = organizationId ? `${TARGET_KEY}:${organizationId}` : TARGET_KEY
  localStorage.setItem(key, JSON.stringify(config))
}
