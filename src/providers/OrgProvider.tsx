import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
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
  const [sites, setSites] = useState<Site[]>(() => loadSites())
  const [team, setTeam] = useState<TeamMember[]>(() => loadTeam())
  const [profile, setProfile] = useState<OrgProfile>(() => loadProfile())
  const [orders, setOrders] = useState<CreditOrder[]>(() => loadOrders())

  const addSite = useCallback((site: Omit<Site, 'id'>) => {
    setSites((prev) => {
      const next = [...prev, { ...site, id: `site-${Date.now()}` }]
      saveSites(next)
      return next
    })
  }, [])

  const removeSite = useCallback((id: string) => {
    setSites((prev) => {
      const next = prev.filter((site) => site.id !== id)
      saveSites(next)
      return next
    })
  }, [])

  const addMember = useCallback((member: Omit<TeamMember, 'id'>) => {
    setTeam((prev) => {
      const next = [...prev, { ...member, id: `user-${Date.now()}` }]
      saveTeam(next)
      return next
    })
  }, [])

  const removeMember = useCallback((id: string) => {
    setTeam((prev) => {
      const next = prev.filter((member) => member.id !== id)
      saveTeam(next)
      return next
    })
  }, [])

  const updateProfile = useCallback((next: OrgProfile) => {
    setProfile(next)
    saveProfile(next)
  }, [])

  const addOrder = useCallback((order: Omit<CreditOrder, 'id' | 'created_at'>) => {
    setOrders((prev) => {
      const next = [
        {
          ...order,
          id: `order-${Date.now()}`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]
      saveOrders(next)
      return next
    })
  }, [])

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
