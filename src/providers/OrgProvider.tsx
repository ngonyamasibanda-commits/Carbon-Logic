import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createSite,
  deleteSite,
  emptyOrgProfile,
  fetchOrgSettings,
  fetchSites,
  saveOrgSettings,
  type OrgProfile,
  type Site,
} from '../lib/org'
import { useAuth } from '../lib/auth-context'

type OrgContextValue = {
  sites: Site[]
  profile: OrgProfile
  loading: boolean
  error: string | null
  addSite: (site: Omit<Site, 'id'>) => Promise<{ error: string | null }>
  removeSite: (id: string) => Promise<{ error: string | null }>
  updateProfile: (profile: OrgProfile) => Promise<{ error: string | null }>
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth()
  const orgId = organization?.id
  const orgName = organization?.name ?? ''

  const [sites, setSites] = useState<Site[]>([])
  const [profile, setProfile] = useState<OrgProfile>(() => emptyOrgProfile(orgName))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) {
      setSites([])
      setProfile(emptyOrgProfile())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      const [nextSites, settings] = await Promise.all([
        fetchSites(orgId),
        fetchOrgSettings(orgId, orgName),
      ])
      if (cancelled) return
      setSites(nextSites)
      setProfile({ ...settings.profile, organisation: orgName || settings.profile.organisation })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [orgId, orgName])

  const addSite = useCallback(
    async (site: Omit<Site, 'id'>) => {
      if (!orgId) return { error: 'No active organisation' }
      const result = await createSite(orgId, site)
      if (result.site) {
        setSites((prev) => [...prev.filter((row) => row.id !== result.site!.id), result.site!])
        setError(null)
      } else {
        setError(result.error)
      }
      return { error: result.error }
    },
    [orgId],
  )

  const removeSite = useCallback(
    async (id: string) => {
      if (!orgId) return { error: 'No active organisation' }
      const result = await deleteSite(orgId, id)
      if (!result.error) {
        setSites((prev) => prev.filter((site) => site.id !== id))
        setError(null)
      } else {
        setError(result.error)
      }
      return result
    },
    [orgId],
  )

  const updateProfile = useCallback(
    async (next: OrgProfile) => {
      if (!orgId) return { error: 'No active organisation' }
      setProfile(next)
      const result = await saveOrgSettings(orgId, next)
      if (result.error) setError(result.error)
      else setError(null)
      return result
    },
    [orgId],
  )

  const value = useMemo(
    () => ({
      sites,
      profile,
      loading,
      error,
      addSite,
      removeSite,
      updateProfile,
    }),
    [sites, profile, loading, error, addSite, removeSite, updateProfile],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const value = useContext(OrgContext)
  if (!value) throw new Error('useOrg must be used within OrgProvider')
  return value
}
