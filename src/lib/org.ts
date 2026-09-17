export type Site = {
  id: string
  name: string
  type: 'office' | 'depot' | 'construction_site' | 'warehouse' | 'mine' | 'processing_plant'
  region: string
}

export type TeamMember = {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
}

export type OrgProfile = {
  displayName: string
  organisation: string
  country: string
  intensityMetric: string
  /** Annual turnover / revenue in £ — used for SECR intensity (tCO₂e per £m). */
  annualTurnover: number
  baselineYtdTco2e: number
}

export type CreditOrder = {
  id: string
  project: string
  tco2e: number
  trees: number
  created_at: string
}

const SITES_KEY = 'carbon-logic-sites'
const TEAM_KEY = 'carbon-logic-team'
const PROFILE_KEY = 'carbon-logic-profile'
const ORDERS_KEY = 'carbon-logic-credit-orders'

const DEFAULT_SITES: Site[] = [
  { id: 'site-hq', name: 'Head office', type: 'office', region: 'United Kingdom' },
  { id: 'site-a', name: 'Construction site A', type: 'construction_site', region: 'United Kingdom' },
  { id: 'site-depot', name: 'Central depot', type: 'depot', region: 'United Kingdom' },
]

const DEFAULT_TEAM: TeamMember[] = [
  { id: 'user-h', name: 'Hlulani Logic', email: 'hlulani@carbonlogic.local', role: 'admin' },
]

const DEFAULT_PROFILE: OrgProfile = {
  displayName: 'Hlulani Logic',
  organisation: 'Carbon Logic',
  country: 'United Kingdom',
  intensityMetric: 'tCO2e per £m turnover',
  annualTurnover: 0,
  baselineYtdTco2e: 0,
}

/** Revenue key used by Analysis (legacy) — kept in sync when turnover is saved. */
export function revenueStorageKey(organizationId?: string | null) {
  return organizationId ? `carbon-logic-revenue:${organizationId}` : 'carbon-logic-revenue'
}

export function syncRevenueFromTurnover(turnover: number, organizationId?: string | null) {
  const key = revenueStorageKey(organizationId)
  if (turnover > 0) localStorage.setItem(key, String(turnover))
  else localStorage.removeItem(key)
}

function scopedKey(base: string, organizationId?: string | null) {
  return organizationId ? `${base}:${organizationId}` : base
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function readScoped<T>(base: string, organizationId: string | null | undefined, fallback: T): T {
  const scoped = read<T | null>(scopedKey(base, organizationId), null)
  if (scoped) return scoped
  const legacy = read<T | null>(base, null)
  if (legacy && organizationId) {
    write(scopedKey(base, organizationId), legacy)
    return legacy
  }
  return fallback
}

export function loadSites(organizationId?: string | null): Site[] {
  return readScoped(SITES_KEY, organizationId, DEFAULT_SITES)
}

export function saveSites(sites: Site[], organizationId?: string | null) {
  write(scopedKey(SITES_KEY, organizationId), sites)
}

export function loadTeam(organizationId?: string | null): TeamMember[] {
  return readScoped(TEAM_KEY, organizationId, DEFAULT_TEAM)
}

export function saveTeam(team: TeamMember[], organizationId?: string | null) {
  write(scopedKey(TEAM_KEY, organizationId), team)
}

export function loadProfile(organizationId?: string | null): OrgProfile {
  const stored = { ...DEFAULT_PROFILE, ...readScoped(PROFILE_KEY, organizationId, DEFAULT_PROFILE) }
  // Prefer explicit turnover; fall back to legacy Analysis revenue key once.
  if (!stored.annualTurnover || stored.annualTurnover <= 0) {
    const legacy = Number(
      localStorage.getItem(revenueStorageKey(organizationId)) ??
        localStorage.getItem('carbon-logic-revenue') ??
        0,
    )
    if (Number.isFinite(legacy) && legacy > 0) stored.annualTurnover = legacy
  }
  return stored
}

export function saveProfile(profile: OrgProfile, organizationId?: string | null) {
  write(scopedKey(PROFILE_KEY, organizationId), profile)
  syncRevenueFromTurnover(profile.annualTurnover || 0, organizationId)
}

export function loadOrders(organizationId?: string | null): CreditOrder[] {
  return readScoped(ORDERS_KEY, organizationId, [])
}

export function saveOrders(orders: CreditOrder[], organizationId?: string | null) {
  write(scopedKey(ORDERS_KEY, organizationId), orders)
}
