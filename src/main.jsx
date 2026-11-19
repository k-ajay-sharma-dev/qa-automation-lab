import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { startSync } from './sync/status.js'
import { ThemeProvider } from './theme.jsx'
import './styles.css'
import './practice.css'
import './qa.css'

// Cloud sync loads in the background once the first screen has drawn; the site never waits for it.
const whenIdle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 300))
whenIdle(startSync, { timeout: 2000 })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
