import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './app.css'
import App from './App.jsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  // Capture 100% of traces in dev; tune down in production.
  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  tracePropagationTargets: [/^\/api\//],
})

createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<p style={{ padding: '2rem' }}>Something went wrong.</p>}>
    <App />
  </Sentry.ErrorBoundary>
)
