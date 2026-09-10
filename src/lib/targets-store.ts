import { fetchOrgSettings, saveOrgSbtiConfig } from './org'
import { readJson, writeJson } from './browser-storage'
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

function fromStored(raw: Partial<SbtiConfig> | null | undefined): SbtiConfig {
  const parsed = { ...defaultSbtiConfig(), ...(raw ?? {}) }
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
}

export function loadSbtiConfig(organizationId?: string | null): SbtiConfig {
  const key = organizationId ? `${TARGET_KEY}:${organizationId}` : TARGET_KEY
  return fromStored(readJson<Partial<SbtiConfig> | null>(key, null))
}

export function saveSbtiConfig(config: SbtiConfig, organizationId?: string | null) {
  const key = organizationId ? `${TARGET_KEY}:${organizationId}` : TARGET_KEY
  writeJson(key, config)
  if (organizationId) {
    void saveOrgSbtiConfig(organizationId, config as unknown as Record<string, unknown>)
  }
}

export async function loadSbtiConfigCloud(organizationId: string): Promise<SbtiConfig> {
  const settings = await fetchOrgSettings(organizationId, '')
  if (settings.sbtiConfig && Object.keys(settings.sbtiConfig).length > 0) {
    const parsed = fromStored(settings.sbtiConfig as Partial<SbtiConfig>)
    writeJson(`${TARGET_KEY}:${organizationId}`, parsed)
    return parsed
  }
  return loadSbtiConfig(organizationId)
}
