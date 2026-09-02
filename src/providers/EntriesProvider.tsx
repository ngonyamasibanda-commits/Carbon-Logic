import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadFactors } from '../lib/calculate'
import { deleteEntry, fetchEntries, saveEntry } from '../lib/entries'
import { FACTOR_CATALOG } from '../lib/factor-catalog'
import { persistFactors } from '../lib/factors-store'
import { EntriesContext } from '../lib/entries-context'
import type { EmissionEntry, EmissionFactor } from '../lib/types'

export function EntriesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<EmissionEntry[]>([])
  const [factors, setFactors] = useState<Map<string, EmissionFactor>>(
    () => new Map(FACTOR_CATALOG.map((factor) => [factor.key, factor])),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextFactors = await loadFactors()
      setFactors(nextFactors)
      const nextEntries = await fetchEntries()
      setEntries(nextEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addEntry = useCallback(async (input: Omit<EmissionEntry, 'id' | 'created_at'>) => {
    const saved = await saveEntry(input)
    setEntries((prev) => [saved, ...prev])
  }, [])

  const removeEntry = useCallback(async (id: string) => {
    await deleteEntry(id)
    setEntries((prev) => prev.filter((row) => row.id !== id))
  }, [])

  const saveFactors = useCallback(async (next: EmissionFactor[]) => {
    await persistFactors(next)
    setFactors(new Map(next.map((factor) => [factor.key, factor])))
  }, [])

  const value = useMemo(
    () => ({ entries, factors, loading, error, refresh, addEntry, removeEntry, saveFactors }),
    [entries, factors, loading, error, refresh, addEntry, removeEntry, saveFactors],
  )

  return <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>
}
