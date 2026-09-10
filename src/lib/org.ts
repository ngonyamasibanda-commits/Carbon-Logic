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
  }
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
}

function profileFromSettings(row: SettingsRow | null, organisationName: string): OrgProfile {
  const fallback = emptyOrgProfile(organisationName)
  if (!row) return fallback
  return {
    displayName: row.display_name || organisationName || fallback.displayName,
    organisation: organisationName || fallback.organisation,
    country: row.country || fallback.country,
    intensityMetric: row.intensity_metric || fallback.intensityMetric,
    baselineYtdTco2e: Number(row.baseline_ytd_tco2e) || 0,
    annualRevenue: Number(row.annual_revenue) || 0,
  }
}

export async function fetchOrgSettings(
  organizationId: string,
  organisationName: string,
): Promise<{ profile: OrgProfile; sbtiConfig: Record<string, unknown> | null }> {
  const { data, error } = await supabase
    .from('organization_settings')
    .select('display_name, country, intensity_metric, baseline_ytd_tco2e, annual_revenue, sbti_config')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error || !data) {
    return { profile: cachedProfile(organizationId, organisationName), sbtiConfig: null }
  }
  const profile = profileFromSettings(data as SettingsRow, organisationName)
  cacheProfile(organizationId, profile)
  return { profile, sbtiConfig: (data.sbti_config as Record<string, unknown> | null) ?? null }
}

export async function saveOrgSettings(
  organizationId: string,
  profile: OrgProfile,
  sbtiConfig?: Record<string, unknown> | null,
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {
    organization_id: organizationId,
    display_name: profile.displayName,
    country: profile.country,
    intensity_metric: profile.intensityMetric,
    baseline_ytd_tco2e: profile.baselineYtdTco2e,
    annual_revenue: profile.annualRevenue,
    updated_at: new Date().toISOString(),
  }
  if (sbtiConfig) payload.sbti_config = sbtiConfig

  const { error } = await supabase.from('organization_settings').upsert(payload, { onConflict: 'organization_id' })
  if (error) return { error: error.message }
  cacheProfile(organizationId, profile)
  return { error: null }
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
