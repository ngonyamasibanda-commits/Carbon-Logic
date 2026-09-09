import { isLocalOrganizationId } from './auth'
import { applyMeta, deleteEntryMeta, setEntryMeta } from './entry-meta'
import {
  CloudSaveError,
  PermissionDeniedError,
  RateLimitError,
  throwIfUnsafeToFallback,
} from './security-errors'
import { supabase } from './supabase'
import type { EmissionEntry } from './types'

const TABLE = 'emission_entries'

/** Identifies whose data this is. Both values come from the verified session. */
export type Tenant = { organizationId: string; userId: string }

function orgKey(organizationId: string) {
  return `carbon-logic-entries:${organizationId}`
}

function userKey(userId: string) {
  return `carbon-logic-entries:user:${userId}`
}

export { CloudSaveError, PermissionDeniedError, RateLimitError } from './security-errors'

type PostgrestLikeError = { message?: string; code?: string } | null

function extrasFrom(row: Partial<EmissionEntry>) {
  return {
    site: row.site ?? '',
    tags: row.tags ?? [],
    customFields: row.customFields ?? [],
    files: row.files ?? [],
  }
}

function fromRow(row: Record<string, unknown>): EmissionEntry {
  const organizationId = row.organization_id ?? row.organizationId
  return applyMeta({
    id: String(row.id),
    category: String(row.category ?? ''),
    scope: String(row.scope ?? ''),
    emissions_tco2e: Number(row.emissions_tco2e) || 0,
    details: String(row.details ?? ''),
    amount: row.amount == null ? null : Number(row.amount),
    unit: String(row.unit ?? ''),
    comment: String(row.comment ?? ''),
    link: String(row.link ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
    site: String(row.site ?? ''),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    customFields: Array.isArray(row.custom_fields)
      ? (row.custom_fields as EmissionEntry['customFields'])
      : [],
    files: [],
    organization_id: organizationId ? String(organizationId) : undefined,
  })
}

function asEntry(row: unknown): EmissionEntry | null {
  if (!row || typeof row !== 'object') return null
  return fromRow(row as Record<string, unknown>)
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function hydrate(rows: EmissionEntry[]): EmissionEntry[] {
  return rows.map((row) => applyMeta({ ...extrasFrom(row), ...row }))
}

function readOrgLocal(organizationId: string): EmissionEntry[] {
  return hydrate(readJson<EmissionEntry[]>(orgKey(organizationId), []))
}

function readUserBackup(userId: string): Record<string, EmissionEntry[]> {
  return readJson<Record<string, EmissionEntry[]>>(userKey(userId), {})
}

function uniqueById(rows: EmissionEntry[]): EmissionEntry[] {
  const map = new Map<string, EmissionEntry>()
  for (const row of rows) map.set(row.id, row)
  return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function persistOrg(tenant: Tenant, entries: EmissionEntry[]) {
  const tagged = entries.map((row) => ({
    ...row,
    organization_id: row.organization_id ?? tenant.organizationId,
  }))
  localStorage.setItem(orgKey(tenant.organizationId), JSON.stringify(tagged))
  const backup = readUserBackup(tenant.userId)
  backup[tenant.organizationId] = tagged
  localStorage.setItem(userKey(tenant.userId), JSON.stringify(backup))
}

function readMergedLocal(tenant: Tenant): EmissionEntry[] {
  const orgRows = readOrgLocal(tenant.organizationId)
  if (orgRows.length > 0) return orgRows
  return hydrate(readUserBackup(tenant.userId)[tenant.organizationId] ?? [])
}

/** Cloud rows for this organisation. Rows with no org tag are treated as this org (legacy). */
export function rowsForOrganization(rows: EmissionEntry[], organizationId: string): EmissionEntry[] {
  if (isLocalOrganizationId(organizationId)) return rows
  return rows.filter((row) => !row.organization_id || row.organization_id === organizationId)
}

/**
 * Combine the organisation's cloud inventory with this browser's unsynced drafts.
 * An empty cloud result must not wipe local work: that is how logout looked like a delete.
 */
export function mergeOrgInventory(
  remote: EmissionEntry[],
  local: EmissionEntry[],
  remoteOk: boolean,
): EmissionEntry[] {
  if (!remoteOk) return local
  if (remote.length === 0) return local
  const remoteIds = new Set(remote.map((row) => row.id))
  const unsynced = local.filter((row) => isUnsynced(row) && !remoteIds.has(row.id))
  return uniqueById([...unsynced, ...remote])
}

function upsertLocal(tenant: Tenant, entry: EmissionEntry) {
  persistOrg(
    tenant,
    uniqueById([entry, ...readMergedLocal(tenant)]),
  )
}

function replaceLocalId(tenant: Tenant, previousId: string, entry: EmissionEntry) {
  deleteEntryMeta(previousId)
  setEntryMeta(entry.id, extrasFrom(entry))
  persistOrg(
    tenant,
    uniqueById([
      entry,
      ...readMergedLocal(tenant).filter((row) => row.id !== previousId && row.id !== entry.id),
    ]),
  )
}

function removeLocal(tenant: Tenant, id: string) {
  deleteEntryMeta(id)
  persistOrg(
    tenant,
    readMergedLocal(tenant).filter((row) => row.id !== id),
  )
}

function isUnsynced(entry: EmissionEntry) {
  return entry.id.startsWith('local-') || entry.id.startsWith('pending-')
}

function isMissingRpc(error: PostgrestLikeError) {
  const message = (error?.message ?? '').toLowerCase()
  const code = error?.code ?? ''
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('could not find the function') ||
    message.includes('schema cache')
  )
}

function isMissingColumnError(error: PostgrestLikeError) {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  const code = error.code ?? ''
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (message.includes('schema cache') && message.includes('column')) ||
    (message.includes('could not find') && message.includes('column')) ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

function isNotNullViolation(error: PostgrestLikeError) {
  if (!error) return false
  return error.code === '23502' || (error.message ?? '').toLowerCase().includes('null value')
}

function insertMayHaveSucceeded(error: PostgrestLikeError) {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return (
    error.code === 'PGRST116' ||
    message.includes('cannot coerce') ||
    message.includes('0 rows') ||
    message.includes('multiple (or no) rows')
  )
}

function basePayload(input: Omit<EmissionEntry, 'id' | 'created_at'>) {
  return {
    category: input.category,
    scope: input.scope,
    emissions_tco2e: input.emissions_tco2e,
    details: input.details,
    amount: input.amount,
    unit: input.unit,
    comment: input.comment,
    link: input.link,
  }
}

function insertAttempts(tenant: Tenant, input: Omit<EmissionEntry, 'id' | 'created_at'>): Record<string, unknown>[] {
  const base = basePayload(input)
  if (isLocalOrganizationId(tenant.organizationId)) {
    return [
      { ...base, user_id: tenant.userId, owner_id: tenant.userId },
      { ...base, user_id: tenant.userId },
    ]
  }
  // Never save against the user alone: those rows vanish for other members and
  // are hidden by organisation RLS after logout.
  return [
    {
      ...base,
      organization_id: tenant.organizationId,
      owner_id: tenant.userId,
      user_id: tenant.userId,
    },
    {
      ...base,
      organization_id: tenant.organizationId,
      owner_id: tenant.userId,
    },
    { ...base, organization_id: tenant.organizationId },
  ]
}

async function insertViaRpc(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry | null> {
  const { data, error } = await supabase.rpc('log_emission_entry', {
    p_organization_id: isLocalOrganizationId(tenant.organizationId) ? null : tenant.organizationId,
    p_category: input.category,
    p_scope: input.scope,
    p_emissions_tco2e: input.emissions_tco2e,
    p_details: input.details,
    p_amount: input.amount,
    p_unit: input.unit,
    p_comment: input.comment,
    p_link: input.link,
  })
  if (error) {
    if (isMissingRpc(error)) return null
    throwIfUnsafeToFallback(error)
    return null
  }
  return asEntry(data)
}

async function insertRemote(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry | null> {
  const viaRpc = await insertViaRpc(tenant, input)
  if (viaRpc) return viaRpc

  let lastError: PostgrestLikeError = null
  for (const payload of insertAttempts(tenant, input)) {
    const { data, error } = await supabase.from(TABLE).insert(payload as never).select('*').single()
    if (!error && data) return fromRow(data as Record<string, unknown>)

    lastError = error
    throwIfUnsafeToFallback(error)

    if (insertMayHaveSucceeded(error)) {
      const remote = await fetchRemote(tenant)
      const match = remote.rows.find(
        (row) => row.category === input.category && row.details === input.details,
      )
      if (match) return match
      return {
        ...input,
        ...extrasFrom(input),
        id: `pending-${Date.now()}`,
        created_at: new Date().toISOString(),
      }
    }

    if (!isMissingColumnError(error) && !isNotNullViolation(error)) break
  }

  throwIfUnsafeToFallback(lastError)
  return null
}

async function listViaRpc(tenant: Tenant): Promise<{ rows: EmissionEntry[]; ok: boolean } | null> {
  const { data, error } = await supabase.rpc('list_emission_entries', {
    p_organization_id: isLocalOrganizationId(tenant.organizationId) ? null : tenant.organizationId,
  })
  if (error) {
    if (isMissingRpc(error)) return null
    return { rows: [], ok: false }
  }
  const raw = Array.isArray(data)
    ? data
    : typeof data === 'string'
      ? (JSON.parse(data) as unknown[])
      : data && typeof data === 'object' && Array.isArray(data)
        ? data
        : []
  return { rows: raw.map((row) => asEntry(row)).filter((row): row is EmissionEntry => Boolean(row)), ok: true }
}

async function queryRemote(
  tenant: Tenant,
  timeoutMs: number,
): Promise<{ data: Record<string, unknown>[] | null; error: PostgrestLikeError }> {
  const run = isLocalOrganizationId(tenant.organizationId)
    ? () => supabase.from(TABLE).select('*').order('created_at', { ascending: false })
    : () =>
        supabase
          .from(TABLE)
          .select('*')
          .eq('organization_id', tenant.organizationId)
          .order('created_at', { ascending: false })

  const result = await Promise.race([
    run(),
    new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), timeoutMs),
    ),
  ])
  if (!result.error && result.data) return { data: result.data as Record<string, unknown>[], error: null }
  return { data: null, error: result.error }
}

function scopedRemote(
  tenant: Tenant,
  rows: EmissionEntry[],
  ok: boolean,
): { rows: EmissionEntry[]; ok: boolean } {
  return { rows: rowsForOrganization(rows, tenant.organizationId), ok }
}

async function fetchRemote(tenant: Tenant): Promise<{ rows: EmissionEntry[]; ok: boolean }> {
  const viaRpc = await listViaRpc(tenant)
  if (viaRpc?.ok && viaRpc.rows.length > 0) return scopedRemote(tenant, viaRpc.rows, true)
  if (viaRpc?.ok) {
    const table = await queryRemote(tenant, 8000)
    if (!table.error && table.data && table.data.length > 0) {
      return scopedRemote(tenant, table.data.map((row) => fromRow(row)), true)
    }
    return scopedRemote(tenant, viaRpc.rows, true)
  }

  let result = await queryRemote(tenant, 8000)
  if (result.error?.message === 'timeout') {
    result = await queryRemote(tenant, 15000)
  }
  if (result.error || !result.data) return { rows: [], ok: false }
  return scopedRemote(tenant, result.data.map((row) => fromRow(row)), true)
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function insertRemoteWithRetry(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry | null> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const saved = await insertRemote(tenant, input)
      if (saved) return saved
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof PermissionDeniedError) throw error
      lastError = error
    }
    if (attempt < 2) await wait(400 * (attempt + 1))
  }
  if (lastError instanceof Error) throw lastError
  return null
}

/** True once the live database has the organisation inventory functions. */
export async function inventoryBackendReady(): Promise<boolean> {
  const { error } = await supabase.rpc('list_emission_entries')
  if (!error) return true
  return !isMissingRpc(error)
}

export async function pushLocalEntries(tenant: Tenant): Promise<number> {
  const unsynced = readMergedLocal(tenant).filter(isUnsynced)
  let pushed = 0
  for (const entry of unsynced) {
    const { id, created_at: _createdAt, ...input } = entry
    void _createdAt
    try {
      const saved = await insertRemote(tenant, input)
      if (saved) {
        replaceLocalId(tenant, id, applyMeta({ ...saved, ...extrasFrom(entry) }))
        pushed += 1
      }
    } catch {
      // Keep the local row; the next save or login will try again.
    }
  }
  return pushed
}

export async function fetchEntries(tenant: Tenant, category?: string): Promise<EmissionEntry[]> {
  await pushLocalEntries(tenant)
  const remote = await fetchRemote(tenant)
  const merged = mergeOrgInventory(remote.rows, readMergedLocal(tenant), remote.ok)
  if (remote.ok && (remote.rows.length > 0 || merged.length === 0)) {
    persistOrg(tenant, merged)
  }
  return category ? merged.filter((row) => row.category === category) : merged
}

export async function saveEntry(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry> {
  const extras = extrasFrom(input)
  const localEntry: EmissionEntry = {
    ...input,
    ...extras,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
    organization_id: isLocalOrganizationId(tenant.organizationId) ? undefined : tenant.organizationId,
  }
  setEntryMeta(localEntry.id, extras)
  upsertLocal(tenant, localEntry)

  if (isLocalOrganizationId(tenant.organizationId)) return localEntry

  try {
    const saved = await insertRemoteWithRetry(tenant, input)
    if (saved) {
      const entry = applyMeta({ ...saved, ...extras })
      replaceLocalId(tenant, localEntry.id, entry)
      return entry
    }
  } catch (error) {
    removeLocal(tenant, localEntry.id)
    if (error instanceof RateLimitError || error instanceof PermissionDeniedError) throw error
    throw new CloudSaveError()
  }
  removeLocal(tenant, localEntry.id)
  throw new CloudSaveError()
}

export async function deleteEntry(tenant: Tenant, id: string): Promise<void> {
  if (!id.startsWith('local-') && !id.startsWith('pending-')) {
    const numericId = Number(id)
    let deletedRemotely = false
    if (Number.isFinite(numericId)) {
      const { error: rpcError } = await supabase.rpc('delete_emission_entry', { p_id: numericId })
      if (!rpcError) deletedRemotely = true
      else if (!isMissingRpc(rpcError)) throwIfUnsafeToFallback(rpcError)
    }
    if (!deletedRemotely) {
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      throwIfUnsafeToFallback(error)
    }
  }
  removeLocal(tenant, id)
}

export function peekLocalEntries(tenant: Tenant): EmissionEntry[] {
  return readMergedLocal(tenant)
}

/** Test helper and org-cache writer: store this organisation's inventory locally. */
export function cacheOrgEntries(tenant: Tenant, entries: EmissionEntry[]) {
  persistOrg(tenant, entries)
}
