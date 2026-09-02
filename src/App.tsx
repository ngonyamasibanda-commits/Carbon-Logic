import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import AnalysisPage from './pages/AnalysisPage'
import CategoryPage from './pages/CategoryPage'
import CombinedResultsPage from './pages/CombinedResultsPage'
import DashboardPage from './pages/DashboardPage'
import DataInput from './pages/DataInput'
import FactorsPage from './pages/FactorsPage'
import FaqsPage from './pages/FaqsPage'
import LearningHubPage from './pages/LearningHubPage'
import SitesPage from './pages/SitesPage'
import { EntriesProvider } from './providers/EntriesProvider'
import { OrgProvider } from './providers/OrgProvider'

export default function App() {
  return (
    <OrgProvider>
      <EntriesProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </EntriesProvider>
    </OrgProvider>
  )
}
