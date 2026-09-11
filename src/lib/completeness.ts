import { CATEGORIES } from './categories'
import { entryActivityYear } from './entry-date'
import type { OrgProfile, Site } from './org'
import { parseScope2Meta } from './scope2'
import type { EmissionEntry } from './types'

/** Categories that usually dominate a contractor, miner, or logistics inventory. */
export const MATERIAL_CATEGORY_IDS = [
  'site_electricity',
  'site_fuel',
  'heavy_machinery',
  'bulk_materials',
  'waste',
  'road_freight',
] as const

export type CompletenessItem = {
  id: string
  label: string
  done: boolean
  hint: string
  href?: string
}

export type CompletenessReport = {
  score: number
  items: CompletenessItem[]
  evidenceShare: number
  siteShare: number
  materialLogged: number
  materialTotal: number
}

export function completenessForYear(input: {
  entries: EmissionEntry[]
  sites: Site[]
  profile: OrgProfile
  year: number
}): CompletenessReport {
  const yearEntries = input.entries.filter((entry) => entryActivityYear(entry) === input.year)
  const logged = new Set(yearEntries.map((entry) => entry.category))
  const materialTotal = MATERIAL_CATEGORY_IDS.length
  const materialLogged = MATERIAL_CATEGORY_IDS.filter((id) => logged.has(id)).length
  const withEvidence = yearEntries.filter((entry) => Boolean(entry.link.trim())).length
  const withSite = yearEntries.filter((entry) => Boolean(entry.site.trim())).length
  const evidenceShare = yearEntries.length > 0 ? withEvidence / yearEntries.length : 0
  const siteShare = yearEntries.length > 0 ? withSite / yearEntries.length : 0
  const electricity = yearEntries.filter((entry) => entry.category === 'site_electricity')
  const dualCovered =
    electricity.length === 0 || electricity.every((entry) => Boolean(parseScope2Meta(entry.customFields)))

  const items: CompletenessItem[] = [
    {
      id: 'facility',
      label: 'Add at least one facility',
      done: input.sites.length > 0,
      hint: 'Sites appear on the dashboard and on every activity form.',
      href: '/facilities',
    },
    {
      id: 'activity',
      label: `Log ${input.year} activity`,
      done: yearEntries.length > 0,
      hint: 'Start with site electricity, site fuel, and bulk materials.',
      href: '/input',
    },
    {
      id: 'material',
      label: `Cover the usual sources (${materialLogged} of ${materialTotal})`,
      done: materialLogged >= 4,
      hint: MATERIAL_CATEGORY_IDS.map((id) => CATEGORIES.find((row) => row.id === id)?.name ?? id).join(', '),
      href: '/input',
    },
    {
      id: 'baseline',
      label: 'Set a baseline tCO₂e',
      done: input.profile.baselineYtdTco2e > 0,
      hint: 'Used on the board dashboard and in the Carbon Reduction Plan.',
      href: '/organisation',
    },
    {
      id: 'revenue',
      label: 'Enter annual turnover',
      done: input.profile.annualRevenue > 0,
      hint: 'Required for the SECR intensity ratio (tCO₂e per £ million).',
      href: '/organisation',
    },
    {
      id: 'fte',
      label: 'Enter average FTE',
      done: input.profile.employeeCount > 0,
      hint: 'Used for tCO₂e per employee — a common second SECR intensity metric.',
      href: '/organisation',
    },
    {
      id: 'evidence',
      label: 'Attach evidence links (half of rows)',
      done: evidenceShare >= 0.5,
      hint: 'Paste a SharePoint or Drive URL on each activity so an auditor can follow the file.',
    },
    {
      id: 'sites',
      label: 'Assign facilities (half of rows)',
      done: siteShare >= 0.5,
      hint: 'Unassigned rows weaken site-level reporting.',
    },
    {
      id: 'scope2',
      label: 'Record market-based Scope 2 instruments',
      done: dualCovered,
      hint: 'REGO, supplier factor, or residual mix — needed for SECR dual reporting.',
      href: '/input/site_electricity',
    },
  ]

  const done = items.filter((item) => item.done).length
  return {
    score: items.length > 0 ? done / items.length : 0,
    items,
    evidenceShare,
    siteShare,
    materialLogged,
    materialTotal,
  }
}
