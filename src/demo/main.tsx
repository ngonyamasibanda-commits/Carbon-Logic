import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DemoApp from './DemoApp'
import { seedDemoLocalStorage } from './demo-data'
import '../index.css'

seedDemoLocalStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
)
