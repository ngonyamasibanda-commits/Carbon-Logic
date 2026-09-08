import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import MissingConfigPage from './pages/MissingConfigPage.tsx'
import { isSupabaseConfigured } from './lib/supabase'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isSupabaseConfigured ? <App /> : <MissingConfigPage />}</StrictMode>,
)
