import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StatusBar, Style } from '@capacitor/status-bar'
import './index.css'
import App from './App.tsx'
import { isNative } from './lib/native'
import { initTelemetry } from './lib/telemetry'

initTelemetry('app')

if (isNative) {
  StatusBar.setStyle({ style: Style.Light }).catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
