import { FACTOR_CATALOG } from './factor-catalog'
import { parseCsv } from './csv'
import { conversionToPerTonne, isTenantMaterialOverride } from './epd-materials'
import { readJson, writeJson } from './browser-storage'
import { throwIfUnsafeToFallback } from './security-errors'
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
  if (upper.includes('CEDA')) return 'EIO'
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
    method: partial.method,
    wttKey: partial.wttKey,
    tdKey: partial.tdKey,
    spendCurrency: partial.spendCurrency,
    fxGbpPerUsd: partial.fxGbpPerUsd,
    purchaserProducer: partial.purchaserProducer,
    priceIndex: partial.priceIndex,
    cedaCode: partial.cedaCode,
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

function localKey(organizationId?: string) {
  return organizationId ? `${LOCAL_KEY}:${organizationId}` : LOCAL_KEY
}

function deletedKey(organizationId?: string) {
  return organizationId ? `${DELETED_KEY}:${organizationId}` : DELETED_KEY
}

function readLocal(organizationId?: string): EmissionFactor[] {
  return readJson<EmissionFactor[]>(localKey(organizationId), []).map((row) => normalize(row))
}

function writeLocal(factors: EmissionFactor[], organizationId?: string) {
  writeJson(localKey(organizationId), factors)
}

function readDeleted(organizationId?: string): string[] {
  return readJson<string[]>(deletedKey(organizationId), [])
}

function writeDeleted(keys: string[], organizationId?: string) {
  writeJson(deletedKey(organizationId), [...new Set(keys)])
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
  deleted: string[] = [],
): Map<string, EmissionFactor> {
  const map = new Map<string, EmissionFactor>()
  for (const factor of catalog) map.set(factor.key, factor)
  for (const factor of [...remote, ...local]) {
    if (!isTenantMaterialOverride(factor)) continue
    if (preferStored(map.get(factor.key), factor)) {
      const published = map.get(factor.key)
      map.set(factor.key, {
        ...factor,
        method: factor.method ?? published?.method,
        wttKey: factor.wttKey ?? published?.wttKey,
        tdKey: factor.tdKey ?? published?.tdKey,
        spendCurrency: factor.spendCurrency ?? published?.spendCurrency,
        fxGbpPerUsd: factor.fxGbpPerUsd ?? published?.fxGbpPerUsd,
        purchaserProducer: factor.purchaserProducer ?? published?.purchaserProducer,
        priceIndex: factor.priceIndex ?? published?.priceIndex,
        cedaCode: factor.cedaCode ?? published?.cedaCode,
      })
    }
  }
  for (const key of deleted) map.delete(key)
  return map
}

export async function loadFactorLibrary(organizationId?: string): Promise<Map<string, EmissionFactor>> {
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
  return mergeFactorMaps(FACTOR_CATALOG, remote, readLocal(organizationId), readDeleted(organizationId))
}

function isOrgOverride(factor: EmissionFactor, catalog: Map<string, EmissionFactor>) {
  const published = catalog.get(factor.key)
  if (!published) return true
  return (
    published.conversionValue !== factor.conversionValue ||
    published.unit !== factor.unit ||
    published.source !== factor.source
  )
}

export async function persistFactors(
  factors: EmissionFactor[],
  organizationId?: string,
): Promise<void> {
  const catalog = new Map(FACTOR_CATALOG.map((factor) => [factor.key, factor]))
  const overrides = factors.filter((factor) => isOrgOverride(factor, catalog))
  writeLocal(overrides, organizationId)
  const kept = new Set(factors.map((factor) => factor.key))
  writeDeleted(
    [
      ...readDeleted(organizationId).filter((key) => !kept.has(key)),
      ...FACTOR_CATALOG.map((factor) => factor.key).filter((key) => !kept.has(key)),
    ],
    organizationId,
  )
  // Factors with no organisation are the shared published catalogue, which is
  // read-only from the app. Only an organisation's own overrides get written back.
  if (!organizationId) return

  const payload = overrides.map((factor) => ({
    activity_type: factor.key,
    co2e_factor: factor.conversionValue,
    unit: factor.unit,
    source: factor.sourceFamily ? `${factor.sourceFamily} — ${factor.source}` : factor.source,
    organization_id: organizationId,
  }))
  if (payload.length === 0) return
  const { error } = await supabase
    .from('emission_factors')
    .upsert(payload, { onConflict: 'activity_type,organization_id' })
  throwIfUnsafeToFallback(error)
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
      const declared = pick(row, 'declared_unit', 'declared_unit_on_epd', 'epd_unit', 'functional_unit')
      const gwpPrinted = Number(
        pick(row, 'gwp_a1_a3', 'gwp', 'gwp_total', 'a1_a3', 'kg_co2e'),
      )
      const direct = pick(row, 'conversion_value', 'co2e_factor', 'value', 'factor')
      const fromEpd = Number.isFinite(gwpPrinted) && gwpPrinted > 0 ? conversionToPerTonne(gwpPrinted, declared || 'kg') : null
      const value = direct && Number(direct) > 0 ? Number(direct) : fromEpd
      if (!key || value == null || !Number.isFinite(value) || value <= 0) return null
      const unitRaw = pick(row, 'unit')
      const unit = fromEpd && !(direct && Number(direct) > 0) ? 't' : unitRaw
      const source = pick(row, 'source', 'epd', 'epd_number') || 'Spreadsheet import'
      return normalize({
        key,
        name: pick(row, 'name', 'activity_type', 'product', 'product_name') || key,
        category: pick(row, 'category') || 'Imported',
        scope: (pick(row, 'scope') as Scope) || 'Custom',
        conversionValue: value,
        unit: unit || 't',
        sourceFamily: inferSourceFamily(pick(row, 'source_family', 'source') || source, 'User'),
        source,
        sourceUrl: pick(row, 'source_url', 'url', 'epd_url'),
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
