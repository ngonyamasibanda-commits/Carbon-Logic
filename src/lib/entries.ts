import { isLocalOrganizationId } from './auth'
import { readJson, writeJson } from './browser-storage'
import { applyMeta, deleteEntryMeta, setEntryMeta } from './entry-meta'
import {
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
    files: [] as EmissionEntry['files'],
    activity_date: row.activity_date,
  }
}

function lightEntry(entry: EmissionEntry): EmissionEntry {
  return { ...entry, files: [] }
}

function fromRow(row: Record<string, unknown>): EmissionEntry {
  const organizationId = row.organization_id ?? row.organizationId
  const activityDate = row.activity_date ? String(row.activity_date).slice(0, 10) : undefined
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
    activity_date: activityDate,
    organization_id: organizationId ? String(organizationId) : undefined,
  })
}

function asEntry(row: unknown): EmissionEntry | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  return fromRow(row as Record<string, unknown>)
}

/** PostgREST may return a jsonb RPC result as an object, a JSON string, or a one-row array. */
export function parseRpcRow(data: unknown): EmissionEntry | null {
  let row: unknown = data
  if (typeof row === 'string') {
    try {
      row = JSON.parse(row) as unknown
    } catch {
      return null
    }
  }
  if (Array.isArray(row)) row = row[0]
  return asEntry(row)
}

function hydrate(rows: EmissionEntry[]): EmissionEntry[] {
  return rows.map((row) => applyMeta({ ...extrasFrom(row), ...row, files: [] }))
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
  const tagged = entries.map((row) =>
    lightEntry({
      ...row,
      organization_id: row.organization_id ?? tenant.organizationId,
    }),
  )
  const unsynced = tagged.filter(isUnsynced)
  if (!writeJson(orgKey(tenant.organizationId), tagged)) {
    writeJson(orgKey(tenant.organizationId), unsynced)
  }
  const backup = readUserBackup(tenant.userId)
  backup[tenant.organizationId] = unsynced
  writeJson(userKey(tenant.userId), backup)
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

function extrasPayload(input: Omit<EmissionEntry, 'id' | 'created_at'>) {
  return {
    site: input.site ?? '',
    tags: input.tags ?? [],
    custom_fields: input.customFields ?? [],
    activity_date: input.activity_date || null,
  }
}

function isRetryableInsertError(error: PostgrestLikeError) {
  if (!error) return false
  if (isMissingColumnError(error) || isNotNullViolation(error) || isMissingRpc(error)) return true
  const message = (error.message ?? '').toLowerCase()
  return (
    message.includes('malformed array') ||
    message.includes('invalid input syntax') ||
    message.includes('could not choose the best candidate') ||
    message.includes('function public.log_emission_entry')
  )
}

function insertAttempts(tenant: Tenant, input: Omit<EmissionEntry, 'id' | 'created_at'>): Record<string, unknown>[] {
  const base = basePayload(input)
  const extras = extrasPayload(input)
  const owner = { organization_id: tenant.organizationId, owner_id: tenant.userId }
  const ownerAndUser = { ...owner, user_id: tenant.userId }
  if (isLocalOrganizationId(tenant.organizationId)) {
    return [
      { ...base, ...extras, user_id: tenant.userId, owner_id: tenant.userId },
      { ...base, user_id: tenant.userId, owner_id: tenant.userId },
      { ...base, user_id: tenant.userId },
    ]
  }
  // Always include owner_id: RLS requires owner_id = auth.uid().
  // Include user_id on some attempts in case that legacy column is still NOT NULL.
  return [
    { ...base, ...extras, ...ownerAndUser },
    { ...base, ...extras, ...owner },
    { ...base, ...ownerAndUser },
    { ...base, ...owner },
  ]
}

function compactRpcArgs(tenant: Tenant, input: Omit<EmissionEntry, 'id' | 'created_at'>) {
  return {
    p_organization_id: isLocalOrganizationId(tenant.organizationId) ? null : tenant.organizationId,
    p_category: input.category,
    p_scope: input.scope,
    p_emissions_tco2e: input.emissions_tco2e,
    p_details: input.details,
    p_amount: input.amount,
    p_unit: input.unit,
    p_comment: input.comment,
    p_link: input.link,
  }
}

function fullRpcArgs(tenant: Tenant, input: Omit<EmissionEntry, 'id' | 'created_at'>) {
  return {
    ...compactRpcArgs(tenant, input),
    p_site: input.site ?? '',
    p_tags: input.tags ?? [],
    p_custom_fields: input.customFields ?? [],
    p_activity_date: input.activity_date || null,
  }
}

async function insertViaRpc(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry | null> {
  const full = await supabase.rpc('log_emission_entry', fullRpcArgs(tenant, input))
  if (!full.error) return parseRpcRow(full.data)

  throwIfUnsafeToFallback(full.error)
  if (!isMissingRpc(full.error) && !isRetryableInsertError(full.error)) {
    return null
  }

  // Live databases that never applied 0006 still have the 9-argument function.
  const compact = await supabase.rpc('log_emission_entry', compactRpcArgs(tenant, input))
  if (!compact.error) return parseRpcRow(compact.data)
  if (isMissingRpc(compact.error)) return null
  throwIfUnsafeToFallback(compact.error)
  return null
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

    if (!isRetryableInsertError(error)) break
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
    files: [],
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
    if (error instanceof RateLimitError || error instanceof PermissionDeniedError) {
      removeLocal(tenant, localEntry.id)
      throw error
    }
    console.warn('Organisation save failed; keeping the activity and retrying.', error)
    return localEntry
  }
  console.warn('Organisation save did not confirm; keeping the activity and retrying.')
  return localEntry
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
