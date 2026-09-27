import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './landing.css'
import { Privacy } from './Privacy'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Privacy />
  </StrictMode>,
)
