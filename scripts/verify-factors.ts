/**
 * Search, filter, and sort behaviour for the emission factors table.
 *
 *   npm run verify:factors
 */
import { FACTOR_CATALOG } from '../src/lib/factor-catalog'
import {
  DEFAULT_FACTOR_QUERY,
  factorQueryIsFiltered,
  nextFactorSort,
  queryFactors,
  uniqueSortedValues,
  type FactorQuery,
} from '../src/lib/factors-query'
import type { EmissionFactor } from '../src/lib/types'

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

function query(overrides: Partial<FactorQuery>): FactorQuery {
  return { ...DEFAULT_FACTOR_QUERY, ...overrides }
}

const extra: EmissionFactor[] = [
  {
    key: 'user_custom_steel',
    name: 'EPD structural steel',
    category: 'Bulk materials',
    scope: 'Scope 3',
    conversionValue: 1.8,
    unit: 'kg',
    sourceFamily: 'User',
    source: 'Manufacturer EPD',
    sourceUrl: '',
    region: 'Germany',
    validFrom: '2020-01-01',
    lastVerifiedAt: '2020-01-01',
    isPlaceholder: false,
  },
  {
    key: 'seed_placeholder',
    name: 'Placeholder gas',
    category: 'Fuels',
    scope: 'Scope 1',
    conversionValue: 0,
    unit: 'kWh',
    sourceFamily: 'User',
    source: 'PLACEHOLDER seed',
    sourceUrl: '',
    region: 'United Kingdom',
    validFrom: '2019-01-01',
    lastVerifiedAt: '2019-01-01',
    isPlaceholder: true,
  },
]

const library = [...FACTOR_CATALOG, ...extra]

function main() {
  console.log('\nEmission factor search, filter, and sort\n')

  const diesel = queryFactors(library, query({ search: 'diesel' }))
  check('search finds diesel factors by name or key', diesel.length > 0 && diesel.every((row) => /diesel/i.test(`${row.name} ${row.key} ${row.source}`)))

  const tokens = queryFactors(library, query({ search: 'electricity DESNZ' }))
  check(
    'search requires every word to match',
    tokens.length > 0 &&
      tokens.every((row) => row.sourceFamily === 'DESNZ' && `${row.name} ${row.key} ${row.source}`.toLowerCase().includes('electricity')),
  )

  const scope1 = queryFactors(library, query({ scope: 'Scope 1' }))
  check(
    'scope filter keeps only that scope',
    scope1.length > 0 && scope1.every((row) => row.scope === 'Scope 1'),
  )

  const ice = queryFactors(library, query({ sourceFamily: 'ICE' }))
  check('source filter keeps only that publisher', ice.length > 0 && ice.every((row) => row.sourceFamily === 'ICE'))

  const germany = queryFactors(library, query({ region: 'Germany' }))
  check('region filter keeps only that region', germany.length === 1 && germany[0].key === 'user_custom_steel')

  const seed = queryFactors(library, query({ freshness: 'placeholder' }))
  check('freshness filter can show seed rows only', seed.length === 1 && seed[0].key === 'seed_placeholder')

  const byValue = queryFactors(library, query({ sortKey: 'conversionValue', sortDir: 'desc' }))
  check(
    'value sort descending puts the largest conversion first',
    byValue[0].conversionValue >= byValue[1].conversionValue,
  )

  const byName = queryFactors(library, query({ sortKey: 'name', sortDir: 'asc' }))
  check(
    'name sort is alphabetical',
    byName[0].name.localeCompare(byName[1].name, undefined, { sensitivity: 'base' }) <= 0,
  )

  const next = nextFactorSort('name', 'asc', 'name')
  check('clicking the active column reverses direction', next.sortKey === 'name' && next.sortDir === 'desc')

  const jump = nextFactorSort('name', 'asc', 'conversionValue')
  check('clicking value the first time sorts high to low', jump.sortKey === 'conversionValue' && jump.sortDir === 'desc')

  const categories = uniqueSortedValues(library, 'category')
  check('category options are unique and sorted', categories.length > 1 && categories[0] <= categories[1])

  check('an empty query is not treated as filtered', !factorQueryIsFiltered(DEFAULT_FACTOR_QUERY))
  check('a search counts as a filter', factorQueryIsFiltered(query({ search: 'steel' })))

  const none = queryFactors(library, query({ search: 'zzzz-no-such-factor' }))
  check('unmatched search returns no rows', none.length === 0)

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

main()
