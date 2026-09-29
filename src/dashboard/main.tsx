import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './dashboard.css'
import { Dashboard } from './Dashboard'
import { initTelemetry } from '../lib/telemetry'

initTelemetry('dashboard')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
)
