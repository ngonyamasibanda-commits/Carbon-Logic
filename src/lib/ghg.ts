import { getCategory } from './categories'
import { formatPercent, formatTco2e } from './format'
import type { EmissionEntry } from './types'

export type GhgScope3Number = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

export type GhgBucket = {
  key: string
  scope: 'Scope 1' | 'Scope 2' | 'Scope 3' | 'Custom'
  code: string
  name: string
  plain: string
  materialForConstruction: boolean
}

export const GHG_SCOPE1: GhgBucket[] = [
  {
    key: 's1-stationary',
    scope: 'Scope 1',
    code: 'S1 · Stationary combustion',
    name: 'Stationary combustion',
    plain: 'Fuel burned in generators, heaters, explosives used in blasting, and other equipment that stays on site.',
    materialForConstruction: true,
  },
  {
    key: 's1-mobile',
    scope: 'Scope 1',
    code: 'S1 · Mobile combustion',
    name: 'Mobile combustion',
    plain: 'Fuel burned in company vehicles, haul trucks, drills, and owned plant that moves around.',
    materialForConstruction: true,
  },
  {
    key: 's1-fugitive',
    scope: 'Scope 1',
    code: 'S1 · Fugitive emissions',
    name: 'Fugitive emissions',
    plain: 'Refrigerant leaks and fugitive mine methane from ventilation or drained coal-mine gas.',
    materialForConstruction: true,
  },
]

export const GHG_SCOPE2: GhgBucket[] = [
  {
    key: 's2-electricity',
    scope: 'Scope 2',
    code: 'S2 · Purchased electricity',
    name: 'Purchased electricity',
    plain: 'Electricity bought for sites, mines, processing plants, depots, and offices.',
    materialForConstruction: true,
  },
  {
    key: 's2-heat',
    scope: 'Scope 2',
    code: 'S2 · Purchased heat and steam',
    name: 'Purchased heat and steam',
    plain: 'District heat or steam supplied to compounds, curing, or workshops.',
    materialForConstruction: false,
  },
]

export const GHG_SCOPE3: Array<GhgBucket & { category: GhgScope3Number }> = [
  {
    key: 's3-1',
    category: 1,
    scope: 'Scope 3',
    code: 'Category 1',
    name: 'Purchased goods and services',
    plain: 'Things you buy to do the work — materials, reagents such as lime, water, and bought-in services.',
    materialForConstruction: true,
  },
  {
    key: 's3-2',
    category: 2,
    scope: 'Scope 3',
    code: 'Category 2',
    name: 'Capital goods',
    plain: 'Long-lived assets you buy, such as plant, vehicles, or buildings.',
    materialForConstruction: true,
  },
  {
    key: 's3-3',
    category: 3,
    scope: 'Scope 3',
    code: 'Category 3',
    name: 'Fuel- and energy-related activities',
    plain: 'Emissions from producing the fuel and electricity you already counted in Scope 1 and 2 (well-to-tank).',
    materialForConstruction: true,
  },
  {
    key: 's3-4',
    category: 4,
    scope: 'Scope 3',
    code: 'Category 4',
    name: 'Upstream transportation and distribution',
    plain: 'Haulage of materials, equipment, ore, concentrate, and waste, including subcontracted logistics.',
    materialForConstruction: true,
  },
  {
    key: 's3-5',
    category: 5,
    scope: 'Scope 3',
    code: 'Category 5',
    name: 'Waste generated in operations',
    plain: 'Construction waste, demolition arisings, waste rock, tailings, and wastewater from site welfare.',
    materialForConstruction: true,
  },
  {
    key: 's3-6',
    category: 6,
    scope: 'Scope 3',
    code: 'Category 6',
    name: 'Business travel',
    plain: 'Staff flights, hotels, and taxis for work, not the daily commute.',
    materialForConstruction: true,
  },
  {
    key: 's3-7',
    category: 7,
    scope: 'Scope 3',
    code: 'Category 7',
    name: 'Employee commuting',
    plain: 'People travelling between home and work, including crew shuttles to remote sites, mines, and camps.',
    materialForConstruction: true,
  },
  {
    key: 's3-8',
    category: 8,
    scope: 'Scope 3',
    code: 'Category 8',
    name: 'Upstream leased assets',
    plain: 'Assets you lease from others, if not already in Scope 1 or 2.',
    materialForConstruction: false,
  },
  {
    key: 's3-9',
    category: 9,
    scope: 'Scope 3',
    code: 'Category 9',
    name: 'Downstream transportation and distribution',
    plain: 'Transport of products after they leave you, paid for by the customer.',
    materialForConstruction: false,
  },
  {
    key: 's3-10',
    category: 10,
    scope: 'Scope 3',
    code: 'Category 10',
    name: 'Processing of sold products',
    plain: 'Further processing of what you sell, by your customer.',
    materialForConstruction: false,
  },
  {
    key: 's3-11',
    category: 11,
    scope: 'Scope 3',
    code: 'Category 11',
    name: 'Use of sold products',
    plain: 'Energy used when customers use what you sold them.',
    materialForConstruction: false,
  },
  {
    key: 's3-12',
    category: 12,
    scope: 'Scope 3',
    code: 'Category 12',
    name: 'End-of-life treatment of sold products',
    plain: 'Disposal or recycling of products after the customer is finished with them.',
    materialForConstruction: false,
  },
  {
    key: 's3-13',
    category: 13,
    scope: 'Scope 3',
    code: 'Category 13',
    name: 'Downstream leased assets',
    plain: 'Assets you own and lease to others.',
    materialForConstruction: false,
  },
  {
    key: 's3-14',
    category: 14,
    scope: 'Scope 3',
    code: 'Category 14',
    name: 'Franchises',
    plain: 'Emissions from franchisees operating under your brand.',
    materialForConstruction: false,
  },
  {
    key: 's3-15',
    category: 15,
    scope: 'Scope 3',
    code: 'Category 15',
    name: 'Investments',
    plain: 'Emissions linked to investments you hold.',
    materialForConstruction: false,
  },
]

const INPUT_TO_BUCKET: Record<string, string> = {
  site_fuel: 's1-stationary',
  explosives: 's1-stationary',
  heavy_machinery: 's1-mobile',
  fleet: 's1-mobile',
  refrigerants: 's1-fugitive',
  mine_gas: 's1-fugitive',
  site_electricity: 's2-electricity',
  heat_steam: 's2-heat',
  bulk_materials: 's3-1',
  purchased_goods: 's3-1',
  water: 's3-1',
  road_freight: 's3-4',
  rail_freight: 's3-4',
  sea_freight: 's3-4',
  air_freight: 's3-4',
  subcontractor: 's3-4',
  waste: 's3-5',
  wastewater: 's3-5',
  business_travel: 's3-6',
  employee_commuting: 's3-7',
  crew_transport: 's3-7',
  energy_wtt: 's3-3',
}

const BUCKETS = [...GHG_SCOPE1, ...GHG_SCOPE2, ...GHG_SCOPE3]

function bucketForEntry(entry: EmissionEntry): string {
  if (entry.category === 'purchased_goods' && /capital/i.test(`${entry.details} ${entry.comment}`)) {
    return 's3-2'
  }
  if (entry.category === 'custom' || entry.scope === 'Custom') return 'custom'
  return INPUT_TO_BUCKET[entry.category] ?? 'custom'
}

export type InventoryRow = {
  key: string
  scope: string
  code: string
  name: string
  plain: string
  tco2e: number
  percent: number
  entries: number
  status: 'reported' | 'not-logged'
  materialForConstruction: boolean
}

export type InventorySummary = {
  total: number
  scope1: number
  scope2: number
  scope3: number
  custom: number
  entryCount: number
  rows: InventoryRow[]
  hotspots: InventoryRow[]
  gaps: InventoryRow[]
  bySite: { name: string; tco2e: number; percent: number }[]
  insights: string[]
}

export function summarizeInventory(entries: EmissionEntry[]): InventorySummary {
  const totals = new Map<string, { tco2e: number; entries: number }>()
  let custom = 0
  const siteTotals = new Map<string, number>()

  for (const entry of entries) {
    const key = bucketForEntry(entry)
    if (key === 'custom') {
      custom += entry.emissions_tco2e
    } else {
      const current = totals.get(key) ?? { tco2e: 0, entries: 0 }
      current.tco2e += entry.emissions_tco2e
      current.entries += 1
      totals.set(key, current)
    }
    const site = entry.site.trim() || 'Unassigned site'
    siteTotals.set(site, (siteTotals.get(site) ?? 0) + entry.emissions_tco2e)
  }

  const total = entries.reduce((sum, row) => sum + row.emissions_tco2e, 0)

  const rows: InventoryRow[] = BUCKETS.map((bucket) => {
    const value = totals.get(bucket.key) ?? { tco2e: 0, entries: 0 }
    return {
      key: bucket.key,
      scope: bucket.scope,
      code: bucket.code,
      name: bucket.name,
      plain: bucket.plain,
      tco2e: value.tco2e,
      percent: total > 0 ? (value.tco2e / total) * 100 : 0,
      entries: value.entries,
      status: value.tco2e > 0 ? 'reported' : 'not-logged',
      materialForConstruction: bucket.materialForConstruction,
    }
  })

  if (custom > 0) {
    rows.push({
      key: 'custom',
      scope: 'Custom',
      code: 'Custom',
      name: 'Custom activities',
      plain: 'Activities you logged with your own conversion value, outside the standard GHG categories.',
      tco2e: custom,
      percent: total > 0 ? (custom / total) * 100 : 0,
      entries: entries.filter((entry) => bucketForEntry(entry) === 'custom').length,
      status: 'reported',
      materialForConstruction: false,
    })
  }

  const scope1 = rows.filter((row) => row.scope === 'Scope 1').reduce((sum, row) => sum + row.tco2e, 0)
  const scope2 = rows.filter((row) => row.scope === 'Scope 2').reduce((sum, row) => sum + row.tco2e, 0)
  const scope3 = rows.filter((row) => row.scope === 'Scope 3').reduce((sum, row) => sum + row.tco2e, 0)

  const hotspots = [...rows].filter((row) => row.tco2e > 0).sort((a, b) => b.tco2e - a.tco2e).slice(0, 5)
  const gaps = GHG_SCOPE3.filter((bucket) => bucket.materialForConstruction)
    .map((bucket) => rows.find((row) => row.key === bucket.key)!)
    .filter((row) => row.status === 'not-logged')

  const bySite = [...siteTotals.entries()]
    .map(([name, tco2e]) => ({
      name,
      tco2e,
      percent: total > 0 ? (tco2e / total) * 100 : 0,
    }))
    .sort((a, b) => b.tco2e - a.tco2e)

  return {
    total,
    scope1,
    scope2,
    scope3,
    custom,
    entryCount: entries.length,
    rows,
    hotspots,
    gaps,
    bySite,
    insights: buildInsights({ total, scope1, scope2, scope3, hotspots, gaps, entryCount: entries.length }),
  }
}

function buildInsights(input: {
  total: number
  scope1: number
  scope2: number
  scope3: number
  hotspots: InventoryRow[]
  gaps: InventoryRow[]
  entryCount: number
}): string[] {
  if (input.entryCount === 0) {
    return [
      'No activity is logged yet. For a construction, mining, or logistics business, start with site electricity, site fuel, and bulk materials — those three usually explain most of the footprint. Mines should also log explosives and methane where they apply.',
      'You do not need to complete every GHG Protocol Scope 3 category. Categories 1, 4, 5, 6 and 7 are the usual priorities for this sector.',
    ]
  }

  const insights: string[] = []
  const s12 = input.scope1 + input.scope2
  const s3share = input.total > 0 ? (input.scope3 / input.total) * 100 : 0
  const s12share = input.total > 0 ? (s12 / input.total) * 100 : 0

  insights.push(
    `This organisation’s reported footprint is ${formatTco2e(input.total, true)} from ${input.entryCount} logged ${input.entryCount === 1 ? 'activity' : 'activities'}.`,
  )

  if (s3share >= 60) {
    insights.push(
      `Scope 3 is ${formatPercent(s3share, 0)} of the total. That is common in construction, mining, and logistics: most emissions sit in materials, freight, and waste rather than in fuel and electricity you buy yourself.`,
    )
  } else if (s12share >= 50) {
    insights.push(
      `Scope 1 and 2 are ${formatPercent(s12share, 0)} of the total — emissions you control more directly through fuel, plant, and electricity. Efficiency, fuel switching, and grid contracts will move this number.`,
    )
  } else {
    insights.push(
      `The split is Scope 1 ${pct(input.scope1, input.total)}, Scope 2 ${pct(input.scope2, input.total)}, and Scope 3 ${pct(input.scope3, input.total)}. Use Scope 1 and 2 for operational control, and Scope 3 for supply-chain action.`,
    )
  }

  if (input.hotspots[0]) {
    const top = input.hotspots[0]
    insights.push(
      `The largest source is ${top.code} ${top.name.toLowerCase()} at ${formatTco2e(top.tco2e, true)} (${formatPercent(top.percent, 0)} of the total). ${top.plain}`,
    )
  }

  if (input.gaps.length > 0) {
    const names = input.gaps.map((row) => `${row.code} (${row.name})`).join(', ')
    insights.push(
      `These usually-material Scope 3 categories still have no data: ${names}. Logging them will make a GHG Protocol or PPN 06/21 report more complete. Categories 8–15 are often not relevant for a typical contractor, miner, or logistics operator.`,
    )
  } else {
    insights.push(
      'The Scope 3 categories that usually matter for construction, mining, and logistics all have some data. Empty categories 8–15 can stay empty if you do not lease assets, sell products, operate franchises, or hold investments.',
    )
  }

  return insights
}

function pct(part: number, total: number) {
  return total > 0 ? formatPercent((part / total) * 100, 0) : '0%'
}

export function inputCategoryLabel(entry: EmissionEntry) {
  return getCategory(entry.category)?.name ?? entry.category
}
