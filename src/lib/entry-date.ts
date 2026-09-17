import type { EmissionEntry } from './types'

/** Calendar date this activity belongs to (reporting period), not when it was typed in. */
export function entryActivityDate(entry: Pick<EmissionEntry, 'activity_date' | 'created_at'>): string {
  const raw = entry.activity_date || entry.created_at || ''
  return raw.slice(0, 10)
}

export function entryActivityYear(entry: Pick<EmissionEntry, 'activity_date' | 'created_at'>): number {
  const year = new Date(entryActivityDate(entry)).getFullYear()
  return Number.isFinite(year) ? year : new Date().getFullYear()
}

export function entryActivityMonth(entry: Pick<EmissionEntry, 'activity_date' | 'created_at'>): string {
  return entryActivityDate(entry).slice(0, 7)
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}
