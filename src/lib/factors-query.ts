import { monthsStale } from './factors-store'
import { SOURCE_FAMILIES, type EmissionFactor, type Scope, type SourceFamily } from './types'

export type FactorSortKey =
  | 'name'
  | 'key'
  | 'category'
  | 'scope'
  | 'conversionValue'
  | 'unit'
  | 'sourceFamily'
  | 'lastVerifiedAt'

export type FactorSortDir = 'asc' | 'desc'

export type FactorFreshness = 'all' | 'current' | 'stale' | 'placeholder'

export type FactorQuery = {
  search: string
  scope: 'all' | Scope | 'Custom'
  sourceFamily: 'all' | SourceFamily
  category: string
  region: string
  freshness: FactorFreshness
  sortKey: FactorSortKey
  sortDir: FactorSortDir
}

export const DEFAULT_FACTOR_QUERY: FactorQuery = {
  search: '',
  scope: 'all',
  sourceFamily: 'all',
  category: 'all',
  region: 'all',
  freshness: 'all',
  sortKey: 'name',
  sortDir: 'asc',
}

const SCOPE_RANK: Record<string, number> = {
  'Scope 1': 1,
  'Scope 2': 2,
  'Scope 3': 3,
  Custom: 4,
}

const NUMERIC_SORT: Partial<Record<FactorSortKey, boolean>> = {
  conversionValue: true,
  lastVerifiedAt: true,
}

export function factorSearchHaystack(factor: EmissionFactor): string {
  return [
    factor.name,
    factor.key,
    factor.category,
    factor.scope,
    factor.unit,
    factor.sourceFamily,
    factor.source,
    factor.sourceUrl,
    factor.region,
  ]
    .join(' ')
    .toLowerCase()
}

export function factorMatchesSearch(factor: EmissionFactor, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const haystack = factorSearchHaystack(factor)
  return q.split(/\s+/).every((token) => haystack.includes(token))
}

export function factorMatchesFilters(factor: EmissionFactor, query: FactorQuery): boolean {
  if (query.scope !== 'all' && factor.scope !== query.scope) return false
  if (query.sourceFamily !== 'all' && factor.sourceFamily !== query.sourceFamily) return false
  if (query.category !== 'all' && factor.category !== query.category) return false
  if (query.region !== 'all' && factor.region !== query.region) return false
  if (query.freshness === 'placeholder' && !factor.isPlaceholder) return false
  if (query.freshness === 'stale' && !monthsStale(factor) && !factor.isPlaceholder) return false
  if (query.freshness === 'current' && (monthsStale(factor) || factor.isPlaceholder)) return false
  return factorMatchesSearch(factor, query.search)
}

function compareFactors(a: EmissionFactor, b: EmissionFactor, key: FactorSortKey): number {
  if (key === 'conversionValue') return a.conversionValue - b.conversionValue
  if (key === 'scope') return (SCOPE_RANK[a.scope] ?? 9) - (SCOPE_RANK[b.scope] ?? 9)
  if (key === 'lastVerifiedAt') {
    return Date.parse(a.lastVerifiedAt || '') - Date.parse(b.lastVerifiedAt || '')
  }
  return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { sensitivity: 'base' })
}

export function sortFactors(
  factors: EmissionFactor[],
  sortKey: FactorSortKey,
  sortDir: FactorSortDir,
): EmissionFactor[] {
  const dir = sortDir === 'desc' ? -1 : 1
  return [...factors].sort((a, b) => {
    const delta = compareFactors(a, b, sortKey)
    if (delta !== 0) return delta * dir
    return a.key.localeCompare(b.key)
  })
}

export function queryFactors(factors: Iterable<EmissionFactor>, query: FactorQuery): EmissionFactor[] {
  const matched = [...factors].filter((factor) => factorMatchesFilters(factor, query))
  return sortFactors(matched, query.sortKey, query.sortDir)
}

export function uniqueSortedValues(factors: Iterable<EmissionFactor>, key: 'category' | 'region'): string[] {
  const set = new Set<string>()
  for (const factor of factors) {
    const value = factor[key]?.trim()
    if (value) set.add(value)
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export function factorQueryIsFiltered(query: FactorQuery): boolean {
  return (
    query.search.trim() !== '' ||
    query.scope !== 'all' ||
    query.sourceFamily !== 'all' ||
    query.category !== 'all' ||
    query.region !== 'all' ||
    query.freshness !== 'all'
  )
}

export function nextFactorSort(
  currentKey: FactorSortKey,
  currentDir: FactorSortDir,
  clicked: FactorSortKey,
): Pick<FactorQuery, 'sortKey' | 'sortDir'> {
  if (currentKey === clicked) {
    return { sortKey: clicked, sortDir: currentDir === 'asc' ? 'desc' : 'asc' }
  }
  return { sortKey: clicked, sortDir: NUMERIC_SORT[clicked] ? 'desc' : 'asc' }
}

export const FACTOR_SCOPE_FILTERS: Array<FactorQuery['scope']> = ['all', 'Scope 1', 'Scope 2', 'Scope 3', 'Custom']
export const FACTOR_SOURCE_FILTERS: Array<FactorQuery['sourceFamily']> = ['all', ...SOURCE_FAMILIES]
export const FACTOR_FRESHNESS_FILTERS: Array<[FactorFreshness, string]> = [
  ['all', 'All statuses'],
  ['current', 'Current'],
  ['stale', 'Stale or seed'],
  ['placeholder', 'Seed only'],
]
