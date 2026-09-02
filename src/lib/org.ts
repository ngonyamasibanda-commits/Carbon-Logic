export type Site = {
  id: string
  name: string
  type: 'office' | 'depot' | 'construction_site' | 'warehouse'
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
  baselineYtdTco2e: 0,
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

export function loadSites(): Site[] {
  return read(SITES_KEY, DEFAULT_SITES)
}

export function saveSites(sites: Site[]) {
  write(SITES_KEY, sites)
}

export function loadTeam(): TeamMember[] {
  return read(TEAM_KEY, DEFAULT_TEAM)
}

export function saveTeam(team: TeamMember[]) {
  write(TEAM_KEY, team)
}

export function loadProfile(): OrgProfile {
  return { ...DEFAULT_PROFILE, ...read(PROFILE_KEY, DEFAULT_PROFILE) }
}

export function saveProfile(profile: OrgProfile) {
  write(PROFILE_KEY, profile)
}

export function loadOrders(): CreditOrder[] {
  return read(ORDERS_KEY, [])
}

export function saveOrders(orders: CreditOrder[]) {
  write(ORDERS_KEY, orders)
}
