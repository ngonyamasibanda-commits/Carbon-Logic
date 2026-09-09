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
    baseScope1: null,
    baseScope2: null,
    baseScope3: null,
    mostRecentYear: lastFullYear,
    recentScope1: null,
    recentScope2: null,
    recentScope3: null,
    scope3Ambition: 'WB2C',
    scope12Coverage: 100,
    scope3Coverage: 67,
    scope2Approach: 'location-based',
    renewableElectricityTarget: false,
    renewableShareBaseYear: 0,
    sellsFossilFuels: false,
  }
}

function blankZero(value: number | null | undefined): number | null {
  if (value == null || value === 0) return null
  return value
}

export function loadSbtiConfig(organizationId?: string | null): SbtiConfig {
  try {
    const key = organizationId ? `${TARGET_KEY}:${organizationId}` : TARGET_KEY
    const raw = localStorage.getItem(key) ?? (organizationId ? localStorage.getItem(TARGET_KEY) : null)
    if (!raw) return defaultSbtiConfig()
    const parsed = { ...defaultSbtiConfig(), ...(JSON.parse(raw) as Partial<SbtiConfig>) }
    if (parsed.useLiveInventory) return parsed
    return {
      ...parsed,
      baseScope1: blankZero(parsed.baseScope1),
      baseScope2: blankZero(parsed.baseScope2),
      baseScope3: blankZero(parsed.baseScope3),
      recentScope1: blankZero(parsed.recentScope1),
      recentScope2: blankZero(parsed.recentScope2),
      recentScope3: blankZero(parsed.recentScope3),
    }
  } catch {
    return defaultSbtiConfig()
  }
}

export function saveSbtiConfig(config: SbtiConfig, organizationId?: string | null) {
  const key = organizationId ? `${TARGET_KEY}:${organizationId}` : TARGET_KEY
  localStorage.setItem(key, JSON.stringify(config))
}
