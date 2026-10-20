import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './styles/globals.css'
import { initWebVitals } from './utils/performance'

// Initialize web vitals monitoring (development + production)
const cleanupVitals = initWebVitals((data) => {
  // In production, send to analytics endpoint
  // navigator.sendBeacon('/api/vitals', JSON.stringify(data))

  // For now, log in development
  if (import.meta.env.DEV) {
    console.log('[Web Vitals] Reported:', data)
  }
})

// Performance: Preconnect to critical origins
if (typeof document !== 'undefined') {
  // Preconnect for same-origin resources
  const preconnect = document.createElement('link')
  preconnect.rel = 'preconnect'
  preconnect.href = '/pdf-tools/'
  document.head.appendChild(preconnect)

  // Preload the main CSS (if separate)
  // const preloadCSS = document.createElement('link')
  // preloadCSS.rel = 'preload'
  // preloadCSS.as = 'style'
  // preloadCSS.href = '/pdf-tools/assets/css/index-*.css'
  // document.head.appendChild(preloadCSS)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter basename="/pdf-tools">
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
)

// Cleanup on unmount (for HMR in development)
if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupVitals()
  })

  console.log('[PDF Tools] App mounted', {
    version: __APP_VERSION__,
    buildTime: __BUILD_TIME__,
  })
}