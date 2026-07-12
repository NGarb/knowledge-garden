import * as Sentry from '@sentry/node'
import { trace } from '@opentelemetry/api'

let initialized = false

export function initSentry() {
  if (initialized) return
  initialized = true
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || 'development',
    // We manage OTel ourselves via _otel.js to avoid a double-provider conflict.
    skipOpenTelemetrySetup: true,
    tracesSampleRate: 0,
  })
}

export function captureException(err) {
  const span = trace.getActiveSpan()
  const traceId = span?.spanContext().traceId
  Sentry.captureException(err, traceId ? { tags: { traceId } } : undefined)
}

// Call before the Vercel function exits so buffered events are delivered.
export function flushSentry() {
  return Sentry.flush(2000)
}
