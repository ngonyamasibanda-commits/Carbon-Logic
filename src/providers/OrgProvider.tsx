import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  loadOrders,
  loadProfile,
  loadSites,
  loadTeam,
  saveOrders,
  saveProfile,
  saveSites,
  saveTeam,
  type CreditOrder,
  type OrgProfile,
  type Site,
  type TeamMember,
} from '../lib/org'
import { useAuth } from '../lib/auth-context'

type OrgContextValue = {
  sites: Site[]
  team: TeamMember[]
  profile: OrgProfile
  orders: CreditOrder[]
  addSite: (site: Omit<Site, 'id'>) => void
  removeSite: (id: string) => void
  addMember: (member: Omit<TeamMember, 'id'>) => void
  removeMember: (id: string) => void
  updateProfile: (profile: OrgProfile) => void
  addOrder: (order: Omit<CreditOrder, 'id' | 'created_at'>) => void
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth()
  const orgId = organization?.id

  const [sites, setSites] = useState<Site[]>(() => loadSites(orgId))
  const [team, setTeam] = useState<TeamMember[]>(() => loadTeam(orgId))
  const [profile, setProfile] = useState<OrgProfile>(() => loadProfile(orgId))
  const [orders, setOrders] = useState<CreditOrder[]>(() => loadOrders(orgId))

  useEffect(() => {
    setSites(loadSites(orgId))
    setTeam(loadTeam(orgId))
    setProfile(loadProfile(orgId))
    setOrders(loadOrders(orgId))
  }, [orgId])

  const addSite = useCallback(
    (site: Omit<Site, 'id'>) => {
      setSites((prev) => {
        const next = [...prev, { ...site, id: `site-${Date.now()}` }]
        saveSites(next, orgId)
        return next
      })
    },
    [orgId],
  )

  const removeSite = useCallback(
    (id: string) => {
      setSites((prev) => {
        const next = prev.filter((site) => site.id !== id)
        saveSites(next, orgId)
        return next
      })
    },
    [orgId],
  )

  const addMember = useCallback(
    (member: Omit<TeamMember, 'id'>) => {
      setTeam((prev) => {
        const next = [...prev, { ...member, id: `user-${Date.now()}` }]
        saveTeam(next, orgId)
        return next
      })
    },
    [orgId],
  )

  const removeMember = useCallback(
    (id: string) => {
      setTeam((prev) => {
        const next = prev.filter((member) => member.id !== id)
        saveTeam(next, orgId)
        return next
      })
    },
    [orgId],
  )

  const updateProfile = useCallback(
    (next: OrgProfile) => {
      setProfile(next)
      saveProfile(next, orgId)
    },
    [orgId],
  )

  const addOrder = useCallback(
    (order: Omit<CreditOrder, 'id' | 'created_at'>) => {
      setOrders((prev) => {
        const next = [
          {
            ...order,
            id: `order-${Date.now()}`,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]
        saveOrders(next, orgId)
        return next
      })
    },
    [orgId],
  )

  const value = useMemo(
    () => ({
      sites,
      team,
      profile,
      orders,
      addSite,
      removeSite,
      addMember,
      removeMember,
      updateProfile,
      addOrder,
    }),
    [sites, team, profile, orders, addSite, removeSite, addMember, removeMember, updateProfile, addOrder],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg() {
  const value = useContext(OrgContext)
  if (!value) throw new Error('useOrg must be used within OrgProvider')
  return value
}
