import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './landing.css'
import { Terms } from './Terms'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Terms />
  </StrictMode>,
)
