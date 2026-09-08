import { isLocalOrganizationId } from './auth'
import { applyMeta, deleteEntryMeta, setEntryMeta } from './entry-meta'
import { throwIfUnsafeToFallback } from './security-errors'
import { supabase } from './supabase'
import type { EmissionEntry } from './types'

const TABLE = 'emission_entries'

/** Identifies whose data this is. Both values come from the verified session. */
export type Tenant = { organizationId: string; userId: string }

// Namespaced per organisation so switching workspaces cannot show the wrong cache.
// Unsynced rows (ids starting with local-) are kept across sign-out until they
// reach the database, otherwise a failed cloud write looks like a successful save
// and then vanishes on the next login.
function localKey(organizationId: string) {
  return `carbon-logic-entries:${organizationId}`
}

/**
 * A refusal from Row Level Security or the organisation quota means the user
 * genuinely is not allowed to do this. Falling back to local storage would hide
 * that behind a fake success, so we only fall back for connectivity problems.
 */
export { PermissionDeniedError, RateLimitError } from './security-errors'

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
  })
}

function readLocal(organizationId: string): EmissionEntry[] {
  try {
    const raw = localStorage.getItem(localKey(organizationId))
    const rows = raw ? (JSON.parse(raw) as EmissionEntry[]) : []
    return rows.map((row) => applyMeta({ ...extrasFrom(row), ...row }))
  } catch {
    return []
  }
}

function writeLocal(organizationId: string, entries: EmissionEntry[]) {
  localStorage.setItem(localKey(organizationId), JSON.stringify(entries))
}

function upsertLocal(organizationId: string, entry: EmissionEntry) {
  writeLocal(organizationId, [entry, ...readLocal(organizationId).filter((row) => row.id !== entry.id)])
}

function replaceLocalId(organizationId: string, previousId: string, entry: EmissionEntry) {
  deleteEntryMeta(previousId)
  setEntryMeta(entry.id, extrasFrom(entry))
  writeLocal(organizationId, [
    entry,
    ...readLocal(organizationId).filter((row) => row.id !== previousId && row.id !== entry.id),
  ])
}

function isUnsynced(entry: EmissionEntry) {
  return entry.id.startsWith('local-')
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
    message.includes('does not exist')
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

function insertAttempts(tenant: Tenant, input: Omit<EmissionEntry, 'id' | 'created_at'>) {
  const base = basePayload(input)
  const extras = extrasFrom(input)
  const attempts: Record<string, unknown>[] = []
  if (!isLocalOrganizationId(tenant.organizationId)) {
    attempts.push({
      ...base,
      organization_id: tenant.organizationId,
      owner_id: tenant.userId,
      site: extras.site,
      tags: extras.tags,
      custom_fields: extras.customFields,
    })
    attempts.push({
      ...base,
      organization_id: tenant.organizationId,
      owner_id: tenant.userId,
    })
    attempts.push({
      ...base,
      organization_id: tenant.organizationId,
      owner_id: tenant.userId,
      user_id: tenant.userId,
    })
  }
  attempts.push({ ...base, user_id: tenant.userId })
  return attempts
}

async function insertRemote(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry | null> {
  let lastError: PostgrestLikeError = null

  for (const payload of insertAttempts(tenant, input)) {
    const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single()
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

async function queryRemote(
  tenant: Tenant,
  timeoutMs: number,
): Promise<{ data: Record<string, unknown>[] | null; error: PostgrestLikeError }> {
  const scoped = !isLocalOrganizationId(tenant.organizationId)
  const attempts = scoped
    ? [
        () =>
          supabase
            .from(TABLE)
            .select('*')
            .eq('organization_id', tenant.organizationId)
            .order('created_at', { ascending: false }),
        () =>
          supabase
            .from(TABLE)
            .select('*')
            .eq('user_id', tenant.userId)
            .order('created_at', { ascending: false }),
        () =>
          supabase
            .from(TABLE)
            .select('*')
            .eq('owner_id', tenant.userId)
            .order('created_at', { ascending: false }),
      ]
    : [
        () => supabase.from(TABLE).select('*').order('created_at', { ascending: false }),
      ]

  let lastError: PostgrestLikeError = { message: 'timeout' }
  let emptySuccess: Record<string, unknown>[] | null = null
  for (const run of attempts) {
    const result = await Promise.race([
      run(),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), timeoutMs),
      ),
    ])
    if (!result.error && result.data) {
      const rows = result.data as Record<string, unknown>[]
      if (rows.length > 0) return { data: rows, error: null }
      emptySuccess = rows
      continue
    }
    lastError = result.error
    if (result.error?.message === 'timeout') continue
    if (!isMissingColumnError(result.error) && !isNotNullViolation(result.error)) break
  }
  if (emptySuccess) return { data: emptySuccess, error: null }
  return { data: null, error: lastError }
}

async function fetchRemote(tenant: Tenant): Promise<{ rows: EmissionEntry[]; ok: boolean }> {
  let result = await queryRemote(tenant, 8000)
  if (result.error?.message === 'timeout') {
    result = await queryRemote(tenant, 15000)
  }
  if (result.error || !result.data) return { rows: [], ok: false }
  return { rows: result.data.map((row) => fromRow(row)), ok: true }
}

function mergeRemoteAndLocal(
  remote: EmissionEntry[],
  local: EmissionEntry[],
  remoteOk: boolean,
): EmissionEntry[] {
  if (!remoteOk) return local
  if (remote.length === 0) return local
  const remoteIds = new Set(remote.map((row) => row.id))
  const unsynced = local.filter((row) => isUnsynced(row) && !remoteIds.has(row.id))
  return [...unsynced, ...remote]
}

export async function pushLocalEntries(tenant: Tenant): Promise<void> {
  const local = readLocal(tenant.organizationId)
  const unsynced = local.filter(isUnsynced)
  if (unsynced.length === 0) return

  for (const entry of unsynced) {
    const { id, created_at: _createdAt, ...input } = entry
    void _createdAt
    try {
      const saved = await insertRemote(tenant, input)
      if (saved) replaceLocalId(tenant.organizationId, id, applyMeta({ ...saved, ...extrasFrom(entry) }))
    } catch {
      // Keep the local row; the next save or login will try again.
    }
  }
}

export async function fetchEntries(tenant: Tenant, category?: string): Promise<EmissionEntry[]> {
  await pushLocalEntries(tenant)
  const remote = await fetchRemote(tenant)
  const merged = mergeRemoteAndLocal(remote.rows, readLocal(tenant.organizationId), remote.ok).map(
    (row) => applyMeta({ ...extrasFrom(row), ...row }),
  )
  return category ? merged.filter((row) => row.category === category) : merged
}

export async function saveEntry(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry> {
  const extras = extrasFrom(input)
  const saved = await insertRemote(tenant, input)
  if (saved) {
    const entry = applyMeta({ ...saved, ...extras })
    setEntryMeta(entry.id, extras)
    upsertLocal(tenant.organizationId, entry)
    return entry
  }

  const entry: EmissionEntry = {
    ...input,
    ...extras,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  }
  setEntryMeta(entry.id, extras)
  upsertLocal(tenant.organizationId, entry)
  return entry
}

export async function deleteEntry(tenant: Tenant, id: string): Promise<void> {
  if (!id.startsWith('local-') && !id.startsWith('pending-')) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    throwIfUnsafeToFallback(error)
  }
  deleteEntryMeta(id)
  writeLocal(
    tenant.organizationId,
    readLocal(tenant.organizationId).filter((row) => row.id !== id),
  )
}
