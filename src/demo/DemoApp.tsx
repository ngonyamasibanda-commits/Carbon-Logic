/**
 * Dev-only tutorial harness.
 *
 * Mounts the real application shell and pages against an in-memory signed-in
 * workspace full of dummy construction data, so a walkthrough can be recorded
 * without a live account and without writing to the production database.
 * Reached at `/demo.html` under `npm run dev`; it is not part of the
 * production bundle, which is built from `index.html` only.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import AppShell from '../components/layout/AppShell'
import AccountPage from '../pages/AccountPage'
import AnalysisPage from '../pages/AnalysisPage'
import CategoryPage from '../pages/CategoryPage'
import CombinedResultsPage from '../pages/CombinedResultsPage'
import DashboardPage from '../pages/DashboardPage'
import DataInput from '../pages/DataInput'
import FactorsPage from '../pages/FactorsPage'
import FaqsPage from '../pages/FaqsPage'
import LearningHubPage from '../pages/LearningHubPage'
import OrganizationPage from '../pages/OrganizationPage'
import PeoplePage from '../pages/PeoplePage'
import SitesPage from '../pages/SitesPage'
import TargetsPage from '../pages/TargetsPage'
import TermsPage from '../pages/TermsPage'
import { AuthContext, type AuthContextValue } from '../lib/auth-context'
import { EntriesContext } from '../lib/entries-context'
import { OrgProvider } from '../providers/OrgProvider'
import type { EmissionEntry, EmissionFactor } from '../lib/types'
import MarketingReel from './MarketingReel'
import {
  DEMO_ENTRIES,
  DEMO_MEMBERSHIPS,
  DEMO_ORG,
  DEMO_PROFILE,
  demoFactors,
} from './demo-data'

const DEMO_USER = {
  id: DEMO_PROFILE.id,
  aud: 'authenticated',
  email: DEMO_PROFILE.email,
  app_metadata: {},
  user_metadata: { full_name: DEMO_PROFILE.fullName },
  created_at: '2023-01-09T09:00:00.000Z',
} as unknown as User

const DEMO_SESSION = {
  access_token: 'demo',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'demo',
  user: DEMO_USER,
} as unknown as Session

const ok = async () => ({ error: null })

function DemoAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      status: 'ready',
      session: DEMO_SESSION,
      user: DEMO_USER,
      profile: DEMO_PROFILE,
      organization: DEMO_ORG,
      memberships: DEMO_MEMBERSHIPS,
      role: 'owner',
      can: () => true,
      hasVerifiedMfa: true,
      lastSignOutReason: null,
      idleWarningSecondsLeft: null,
      keepSessionAlive: () => {},
      signInWithPassword: ok,
      signInWithMagicLink: ok,
      signInWithSso: ok,
      signUpWithPassword: async () => ({ error: null, needsConfirmation: false }),
      requestPasswordReset: ok,
      resendSignupConfirmation: ok,
      signOut: async () => {},
      signOutEverywhere: async () => {},
      switchOrganization: () => {},
      createOrganization: ok,
      deleteOrganization: ok,
      canCreateOrganizations: true,
      reloadWorkspace: async () => {},
      refreshMfaState: async () => {},
    }),
    [],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function DemoEntriesProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<EmissionEntry[]>(DEMO_ENTRIES)
  const [factors, setFactors] = useState<Map<string, EmissionFactor>>(() => demoFactors())

  const addEntry = useCallback(async (input: Omit<EmissionEntry, 'id' | 'created_at'>) => {
    setEntries((previous) => [
      { ...input, id: `demo-new-${previous.length}`, created_at: new Date().toISOString() },
      ...previous,
    ])
  }, [])

  const removeEntry = useCallback(async (id: string) => {
    setEntries((previous) => previous.filter((entry) => entry.id !== id))
  }, [])

  const saveFactors = useCallback(async (next: EmissionFactor[]) => {
    setFactors(new Map(next.map((factor) => [factor.key, factor])))
  }, [])

  const value = useMemo(
    () => ({
      entries,
      factors,
      loading: false,
      error: null,
      refresh: async () => {},
      addEntry,
      removeEntry,
      saveFactors,
    }),
    [entries, factors, addEntry, removeEntry, saveFactors],
  )

  return <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>
}

export default function DemoApp() {
  return (
    <DemoAuthProvider>
      <HashRouter>
        <Routes>
          <Route
            path="/reel"
            element={
              <OrgProvider>
                <DemoEntriesProvider>
                  <MarketingReel />
                </DemoEntriesProvider>
              </OrgProvider>
            }
          />
          <Route path="/terms" element={<TermsPage />} />
          <Route
            element={
              <OrgProvider>
                <DemoEntriesProvider>
                  <AppShell />
                </DemoEntriesProvider>
              </OrgProvider>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/input" element={<DataInput />} />
            <Route path="/input/:categoryId" element={<CategoryPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/combined" element={<CombinedResultsPage />} />
            <Route path="/faqs" element={<FaqsPage />} />
            <Route path="/learn" element={<LearningHubPage />} />
            <Route path="/sites" element={<SitesPage />} />
            <Route path="/facilities" element={<SitesPage />} />
            <Route path="/organization" element={<OrganizationPage />} />
            <Route path="/factors" element={<FactorsPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </DemoAuthProvider>
  )
}
