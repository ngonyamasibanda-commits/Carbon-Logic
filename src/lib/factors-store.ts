import { FACTOR_CATALOG } from './factor-catalog'
import { parseCsv } from './csv'
import { supabase } from './supabase'
import { SOURCE_FAMILIES, type EmissionFactor, type Scope, type SourceFamily } from './types'

const LOCAL_KEY = 'carbon-logic-factors'
const DELETED_KEY = 'carbon-logic-factors-deleted'

function isPlaceholder(source: string) {
  const text = source.toUpperCase()
  return text.includes('PLACEHOLDER') || text.includes('SEED')
}

function inferSourceFamily(source: string, fallback: SourceFamily = 'User'): SourceFamily {
  const upper = source.toUpperCase()
  for (const family of SOURCE_FAMILIES) {
    if (family !== 'User' && (upper.startsWith(family) || upper.includes(`${family} `) || upper.includes(`/${family}`))) {
      return family
    }
  }
  return fallback
}

function normalize(partial: Partial<EmissionFactor> & { key: string }): EmissionFactor {
  const source = partial.source ?? 'User-updated'
  return {
    key: partial.key,
    name: partial.name ?? partial.key,
    category: partial.category ?? 'Custom',
    scope: partial.scope ?? 'Custom',
    conversionValue: Number(partial.conversionValue) || 0,
    unit: partial.unit ?? '',
    sourceFamily: partial.sourceFamily ?? inferSourceFamily(source),
    source,
    sourceUrl: partial.sourceUrl ?? '',
    region: partial.region ?? 'United Kingdom',
    validFrom: partial.validFrom ?? new Date().toISOString().slice(0, 10),
    lastVerifiedAt: partial.lastVerifiedAt ?? new Date().toISOString().slice(0, 10),
    isPlaceholder: partial.isPlaceholder ?? isPlaceholder(source),
  }
}

function fromSupabaseRow(row: Record<string, unknown>): EmissionFactor | null {
  const key = String(row.activity_type ?? row.key ?? row.name ?? '')
  const value = Number(row.co2e_factor ?? row.conversion_value ?? row.value)
  if (!key || !Number.isFinite(value)) return null
  return normalize({
    key,
    name: String(row.name ?? key),
    category: String(row.category ?? 'Imported'),
    scope: (String(row.scope ?? 'Custom') as Scope) || 'Custom',
    conversionValue: value,
    unit: String(row.unit ?? ''),
    sourceFamily: inferSourceFamily(String(row.source ?? '')),
    source: String(row.source ?? ''),
    sourceUrl: String(row.source_url ?? ''),
    region: String(row.region ?? ''),
    validFrom: String(row.valid_from ?? ''),
    lastVerifiedAt: String(row.last_verified_at ?? ''),
  })
}

function readLocal(): EmissionFactor[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const rows = JSON.parse(raw) as EmissionFactor[]
    return rows.map((row) => normalize(row))
  } catch {
    return []
  }
}

function writeLocal(factors: EmissionFactor[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(factors))
}

function readDeleted(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeDeleted(keys: string[]) {
  localStorage.setItem(DELETED_KEY, JSON.stringify([...new Set(keys)]))
}

function preferStored(catalog: EmissionFactor | undefined, stored: EmissionFactor): boolean {
  if (!catalog) return true
  if (stored.isPlaceholder && !catalog.isPlaceholder) return false
  const catalogTime = Date.parse(catalog.lastVerifiedAt)
  const storedTime = Date.parse(stored.lastVerifiedAt)
  if (Number.isNaN(storedTime)) return false
  if (Number.isNaN(catalogTime)) return true
  return storedTime > catalogTime
}

export function mergeFactorMaps(
  catalog: EmissionFactor[],
  remote: EmissionFactor[],
  local: EmissionFactor[],
): Map<string, EmissionFactor> {
  const map = new Map<string, EmissionFactor>()
  for (const factor of catalog) map.set(factor.key, factor)
  for (const factor of [...remote, ...local]) {
    if (preferStored(map.get(factor.key), factor)) map.set(factor.key, factor)
  }
  for (const key of readDeleted()) map.delete(key)
  return map
}

export async function loadFactorLibrary(): Promise<Map<string, EmissionFactor>> {
  let remote: EmissionFactor[] = []
  try {
    const result = await Promise.race([
      supabase.from('emission_factors').select('*'),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 4000),
      ),
    ])
    if (!result.error && result.data) {
      remote = result.data
        .map((row) => fromSupabaseRow(row as Record<string, unknown>))
        .filter((row): row is EmissionFactor => Boolean(row))
    }
  } catch {
    remote = []
  }
  return mergeFactorMaps(FACTOR_CATALOG, remote, readLocal())
}

export async function persistFactors(factors: EmissionFactor[]): Promise<void> {
  writeLocal(factors)
  const kept = new Set(factors.map((factor) => factor.key))
  writeDeleted([
    ...readDeleted().filter((key) => !kept.has(key)),
    ...FACTOR_CATALOG.map((factor) => factor.key).filter((key) => !kept.has(key)),
  ])
  const payload = factors.map((factor) => ({
    activity_type: factor.key,
    co2e_factor: factor.conversionValue,
    unit: factor.unit,
    source: factor.sourceFamily ? `${factor.sourceFamily} — ${factor.source}` : factor.source,
  }))
  void supabase.from('emission_factors').upsert(payload, { onConflict: 'activity_type' })
}

export function factorsToCsv(factors: EmissionFactor[]) {
  const header = [
    'key',
    'name',
    'category',
    'scope',
    'conversion_value',
    'unit',
    'source_family',
    'source',
    'source_url',
    'region',
    'valid_from',
    'last_verified_at',
  ]
  const rows = factors.map((factor) =>
    [
      factor.key,
      factor.name,
      factor.category,
      factor.scope,
      factor.conversionValue,
      factor.unit,
      factor.sourceFamily,
      factor.source,
      factor.sourceUrl,
      factor.region,
      factor.validFrom,
      factor.lastVerifiedAt,
    ]
      .map((value) => {
        const text = String(value ?? '')
        return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
      })
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

function pick(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(row).find((header) => header.toLowerCase().replace(/\s+/g, '_') === key)
    if (match && row[match]) return row[match]
  }
  return ''
}

export function parseFactorSpreadsheet(text: string): EmissionFactor[] {
  const rows = parseCsv(text)
  return rows
    .map((row) => {
      const key = pick(row, 'key', 'activity_type', 'name', 'activity')
      const value = Number(pick(row, 'conversion_value', 'co2e_factor', 'value', 'factor'))
      if (!key || !Number.isFinite(value)) return null
      return normalize({
        key,
        name: pick(row, 'name', 'activity_type') || key,
        category: pick(row, 'category') || 'Imported',
        scope: (pick(row, 'scope') as Scope) || 'Custom',
        conversionValue: value,
        unit: pick(row, 'unit'),
        sourceFamily: inferSourceFamily(pick(row, 'source_family', 'source') || 'User'),
        source: pick(row, 'source') || 'Spreadsheet import',
        sourceUrl: pick(row, 'source_url', 'url'),
        region: pick(row, 'region'),
        validFrom: pick(row, 'valid_from'),
        lastVerifiedAt: pick(row, 'last_verified_at', 'verified'),
      })
    })
    .filter((row): row is EmissionFactor => Boolean(row))
}

export function monthsStale(factor: EmissionFactor) {
  const verified = Date.parse(factor.lastVerifiedAt)
  if (Number.isNaN(verified)) return true
  return Date.now() - verified > 1000 * 60 * 60 * 24 * 365
}
