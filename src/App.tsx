import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import AuthGate from './components/auth/AuthGate'
import RequireRole from './components/auth/RequireRole'
import AccountPage from './pages/AccountPage'
import AnalysisPage from './pages/AnalysisPage'
import CategoryPage from './pages/CategoryPage'
import CombinedResultsPage from './pages/CombinedResultsPage'
import DashboardPage from './pages/DashboardPage'
import DataInput from './pages/DataInput'
import FactorsPage from './pages/FactorsPage'
import FaqsPage from './pages/FaqsPage'
import LearningHubPage from './pages/LearningHubPage'
import PeoplePage from './pages/PeoplePage'
import SitesPage from './pages/SitesPage'
import TargetsPage from './pages/TargetsPage'
import TermsPage from './pages/TermsPage'
import AuthCallbackPage from './pages/auth/AuthCallbackPage'
import LoginPage from './pages/auth/LoginPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import { AuthProvider } from './providers/AuthProvider'
import { EntriesProvider } from './providers/EntriesProvider'
import { OrgProvider } from './providers/OrgProvider'
import { useAuth } from './lib/auth-context'

function SignedOutOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return null
  if (status !== 'signed-out') return <Navigate to="/" replace />
  return <>{children}</>
}

function ProtectedShell() {
  return (
    <AuthGate>
      <OrgProvider>
        <EntriesProvider>
          <AppShell />
        </EntriesProvider>
      </OrgProvider>
    </AuthGate>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <SignedOutOnly>
                <LoginPage />
              </SignedOutOnly>
            }
          />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />

          <Route element={<ProtectedShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/input" element={<DataInput />} />
            <Route path="/input/:categoryId" element={<CategoryPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/combined" element={<CombinedResultsPage />} />
            <Route path="/faqs" element={<FaqsPage />} />
            <Route path="/learn" element={<LearningHubPage />} />
            <Route path="/sites" element={<SitesPage />} />
            <Route path="/facilities" element={<SitesPage />} />
            <Route path="/factors" element={<FactorsPage />} />
            <Route path="/targets" element={<TargetsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route
              path="/people"
              element={
                <RequireRole permission="members:manage">
                  <PeoplePage />
                </RequireRole>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
