import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../lib/auth-context'
import { roleAllows } from '../lib/auth'
import { EntriesContext, type EntriesContextValue } from '../lib/entries-context'
import { FACTOR_CATALOG } from '../lib/factor-catalog'
import { saveSbtiConfig } from '../lib/targets-store'
import type { EmissionEntry, EmissionFactor } from '../lib/types'
import { OrgContext, type OrgContextValue } from '../providers/OrgProvider'
import {
  TOUR_ORG_ID,
  tourEntries,
  tourMembership,
  tourOrgProfile,
  tourOrganization,
  tourProfile,
  tourSites,
  tourUser,
} from './sample-data'

const noopAuth = async () => ({ error: null })

export default function DemoWorkspace({ children }: { children: ReactNode }) {
  useEffect(() => {
    saveSbtiConfig(
      {
        baseYear: 2025,
        targetYear: 2034,
        submissionYear: 2026,
        netZeroYear: 2050,
        useLiveInventory: true,
        baseScope1: null,
        baseScope2: null,
        baseScope3: null,
        mostRecentYear: 2026,
        recentScope1: null,
        recentScope2: null,
        recentScope3: null,
        scope3Ambition: 'WB2C',
        scope12Coverage: 100,
        scope3Coverage: 90,
        scope2Approach: 'location-based',
        renewableElectricityTarget: true,
        renewableShareBaseYear: 18,
        sellsFossilFuels: false,
      },
      TOUR_ORG_ID,
    )
  }, [])

  const [sites, setSites] = useState(tourSites)
  const [profile, setProfile] = useState(tourOrgProfile)
  const [entries, setEntries] = useState(tourEntries)
  const [factors, setFactors] = useState(
    () => new Map(FACTOR_CATALOG.map((factor) => [factor.key, factor])),
  )

  const auth = useMemo<AuthContextValue>(
    () => ({
      status: 'ready',
      session: null,
      user: tourUser,
      profile: tourProfile,
      organization: tourOrganization,
      memberships: [tourMembership],
      role: 'owner',
      can: (permission) => roleAllows('owner', permission),
      hasVerifiedMfa: true,
      lastSignOutReason: null,
      idleWarningSecondsLeft: null,
      keepSessionAlive: () => undefined,
      signInWithPassword: noopAuth,
      signInWithMagicLink: noopAuth,
      signInWithSso: noopAuth,
      signUpWithPassword: async () => ({ error: null, needsConfirmation: false }),
      requestPasswordReset: noopAuth,
      resendSignupConfirmation: noopAuth,
      signOut: async () => undefined,
      signOutEverywhere: async () => undefined,
      switchOrganization: () => undefined,
      createOrganization: noopAuth,
      deleteOrganization: noopAuth,
      canCreateOrganizations: false,
      reloadWorkspace: async () => undefined,
      refreshMfaState: async () => undefined,
    }),
    [],
  )

  const org = useMemo<OrgContextValue>(
    () => ({
      sites,
      profile,
      loading: false,
      error: null,
      addSite: async (site) => {
        const next = { ...site, id: `site-${crypto.randomUUID()}` }
        setSites((current) => [...current, next])
        return { error: null }
      },
      removeSite: async (id) => {
        setSites((current) => current.filter((site) => site.id !== id))
        return { error: null }
      },
      updateProfile: async (next) => {
        setProfile(next)
        return { error: null }
      },
      setYearLock: async (year, locked) => {
        setProfile((current) => ({
          ...current,
          lockedYears: locked
            ? [...new Set([...current.lockedYears, year])].sort((a, b) => a - b)
            : current.lockedYears.filter((item) => item !== year),
        }))
        return { error: null }
      },
    }),
    [profile, sites],
  )

  const inventory = useMemo<EntriesContextValue>(
    () => ({
      entries,
      factors,
      loading: false,
      error: null,
      refresh: async () => undefined,
      addEntry: async (input) => {
        const saved: EmissionEntry = {
          ...input,
          id: `entry-${crypto.randomUUID()}`,
          created_at: new Date().toISOString(),
          organization_id: TOUR_ORG_ID,
        }
        setEntries((current) => [saved, ...current])
      },
      removeEntry: async (id) => {
        setEntries((current) => current.filter((entry) => entry.id !== id))
      },
      saveFactors: async (next) => {
        setFactors(new Map(next.map((factor: EmissionFactor) => [factor.key, factor])))
      },
    }),
    [entries, factors],
  )

  return (
    <AuthContext.Provider value={auth}>
      <OrgContext.Provider value={org}>
        <EntriesContext.Provider value={inventory}>{children}</EntriesContext.Provider>
      </OrgContext.Provider>
    </AuthContext.Provider>
  )
}
