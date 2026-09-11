/**
 * Professional-plan inventory helpers: dual Scope 2, year-end close, completeness.
 *
 *   npm run verify:professional
 */
import { calculateTco2e } from '../src/lib/calculate'
import { completenessForYear } from '../src/lib/completeness'
import { PROFESSIONAL_PLAN } from '../src/lib/commercial'
import { LockedYearError, assertYearUnlocked, isYearLocked } from '../src/lib/period-lock'
import {
  customFieldsWithScope2,
  dualFromActivity,
  instrumentFromForm,
  parseScope2Meta,
  summarizeScope2,
} from '../src/lib/scope2'
import { auditorPackCsv, printSecrStatement, printPpnCarbonReductionPlan } from '../src/lib/export'
import type { EmissionEntry } from '../src/lib/types'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function entry(partial: Partial<EmissionEntry>): EmissionEntry {
  return {
    id: partial.id ?? '1',
    category: partial.category ?? 'site_fuel',
    scope: partial.scope ?? 'Scope 1',
    emissions_tco2e: partial.emissions_tco2e ?? 1,
    details: partial.details ?? '',
    amount: partial.amount ?? 1000,
    unit: partial.unit ?? 'kWh',
    comment: partial.comment ?? '',
    link: partial.link ?? '',
    created_at: partial.created_at ?? '2026-06-01T00:00:00.000Z',
    site: partial.site ?? 'Site A',
    tags: partial.tags ?? [],
    customFields: partial.customFields ?? [],
    files: [],
    activity_date: partial.activity_date ?? '2026-06-01',
    scope2: partial.scope2,
  }
}

console.log('\nProfessional inventory helpers\n')

check('workspace lists inventory capabilities without a public price', PROFESSIONAL_PLAN.includes.length >= 6)

const grid = 0.13096
const kwh = 10_000
const location = dualFromActivity({
  kwh,
  locationKg: grid,
  instrument: 'residual-mix',
  residualMixKg: 0,
})
check(
  'location-based 10,000 kWh uses DESNZ grid',
  Math.abs(location.meta.locationTco2e - calculateTco2e(kwh, grid)) < 1e-9,
)
check('missing residual mix falls back to location for market-based', location.residualMixMissing)
check(
  'REGO market-based electricity is zero while location-based stays on the grid',
  (() => {
    const dual = dualFromActivity({
      kwh,
      locationKg: grid,
      instrument: 'rego',
      residualMixKg: 0.4,
    })
    return dual.meta.marketTco2e === 0 && dual.meta.locationTco2e > 0
  })(),
)
check(
  'supplier-specific factor is used for market-based only',
  (() => {
    const dual = dualFromActivity({
      kwh,
      locationKg: grid,
      instrument: 'supplier-specific',
      residualMixKg: 0.4,
      supplierKg: 0.05,
    })
    return (
      Math.abs(dual.meta.marketTco2e - calculateTco2e(kwh, 0.05)) < 1e-9 &&
      Math.abs(dual.meta.locationTco2e - calculateTco2e(kwh, grid)) < 1e-9
    )
  })(),
)
check(
  'form labels map to instruments',
  instrumentFromForm('Purchased electricity', 'REGO or 100% renewable tariff') === 'rego' &&
    instrumentFromForm('On-site renewable electricity', '') === 'onsite-renewable',
)

const stored = customFieldsWithScope2([{ label: 'PO', value: '123' }], location.meta)
check('scope 2 meta is hidden behind an internal custom field', stored.some((field) => field.label === '_scope2'))
check('user custom fields are kept beside scope 2 meta', stored.some((field) => field.label === 'PO'))
check('scope 2 meta round-trips', parseScope2Meta(stored)?.kwh === kwh)

const electricity = entry({
  id: 'e1',
  category: 'site_electricity',
  scope: 'Scope 2',
  emissions_tco2e: location.meta.locationTco2e,
  amount: kwh,
  customFields: stored,
  link: 'https://example.com/bill',
})
const dual = summarizeScope2([electricity], 0, grid)
check('inventory dual totals read stored instruments', dual.locationTco2e > 0 && dual.marketTco2e > 0)

check('open years accept writes', !isYearLocked([2024], 2026))
let lockedThrew = false
try {
  assertYearUnlocked([2026], '2026-03-01')
} catch (error) {
  lockedThrew = error instanceof LockedYearError
}
check('closed years reject writes', lockedThrew)

const profile = {
  displayName: 'Acme',
  organisation: 'Acme',
  country: 'United Kingdom',
  intensityMetric: 'tCO2e per £m turnover',
  baselineYtdTco2e: 100,
  annualRevenue: 1_000_000,
  employeeCount: 40,
  reportingYear: 2026,
  lockedYears: [] as number[],
  residualMixKgPerKwh: 0,
}
const complete = completenessForYear({
  entries: [
    electricity,
    entry({ id: 'f', category: 'site_fuel', scope: 'Scope 1', activity_date: '2026-04-01', link: 'https://example.com/fuel' }),
    entry({ id: 'm', category: 'heavy_machinery', scope: 'Scope 1', activity_date: '2026-04-01', link: 'https://example.com/plant' }),
    entry({ id: 'b', category: 'bulk_materials', scope: 'Scope 3', activity_date: '2026-04-01', link: 'https://example.com/epd' }),
  ],
  sites: [{ id: 's', name: 'Site A', type: 'construction_site', region: 'UK' }],
  profile,
  year: 2026,
})
check('completeness scores a populated organisation above zero', complete.score > 0.4)
check('evidence share counts http links', complete.evidenceShare === 1)

const csv = auditorPackCsv([electricity], {
  organizationName: 'Acme',
  year: 2026,
  residualMixKg: 0,
  profile,
})
check('auditor pack CSV includes organisation and dual Scope 2 columns', csv.includes('Acme') && csv.includes('Scope2_market_tCO2e'))

const originalOpen = globalThis.window?.open
const opened: string[] = []
;(globalThis as { window?: { open: () => { document: { write: (html: string) => void; close: () => void }; focus: () => void; print: () => void } } }).window = {
  open: () => ({
    document: {
      write: (html: string) => {
        opened.push(html)
      },
      close: () => undefined,
    },
    focus: () => undefined,
    print: () => undefined,
  }),
}

printSecrStatement([electricity], { organizationName: 'Acme', year: 2026, revenue: 2_000_000, employeeCount: 10 })
printPpnCarbonReductionPlan([electricity], { organizationName: 'Acme', year: 2026, baselineTco2e: 50, netZeroYear: 2045 })
check('SECR statement names dual Scope 2', (opened[0] ?? '').includes('location-based') && (opened[0] ?? '').includes('market-based'))
check('PPN 06/21 plan includes a net-zero commitment and sign-off', (opened[1] ?? '').includes('Net Zero') && (opened[1] ?? '').includes('Signed on behalf'))

if (originalOpen) {
  ;(globalThis as { window: { open: typeof originalOpen } }).window.open = originalOpen
}

console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
