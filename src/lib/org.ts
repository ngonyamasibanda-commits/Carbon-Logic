import { readJson, writeJson } from './browser-storage'
import { supabase } from './supabase'

export type Site = {
  id: string
  name: string
  type: 'office' | 'depot' | 'construction_site' | 'warehouse' | 'mine' | 'processing_plant'
  region: string
}

export type OrgProfile = {
  displayName: string
  organisation: string
  country: string
  intensityMetric: string
  baselineYtdTco2e: number
  annualRevenue: number
  employeeCount: number
  reportingYear: number
  lockedYears: number[]
  residualMixKgPerKwh: number
}

const SITES_KEY = 'carbon-logic-sites'
const PROFILE_KEY = 'carbon-logic-profile'

export function emptyOrgProfile(organisation = ''): OrgProfile {
  return {
    displayName: organisation,
    organisation,
    country: 'United Kingdom',
    intensityMetric: 'tCO2e per £m turnover',
    baselineYtdTco2e: 0,
    annualRevenue: 0,
    employeeCount: 0,
    reportingYear: new Date().getFullYear(),
    lockedYears: [],
    residualMixKgPerKwh: 0,
  }
}

function asYearList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((year) => Number(year)).filter((year) => Number.isFinite(year))
}

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  const code = error.code ?? ''
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (message.includes('column') && (message.includes('does not exist') || message.includes('schema cache')))
  )
}

function isMissingRpc(error: { message?: string; code?: string } | null) {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  const code = error.code ?? ''
  return code === 'PGRST202' || code === '42883' || message.includes('could not find the function')
}

function scopedKey(base: string, organizationId?: string | null) {
  return organizationId ? `${base}:${organizationId}` : base
}

function cacheSites(organizationId: string, sites: Site[]) {
  writeJson(scopedKey(SITES_KEY, organizationId), sites)
}

function cacheProfile(organizationId: string, profile: OrgProfile) {
  writeJson(scopedKey(PROFILE_KEY, organizationId), profile)
}

function cachedSites(organizationId: string): Site[] {
  return readJson<Site[]>(scopedKey(SITES_KEY, organizationId), [])
}

function cachedProfile(organizationId: string, organisationName: string): OrgProfile {
  return {
    ...emptyOrgProfile(organisationName),
    ...readJson<Partial<OrgProfile>>(scopedKey(PROFILE_KEY, organizationId), {}),
  }
}

function fromSiteRow(row: Record<string, unknown>): Site {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    type: (String(row.type ?? 'office') as Site['type']) || 'office',
    region: String(row.region ?? ''),
  }
}

export async function fetchSites(organizationId: string): Promise<Site[]> {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, type, region')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error || !data) return cachedSites(organizationId)
  const sites = data.map((row) => fromSiteRow(row as Record<string, unknown>))
  cacheSites(organizationId, sites)
  return sites
}

export async function createSite(
  organizationId: string,
  input: Omit<Site, 'id'>,
): Promise<{ site: Site | null; error: string | null }> {
  const { data, error } = await supabase
    .from('sites')
    .insert({
      organization_id: organizationId,
      name: input.name,
      type: input.type,
      region: input.region,
    })
    .select('id, name, type, region')
    .single()

  if (error || !data) {
    return { site: null, error: error?.message ?? 'Could not save this facility to the organisation.' }
  }
  const site = fromSiteRow(data as Record<string, unknown>)
  cacheSites(organizationId, [...cachedSites(organizationId).filter((row) => row.id !== site.id), site])
  return { site, error: null }
}

export async function deleteSite(organizationId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('sites').delete().eq('id', id).eq('organization_id', organizationId)
  if (error) return { error: error.message }
  cacheSites(
    organizationId,
    cachedSites(organizationId).filter((site) => site.id !== id),
  )
  return { error: null }
}

type SettingsRow = {
  display_name: string | null
  country: string | null
  intensity_metric: string | null
  baseline_ytd_tco2e: number | null
  annual_revenue: number | null
  sbti_config: Record<string, unknown> | null
  employee_count?: number | null
  reporting_year?: number | null
  locked_years?: number[] | null
  residual_mix_kg_per_kwh?: number | null
}

const SETTINGS_SELECT_FULL =
  'display_name, country, intensity_metric, baseline_ytd_tco2e, annual_revenue, sbti_config, employee_count, reporting_year, locked_years, residual_mix_kg_per_kwh'
const SETTINGS_SELECT_CORE =
  'display_name, country, intensity_metric, baseline_ytd_tco2e, annual_revenue, sbti_config'

function profileFromSettings(row: SettingsRow | null, organisationName: string, cached?: OrgProfile): OrgProfile {
  const fallback = cached ?? emptyOrgProfile(organisationName)
  if (!row) return fallback
  return {
    displayName: row.display_name || organisationName || fallback.displayName,
    organisation: organisationName || fallback.organisation,
    country: row.country || fallback.country,
    intensityMetric: row.intensity_metric || fallback.intensityMetric,
    baselineYtdTco2e: Number(row.baseline_ytd_tco2e) || 0,
    annualRevenue: Number(row.annual_revenue) || 0,
    employeeCount: Number(row.employee_count ?? fallback.employeeCount) || 0,
    reportingYear: Number(row.reporting_year ?? fallback.reportingYear) || new Date().getFullYear(),
    lockedYears: row.locked_years ? asYearList(row.locked_years) : fallback.lockedYears,
    residualMixKgPerKwh: Number(row.residual_mix_kg_per_kwh ?? fallback.residualMixKgPerKwh) || 0,
  }
}

function coreSettingsPayload(organizationId: string, profile: OrgProfile) {
  return {
    organization_id: organizationId,
    display_name: profile.displayName,
    country: profile.country,
    intensity_metric: profile.intensityMetric,
    baseline_ytd_tco2e: profile.baselineYtdTco2e,
    annual_revenue: profile.annualRevenue,
    updated_at: new Date().toISOString(),
  }
}

function fullSettingsPayload(organizationId: string, profile: OrgProfile) {
  return {
    ...coreSettingsPayload(organizationId, profile),
    employee_count: profile.employeeCount,
    reporting_year: profile.reportingYear,
    locked_years: profile.lockedYears,
    residual_mix_kg_per_kwh: profile.residualMixKgPerKwh,
  }
}

export async function fetchOrgSettings(
  organizationId: string,
  organisationName: string,
): Promise<{ profile: OrgProfile; sbtiConfig: Record<string, unknown> | null }> {
  const cached = cachedProfile(organizationId, organisationName)
  let result = await supabase
    .from('organization_settings')
    .select(SETTINGS_SELECT_FULL)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from('organization_settings')
      .select(SETTINGS_SELECT_CORE)
      .eq('organization_id', organizationId)
      .maybeSingle()
  }

  if (result.error || !result.data) {
    return { profile: cached, sbtiConfig: null }
  }
  const profile = profileFromSettings(result.data as SettingsRow, organisationName, cached)
  cacheProfile(organizationId, profile)
  return { profile, sbtiConfig: (result.data.sbti_config as Record<string, unknown> | null) ?? null }
}

export async function saveOrgSettings(
  organizationId: string,
  profile: OrgProfile,
  sbtiConfig?: Record<string, unknown> | null,
): Promise<{ error: string | null }> {
  const full: Record<string, unknown> = fullSettingsPayload(organizationId, profile)
  if (sbtiConfig) full.sbti_config = sbtiConfig

  let { error } = await supabase.from('organization_settings').upsert(full, { onConflict: 'organization_id' })
  if (error && isMissingColumnError(error)) {
    const core: Record<string, unknown> = coreSettingsPayload(organizationId, profile)
    if (sbtiConfig) core.sbti_config = sbtiConfig
    const retry = await supabase.from('organization_settings').upsert(core, { onConflict: 'organization_id' })
    error = retry.error
  }
  cacheProfile(organizationId, profile)
  if (error) return { error: error.message }
  return { error: null }
}

export async function setReportingYearLock(
  organizationId: string,
  year: number,
  locked: boolean,
  reason = '',
): Promise<{ lockedYears: number[] | null; error: string | null }> {
  const rpc = await supabase.rpc('set_reporting_year_lock', {
    p_organization_id: organizationId,
    p_year: year,
    p_locked: locked,
    p_reason: reason,
  })
  if (!rpc.error) {
    const years = asYearList((rpc.data as { locked_years?: unknown } | null)?.locked_years)
    return { lockedYears: years, error: null }
  }
  if (!isMissingRpc(rpc.error) && !isMissingColumnError(rpc.error)) {
    return { lockedYears: null, error: rpc.error.message }
  }
  return { lockedYears: null, error: null }
}

export async function saveOrgSbtiConfig(
  organizationId: string,
  sbtiConfig: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('organization_settings').upsert(
    {
      organization_id: organizationId,
      sbti_config: sbtiConfig,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' },
  )
  return { error: error?.message ?? null }
}
