import { applyMeta, deleteEntryMeta, setEntryMeta } from './entry-meta'
import { supabase } from './supabase'
import type { EmissionEntry } from './types'

const TABLE = 'emission_entries'
const USER_ID = 'default_user'
const LOCAL_KEY = 'carbon-logic-entries'

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

function readLocal(): EmissionEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const rows = raw ? (JSON.parse(raw) as EmissionEntry[]) : []
    return rows.map((row) => applyMeta({ ...extrasFrom(row), ...row }))
  } catch {
    return []
  }
}

function writeLocal(entries: EmissionEntry[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(entries))
}

export async function fetchEntries(category?: string): Promise<EmissionEntry[]> {
  const query = supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', USER_ID)
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

  const local = readLocal()
  return category ? local.filter((r) => r.category === category) : local
}

export async function saveEntry(input: Omit<EmissionEntry, 'id' | 'created_at'>): Promise<EmissionEntry> {
  const extras = extrasFrom(input)
  const payload = {
    user_id: USER_ID,
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

  const local = readLocal()
  const entry: EmissionEntry = {
    ...input,
    ...extras,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  }
  setEntryMeta(entry.id, extras)
  writeLocal([entry, ...local])
  return entry
}

export async function deleteEntry(id: string): Promise<void> {
  deleteEntryMeta(id)
  if (!id.startsWith('local-')) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (!error) return
  }
  writeLocal(readLocal().filter((row) => row.id !== id))
}
