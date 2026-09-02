import { createContext, useContext } from 'react'
import type { EmissionEntry, EmissionFactor } from './types'

export type EntriesContextValue = {
  entries: EmissionEntry[]
  factors: Map<string, EmissionFactor>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  addEntry: (entry: Omit<EmissionEntry, 'id' | 'created_at'>) => Promise<void>
  removeEntry: (id: string) => Promise<void>
  saveFactors: (factors: EmissionFactor[]) => Promise<void>
}

export const EntriesContext = createContext<EntriesContextValue | null>(null)

export function useEntries() {
  const value = useContext(EntriesContext)
  if (!value) throw new Error('useEntries must be used within EntriesProvider')
  return value
}
