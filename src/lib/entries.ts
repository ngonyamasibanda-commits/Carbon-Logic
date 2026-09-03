import { applyMeta, deleteEntryMeta, setEntryMeta } from './entry-meta'
import { supabase } from './supabase'
import type { EmissionEntry } from './types'

const TABLE = 'emission_entries'

/** Identifies whose data this is. Both values come from the verified session. */
export type Tenant = { organizationId: string; userId: string }

// Namespaced per organisation so switching workspaces cannot show the wrong cache,
// and cleared entirely on sign-out.
function localKey(organizationId: string) {
  return `carbon-logic-entries:${organizationId}`
}

/**
 * A refusal from Row Level Security means the user genuinely is not allowed to do
 * this. Falling back to local storage would hide that behind a fake success, so we
 * only fall back for connectivity problems.
 */
function isPermissionError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42501' || error.code === 'PGRST301') return true
  const message = (error.message ?? '').toLowerCase()
  return (
    message.includes('row-level security') ||
    message.includes('violates row level') ||
    message.includes('jwt') ||
    message.includes('permission denied')
  )
}

export class PermissionDeniedError extends Error {
  constructor(message = 'You do not have permission to change emissions data.') {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

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

export async function fetchEntries(tenant: Tenant, category?: string): Promise<EmissionEntry[]> {
  const query = supabase
    .from(TABLE)
    .select('*')
    .eq('organization_id', tenant.organizationId)
    .order('created_at', { ascending: false })
  const { data, error } = await Promise.race([
    query,
    new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 4000),
    ),
  ])

  if (!error && data) {
    const rows = data.map((row) => fromRow(row as Record<string, unknown>))
    return category ? rows.filter((r) => r.category === category) : rows
  }

  const local = readLocal(tenant.organizationId)
  return category ? local.filter((r) => r.category === category) : local
}

export async function saveEntry(
  tenant: Tenant,
  input: Omit<EmissionEntry, 'id' | 'created_at'>,
): Promise<EmissionEntry> {
  const extras = extrasFrom(input)
  const payload = {
    organization_id: tenant.organizationId,
    owner_id: tenant.userId,
    category: input.category,
    scope: input.scope,
    emissions_tco2e: input.emissions_tco2e,
    details: input.details,
    amount: input.amount,
    unit: input.unit,
    comment: input.comment,
    link: input.link,
  }

  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single()
  if (!error && data) {
    const saved = fromRow(data as Record<string, unknown>)
    setEntryMeta(saved.id, extras)
    return applyMeta({ ...saved, ...extras })
  }
  if (isPermissionError(error)) throw new PermissionDeniedError()

  const local = readLocal(tenant.organizationId)
  const entry: EmissionEntry = {
    ...input,
    ...extras,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  }
  setEntryMeta(entry.id, extras)
  writeLocal(tenant.organizationId, [entry, ...local])
  return entry
}

export async function deleteEntry(tenant: Tenant, id: string): Promise<void> {
  if (!id.startsWith('local-')) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (isPermissionError(error)) throw new PermissionDeniedError()
    if (!error) {
      deleteEntryMeta(id)
      return
    }
  }
  deleteEntryMeta(id)
  writeLocal(
    tenant.organizationId,
    readLocal(tenant.organizationId).filter((row) => row.id !== id),
  )
}
