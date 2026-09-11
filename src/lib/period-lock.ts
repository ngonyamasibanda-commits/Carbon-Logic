import { entryActivityYear } from './entry-date'

export class LockedYearError extends Error {
  year: number
  constructor(year: number) {
    super(
      `Reporting year ${year} is closed. An administrator can reopen it from Organisation settings before activities can be changed.`,
    )
    this.name = 'LockedYearError'
    this.year = year
  }
}

export function isYearLocked(lockedYears: number[] | null | undefined, year: number): boolean {
  return Array.isArray(lockedYears) && lockedYears.includes(year)
}

export function yearFromIsoDate(iso: string | undefined, fallback = new Date().getFullYear()): number {
  if (!iso) return fallback
  const year = new Date(iso.slice(0, 10)).getFullYear()
  return Number.isFinite(year) ? year : fallback
}

export function assertYearUnlocked(
  lockedYears: number[] | null | undefined,
  isoDate: string | undefined,
): void {
  const year = yearFromIsoDate(isoDate)
  if (isYearLocked(lockedYears, year)) throw new LockedYearError(year)
}

export function entryYearIsLocked(
  lockedYears: number[] | null | undefined,
  entry: { activity_date?: string; created_at: string },
): boolean {
  return isYearLocked(lockedYears, entryActivityYear(entry))
}
