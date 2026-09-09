import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadFactors } from '../lib/calculate'
import {
  deleteEntry,
  fetchEntries,
  peekLocalEntries,
  pushLocalEntries,
  saveEntry,
  type Tenant,
} from '../lib/entries'
import { FACTOR_CATALOG } from '../lib/factor-catalog'
import { persistFactors } from '../lib/factors-store'
import { EntriesContext } from '../lib/entries-context'
import { isLocalOrganizationId } from '../lib/auth'
import { useAuth } from '../lib/auth-context'
import type { EmissionEntry, EmissionFactor } from '../lib/types'

export function EntriesProvider({ children }: { children: ReactNode }) {
  const { organization, user } = useAuth()
  const [entries, setEntries] = useState<EmissionEntry[]>([])
  const [factors, setFactors] = useState<Map<string, EmissionFactor>>(
    () => new Map(FACTOR_CATALOG.map((factor) => [factor.key, factor])),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tenant = useMemo<Tenant | null>(
    () =>
      organization && user ? { organizationId: organization.id, userId: user.id } : null,
    [organization, user],
  )

  const refresh = useCallback(async () => {
    if (!tenant) return
    setLoading(true)
    setError(null)
    try {
      const nextFactors = await loadFactors()
      setFactors(nextFactors)
      const nextEntries = await fetchEntries(tenant)
      setEntries(nextEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [tenant])

  // Switching organisation must not leave the previous tenant's rows on screen,
  // but show this user's cached rows immediately so a slow or failed cloud fetch
  // cannot look like the work was deleted.
  useEffect(() => {
    if (!tenant) {
      setEntries([])
      return
    }
    setEntries(peekLocalEntries(tenant))
    void refresh()
  }, [refresh, tenant])

  useEffect(() => {
    if (!tenant || isLocalOrganizationId(tenant.organizationId)) return
    const tick = () => {
      void pushLocalEntries(tenant).then((pushed) => {
        if (pushed > 0) void refresh()
      })
    }
    const id = window.setInterval(tick, 20000)
    return () => window.clearInterval(id)
  }, [refresh, tenant])

  const addEntry = useCallback(
    async (input: Omit<EmissionEntry, 'id' | 'created_at'>) => {
      if (!tenant) throw new Error('No active organisation')
      const saved = await saveEntry(tenant, input)
      setEntries((prev) => [saved, ...prev])
    },
    [tenant],
  )

  const removeEntry = useCallback(
    async (id: string) => {
      if (!tenant) throw new Error('No active organisation')
      await deleteEntry(tenant, id)
      setEntries((prev) => prev.filter((row) => row.id !== id))
    },
    [tenant],
  )

  const saveFactors = useCallback(
    async (next: EmissionFactor[]) => {
      await persistFactors(
        next,
        organization && !isLocalOrganizationId(organization.id) ? organization.id : undefined,
      )
      setFactors(new Map(next.map((factor) => [factor.key, factor])))
    },
    [organization],
  )

  const value = useMemo(
    () => ({ entries, factors, loading, error, refresh, addEntry, removeEntry, saveFactors }),
    [entries, factors, loading, error, refresh, addEntry, removeEntry, saveFactors],
  )

  return <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>
}
