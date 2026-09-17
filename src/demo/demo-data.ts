/**
 * Dummy tutorial data for a fictional construction company.
 *
 * Used only by the dev-only demo harness (`demo.html`) that exists so screen
 * recordings and screenshots can be produced without touching a real account
 * or the production database. Nothing here is imported by `src/main.tsx`.
 */
import { getCategory } from '../lib/categories'
import { FACTOR_CATALOG } from '../lib/factor-catalog'
import type { OrgProfile, Site } from '../lib/org'
import type { SbtiConfig } from '../lib/sbti'
import type { EmissionEntry, EmissionFactor, Scope } from '../lib/types'
import type { Membership, Organization, Profile } from '../lib/auth'

export const DEMO_ORG: Organization = {
  id: 'demo-meridian',
  name: 'Meridian Construction Group',
  slug: 'meridian-construction',
  allowedEmailDomains: ['meridianconstruction.co.uk'],
  requireMfa: false,
  sessionIdleMinutes: 30,
  sessionAbsoluteHours: 12,
}

export const DEMO_PROFILE: Profile = {
  id: 'demo-user',
  email: 'dana.okoye@meridianconstruction.co.uk',
  fullName: 'Dana Okoye',
  jobTitle: 'Head of Sustainability',
}

export const DEMO_MEMBERSHIPS: Membership[] = [
  {
    id: 'demo-membership',
    organizationId: DEMO_ORG.id,
    userId: DEMO_PROFILE.id,
    role: 'owner',
    createdAt: '2023-01-09T09:00:00.000Z',
    organization: DEMO_ORG,
  },
]

export const DEMO_SITES: Site[] = [
  { id: 'site-hq', name: 'Meridian House (head office)', type: 'office', region: 'Manchester' },
  { id: 'site-riverside', name: 'Riverside Quarter', type: 'construction_site', region: 'Leeds' },
  { id: 'site-a62', name: 'A62 Highways Package', type: 'construction_site', region: 'West Yorkshire' },
  { id: 'site-depot', name: 'Northgate Depot', type: 'depot', region: 'Rochdale' },
  { id: 'site-yard', name: 'Meridian Plant Yard', type: 'warehouse', region: 'Rochdale' },
]

export const DEMO_TEAM = [
  { id: 'user-dana', name: 'Dana Okoye', email: 'dana.okoye@meridianconstruction.co.uk', role: 'admin' },
  { id: 'user-tom', name: 'Tom Halloran', email: 'tom.halloran@meridianconstruction.co.uk', role: 'editor' },
  { id: 'user-priya', name: 'Priya Raman', email: 'priya.raman@meridianconstruction.co.uk', role: 'editor' },
  { id: 'user-jack', name: 'Jack Mbeki', email: 'jack.mbeki@meridianconstruction.co.uk', role: 'viewer' },
]

export const DEMO_ORG_PROFILE: OrgProfile = {
  displayName: 'Dana Okoye',
  organisation: 'Meridian Construction Group',
  country: 'United Kingdom',
  intensityMetric: 'tCO2e per £m turnover',
  annualRevenue: 48_200_000,
  employeeCount: 412,
  reportingYear: 2025,
  lockedYears: [],
  residualMixKgPerKwh: 0,
  /** Same period last year, so the dashboard shows a reduction against it. */
  baselineYtdTco2e: 4180,
}

export const DEMO_ORDERS = [
  {
    id: 'order-demo-1',
    project: 'Peatland restoration — Yorkshire Dales',
    tco2e: 250,
    trees: 0,
    created_at: '2025-04-18T10:30:00.000Z',
  },
]

/** Turnover used for the tCO2e per £m intensity metric. */
export const DEMO_REVENUE = 48_200_000

/**
 * Reporting years in the dummy inventory: 2023 base year, two full years, then
 * the current year to date so the dashboard's YTD figures are populated.
 */
export const DEMO_YEARS = [2023, 2024, 2025, 2026] as const

/** Years that are still in progress, and the last month with data. */
const PARTIAL_YEARS: Record<number, number> = { 2026: 8 }

/**
 * Year-on-year multipliers. Scope 2 falls fastest (renewable tariff), scope 1
 * next (fleet renewal), scope 3 slowest — the usual shape for a contractor.
 */
const YEAR_FACTORS: Record<number, Record<Scope, number>> = {
  2023: { 'Scope 1': 1, 'Scope 2': 1, 'Scope 3': 1, Custom: 1 },
  2024: { 'Scope 1': 0.92, 'Scope 2': 0.78, 'Scope 3': 0.96, Custom: 0.95 },
  2025: { 'Scope 1': 0.83, 'Scope 2': 0.55, 'Scope 3': 0.9, Custom: 0.88 },
  2026: { 'Scope 1': 0.76, 'Scope 2': 0.42, 'Scope 3': 0.85, Custom: 0.8 },
}

type Blueprint = {
  category: string
  details: string
  amount: number
  unit: string
  tco2e: number
  site: string
  /** 1-12; spreads entries across the reporting year. */
  month: number
  tags: string[]
  comment?: string
  link?: string
  customFields?: { label: string; value: string }[]
}

const HQ = 'Meridian House (head office)'
const RIVERSIDE = 'Riverside Quarter'
const A62 = 'A62 Highways Package'
const DEPOT = 'Northgate Depot'
const YARD = 'Meridian Plant Yard'

/** One reporting year of activity, later scaled to produce 2023-2025. */
const BLUEPRINT: Blueprint[] = [
  // ── Scope 1 ────────────────────────────────────────────────────────────────
  {
    category: 'site_fuel',
    details: 'Gas oil — site cabins and welfare units',
    amount: 62_000,
    unit: 'litres',
    tco2e: 166.2,
    site: RIVERSIDE,
    month: 2,
    tags: ['Riverside Quarter', 'Metered'],
    comment: 'Bulk deliveries reconciled against the fuel bowser log.',
    link: 'https://meridianconstruction.co.uk/esg/fuel-log-riverside',
  },
  {
    category: 'site_fuel',
    details: 'Natural gas — Meridian House heating',
    amount: 148_000,
    unit: 'kWh',
    tco2e: 27.1,
    site: HQ,
    month: 1,
    tags: ['Head office', 'Metered'],
  },
  {
    category: 'heavy_machinery',
    details: 'Diesel — 30t tracked excavators (x4)',
    amount: 84_000,
    unit: 'litres',
    tco2e: 212.4,
    site: RIVERSIDE,
    month: 3,
    tags: ['Riverside Quarter', 'Plant'],
    customFields: [
      { label: 'Plant IDs', value: 'EXC-014, EXC-021, EXC-022, EXC-030' },
      { label: 'Telematics source', value: 'Komatsu Smart Construction' },
    ],
  },
  {
    category: 'heavy_machinery',
    details: 'Diesel — telehandlers and site dumpers',
    amount: 41_500,
    unit: 'litres',
    tco2e: 104.9,
    site: A62,
    month: 5,
    tags: ['A62 Highways', 'Plant'],
  },
  {
    category: 'heavy_machinery',
    details: 'Diesel — tower crane standby generator',
    amount: 18_200,
    unit: 'litres',
    tco2e: 46.0,
    site: RIVERSIDE,
    month: 7,
    tags: ['Riverside Quarter', 'Plant'],
  },
  {
    category: 'fleet',
    details: 'Diesel vans — 28 vehicle site fleet',
    amount: 412_000,
    unit: 'miles',
    tco2e: 137.6,
    site: DEPOT,
    month: 4,
    tags: ['Fleet', 'Telematics'],
    comment: 'Mileage exported from the tracker; fuel cards used as a cross-check.',
  },
  {
    category: 'fleet',
    details: 'Diesel pickups — site management',
    amount: 96_000,
    unit: 'miles',
    tco2e: 41.2,
    site: DEPOT,
    month: 6,
    tags: ['Fleet', 'Telematics'],
  },
  {
    category: 'refrigerants',
    details: 'R-410A top-up — welfare unit air conditioning',
    amount: 12,
    unit: 'kg',
    tco2e: 25.0,
    site: RIVERSIDE,
    month: 8,
    tags: ['Riverside Quarter', 'F-gas'],
    comment: 'From the F-gas register kept by the maintenance contractor.',
  },
  {
    category: 'refrigerants',
    details: 'R-134a top-up — plant cab air conditioning',
    amount: 6,
    unit: 'kg',
    tco2e: 8.6,
    site: YARD,
    month: 9,
    tags: ['Plant', 'F-gas'],
  },

  // ── Scope 2 ────────────────────────────────────────────────────────────────
  {
    category: 'site_electricity',
    details: 'Grid electricity — Meridian House',
    amount: 186_000,
    unit: 'kWh',
    tco2e: 38.5,
    site: HQ,
    month: 1,
    tags: ['Head office', 'Metered'],
    link: 'https://meridianconstruction.co.uk/esg/hh-data-2023',
  },
  {
    category: 'site_electricity',
    details: 'Grid electricity — Riverside Quarter site supply',
    amount: 342_000,
    unit: 'kWh',
    tco2e: 70.8,
    site: RIVERSIDE,
    month: 3,
    tags: ['Riverside Quarter', 'Metered'],
    comment: 'Temporary builders supply, half-hourly metered.',
  },
  {
    category: 'site_electricity',
    details: 'Grid electricity — Northgate Depot and plant yard',
    amount: 128_000,
    unit: 'kWh',
    tco2e: 26.5,
    site: DEPOT,
    month: 2,
    tags: ['Depot', 'Metered'],
  },
  {
    category: 'heat_steam',
    details: 'Purchased district heat — Meridian House',
    amount: 64_000,
    unit: 'kWh',
    tco2e: 11.9,
    site: HQ,
    month: 11,
    tags: ['Head office', 'Metered'],
  },

  // ── Scope 3 — purchased goods and services (category 1 and 2) ─────────────
  {
    category: 'bulk_materials',
    details: 'Ready-mixed concrete C32/40',
    amount: 8_400,
    unit: 'tonnes',
    tco2e: 907.2,
    site: RIVERSIDE,
    month: 4,
    tags: ['Riverside Quarter', 'Materials'],
    comment: 'Volumes taken from the concrete pour schedule; 30% GGBS mix.',
    customFields: [{ label: 'EPD reference', value: 'EPD-TAR-2022-0142' }],
  },
  {
    category: 'bulk_materials',
    details: 'Reinforcing steel — rebar cages and mesh',
    amount: 640,
    unit: 'tonnes',
    tco2e: 1_196.8,
    site: RIVERSIDE,
    month: 5,
    tags: ['Riverside Quarter', 'Materials'],
  },
  {
    category: 'bulk_materials',
    details: 'Structural steel — frame and connections',
    amount: 310,
    unit: 'tonnes',
    tco2e: 592.1,
    site: RIVERSIDE,
    month: 6,
    tags: ['Riverside Quarter', 'Materials'],
  },
  {
    category: 'bulk_materials',
    details: 'Cement (CEM I) — grouting and blinding',
    amount: 520,
    unit: 'tonnes',
    tco2e: 462.8,
    site: A62,
    month: 7,
    tags: ['A62 Highways', 'Materials'],
  },
  {
    category: 'bulk_materials',
    details: 'Primary aggregates — sub-base and capping',
    amount: 12_600,
    unit: 'tonnes',
    tco2e: 88.2,
    site: A62,
    month: 8,
    tags: ['A62 Highways', 'Materials'],
  },
  {
    category: 'bulk_materials',
    details: 'Bricks and dense concrete blocks',
    amount: 1_850,
    unit: 'tonnes',
    tco2e: 407.0,
    site: RIVERSIDE,
    month: 9,
    tags: ['Riverside Quarter', 'Materials'],
  },
  {
    category: 'bulk_materials',
    details: 'Engineered timber — CLT floor cassettes',
    amount: 420,
    unit: 'tonnes',
    tco2e: 109.2,
    site: RIVERSIDE,
    month: 10,
    tags: ['Riverside Quarter', 'Materials'],
    comment: 'Biogenic storage reported separately, outside the inventory total.',
  },
  {
    category: 'purchased_goods',
    details: 'Plant hire, formwork and site consumables (spend-based)',
    amount: 2_400_000,
    unit: 'GBP',
    tco2e: 288.0,
    site: YARD,
    month: 11,
    tags: ['Spend-based', 'Materials'],
    comment: 'Spend-based estimate pending supplier-specific data for FY25.',
  },
  {
    category: 'purchased_goods',
    details: 'Capital goods — telehandler and site cabin purchases',
    amount: 780_000,
    unit: 'GBP',
    tco2e: 93.6,
    site: YARD,
    month: 12,
    tags: ['Spend-based', 'Capital goods'],
    comment: 'Capital goods purchase — GHG Protocol scope 3 category 2.',
  },
  {
    category: 'subcontractor',
    details: 'Groundworks and piling subcontractor',
    amount: 3_100_000,
    unit: 'GBP',
    tco2e: 372.0,
    site: RIVERSIDE,
    month: 3,
    tags: ['Subcontractors'],
  },
  {
    category: 'subcontractor',
    details: 'Mechanical and electrical subcontractor',
    amount: 2_200_000,
    unit: 'GBP',
    tco2e: 198.0,
    site: RIVERSIDE,
    month: 10,
    tags: ['Subcontractors'],
  },

  // ── Scope 3 — transport, waste, water, travel ─────────────────────────────
  {
    category: 'road_freight',
    details: 'HGV deliveries — materials to site',
    amount: 486_000,
    unit: 'tonne-km',
    tco2e: 51.5,
    site: RIVERSIDE,
    month: 5,
    tags: ['Logistics'],
  },
  {
    category: 'rail_freight',
    details: 'Aggregate haulage by rail to railhead',
    amount: 220_000,
    unit: 'tonne-km',
    tco2e: 5.8,
    site: A62,
    month: 6,
    tags: ['Logistics'],
  },
  {
    category: 'sea_freight',
    details: 'Imported facade cladding — container shipping',
    amount: 1_240_000,
    unit: 'tonne-km',
    tco2e: 20.1,
    site: RIVERSIDE,
    month: 7,
    tags: ['Logistics'],
  },
  {
    category: 'air_freight',
    details: 'Expedited crane spares — air freight',
    amount: 8_400,
    unit: 'tonne-km',
    tco2e: 9.2,
    site: YARD,
    month: 8,
    tags: ['Logistics', 'Exception'],
    comment: 'One-off to avoid a programme delay; flagged for reduction.',
  },
  {
    category: 'waste',
    details: 'Inert construction waste — recycled',
    amount: 3_200,
    unit: 'tonnes',
    tco2e: 33.9,
    site: RIVERSIDE,
    month: 9,
    tags: ['Waste'],
  },
  {
    category: 'waste',
    details: 'Mixed construction and demolition waste — landfill',
    amount: 640,
    unit: 'tonnes',
    tco2e: 179.2,
    site: A62,
    month: 10,
    tags: ['Waste'],
    comment: 'Waste transfer notes from the licensed carrier.',
  },
  {
    category: 'water',
    details: 'Mains water — site and welfare supply',
    amount: 18_400,
    unit: 'm³',
    tco2e: 2.5,
    site: RIVERSIDE,
    month: 11,
    tags: ['Water'],
  },
  {
    category: 'wastewater',
    details: 'Wastewater treatment — site and welfare',
    amount: 14_700,
    unit: 'm³',
    tco2e: 3.5,
    site: RIVERSIDE,
    month: 11,
    tags: ['Water'],
  },
  {
    category: 'crew_transport',
    details: 'Crew minibus transfers to site',
    amount: 168_000,
    unit: 'miles',
    tco2e: 44.2,
    site: A62,
    month: 4,
    tags: ['People'],
  },
  {
    category: 'employee_commuting',
    details: 'Staff and operative commuting (survey based)',
    amount: 1_240_000,
    unit: 'miles',
    tco2e: 214.9,
    site: HQ,
    month: 12,
    tags: ['People', 'Survey'],
    comment: 'Annual travel survey, 74% response rate, grossed up to headcount.',
    customFields: [{ label: 'Survey responses', value: '133 of 180' }],
  },
  {
    category: 'business_travel',
    details: 'Domestic rail — client and design meetings',
    amount: 96_000,
    unit: 'miles',
    tco2e: 5.4,
    site: HQ,
    month: 2,
    tags: ['People', 'Travel'],
  },
  {
    category: 'business_travel',
    details: 'Short-haul flights — supplier audits',
    amount: 42_000,
    unit: 'miles',
    tco2e: 10.1,
    site: HQ,
    month: 6,
    tags: ['People', 'Travel'],
  },
  {
    category: 'business_travel',
    details: 'Hotel nights — site secondments',
    amount: 620,
    unit: 'nights',
    tco2e: 6.8,
    site: A62,
    month: 9,
    tags: ['People', 'Travel'],
  },

  // ── Custom ────────────────────────────────────────────────────────────────
  {
    category: 'custom',
    details: 'Temporary works hoarding — supplier EPD factor',
    amount: 96,
    unit: 'tonnes',
    tco2e: 42.7,
    site: RIVERSIDE,
    month: 12,
    tags: ['Materials', 'Custom factor'],
    comment: 'Uses the supplier EPD factor added on the Emission Factors page.',
    link: 'https://meridianconstruction.co.uk/esg/epd-hoarding',
  },
]

function round(value: number, places = 2) {
  const power = 10 ** places
  return Math.round(value * power) / power
}

function scopeOf(categoryId: string): Scope {
  return getCategory(categoryId)?.scope ?? 'Custom'
}

function buildEntries(): EmissionEntry[] {
  const rows: EmissionEntry[] = []
  for (const year of DEMO_YEARS) {
    const lastMonth = PARTIAL_YEARS[year] ?? 12
    BLUEPRINT.forEach((blueprint, index) => {
      if (blueprint.month > lastMonth) return
      const scope = scopeOf(blueprint.category)
      const factor = YEAR_FACTORS[year][scope]
      const month = String(blueprint.month).padStart(2, '0')
      rows.push({
        id: `demo-${year}-${String(index).padStart(2, '0')}`,
        category: blueprint.category,
        scope,
        emissions_tco2e: round(blueprint.tco2e * factor, 2),
        details: blueprint.details,
        amount: round(blueprint.amount * factor, 2),
        unit: blueprint.unit,
        comment: blueprint.comment ?? '',
        link: blueprint.link ?? '',
        created_at: `${year}-${month}-12T09:30:00.000Z`,
        site: blueprint.site,
        tags: [...blueprint.tags, `FY${String(year).slice(2)}`],
        customFields: blueprint.customFields ?? [],
        files: [],
      })
    })
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export const DEMO_ENTRIES: EmissionEntry[] = buildEntries()

/** A supplier-specific factor, so the Emission Factors page shows a user entry. */
export const DEMO_CUSTOM_FACTOR: EmissionFactor = {
  key: 'user:hoarding-epd',
  name: 'Site hoarding — supplier EPD (Meridian)',
  category: 'custom',
  scope: 'Custom',
  conversionValue: 0.445,
  unit: 'tonnes',
  sourceFamily: 'User',
  source: 'Supplier EPD, verified 2024',
  sourceUrl: 'https://meridianconstruction.co.uk/esg/epd-hoarding',
  region: 'United Kingdom',
  validFrom: '2024-01-01',
  lastVerifiedAt: '2025-02-14',
  isPlaceholder: false,
}

export function demoFactors(): Map<string, EmissionFactor> {
  const map = new Map(FACTOR_CATALOG.map((factor) => [factor.key, factor]))
  map.set(DEMO_CUSTOM_FACTOR.key, DEMO_CUSTOM_FACTOR)
  return map
}

export const DEMO_SBTI: SbtiConfig = {
  baseYear: 2023,
  targetYear: 2033,
  submissionYear: 2026,
  netZeroYear: 2050,
  useLiveInventory: true,
  baseScope1: 0,
  baseScope2: 0,
  baseScope3: 0,
  mostRecentYear: 2025,
  recentScope1: 0,
  recentScope2: 0,
  recentScope3: 0,
  scope3Ambition: 'WB2C',
  scope12Coverage: 100,
  scope3Coverage: 72,
  scope2Approach: 'location-based',
  renewableElectricityTarget: true,
  renewableShareBaseYear: 18,
  sellsFossilFuels: false,
}

/**
 * Writes the parts of the demo dataset that the app reads straight from
 * localStorage (facilities, team, turnover, target settings).
 */
export function seedDemoLocalStorage() {
  const scoped = (base: string) => `${base}:${DEMO_ORG.id}`
  const seed: Array<[string, unknown]> = [
    [scoped('carbon-logic-sites'), DEMO_SITES],
    [scoped('carbon-logic-team'), DEMO_TEAM],
    [scoped('carbon-logic-profile'), DEMO_ORG_PROFILE],
    [scoped('carbon-logic-credit-orders'), DEMO_ORDERS],
    [scoped('carbon-logic-sbti-target'), DEMO_SBTI],
  ]
  for (const [key, value] of seed) localStorage.setItem(key, JSON.stringify(value))
  localStorage.setItem(scoped('carbon-logic-revenue'), String(DEMO_REVENUE))
}
