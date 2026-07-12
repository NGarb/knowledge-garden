import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { trace, propagation, context, SpanStatusCode } from '@opentelemetry/api'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

let _provider = null

export function getProvider() {
  if (_provider) return _provider

  propagation.setGlobalPropagator(new W3CTraceContextPropagator())

  const exporter = new OTLPTraceExporter({
    url: 'https://api.axiom.co/v1/traces',
    headers: {
      Authorization: `Bearer ${process.env.AXIOM_API_KEY}`,
      'X-Axiom-Dataset': process.env.AXIOM_DATASET || 'knowledge-garden',
    },
  })

  _provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'knowledge-garden-vercel' }),
  })
  trace.setGlobalTracerProvider(_provider)

  return _provider
}

export function getTracer() {
  getProvider()
  return trace.getTracer('knowledge-garden', '1.0.0')
}

// Run async fn as a named child span under the current active context.
export async function spanFn(name, attrs, fn) {
  return getTracer().startActiveSpan(name, { attributes: attrs }, async (span) => {
    try {
      return await fn(span)
    } catch (e) {
      span.recordException(e)
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
      throw e
    } finally {
      span.end()
    }
  })
}

// Inject W3C traceparent/tracestate into a headers object for outbound fetches.
export function injectTraceHeaders(headers = {}) {
  const carrier = { ...headers }
  propagation.inject(context.active(), carrier, {
    set(c, k, v) { c[k] = v },
  })
  // Also add x-correlation-id = traceId for Sentry-OTel correlation.
  const span = trace.getActiveSpan()
  if (span) carrier['x-correlation-id'] = span.spanContext().traceId
  return carrier
}

// Wrap a Vercel handler with a root OTel span.
// forceFlush is called before every res.json() / res.status().end() so spans
// are not dropped on function exit (BatchSpanProcessor cannot be used here).
export function withSpan(spanName, handler) {
  return async function (req, res) {
    const provider = getProvider()
    const tracer = getTracer()

    // Extract incoming W3C context (allows Databricks callbacks to chain under a parent).
    const incomingCtx = propagation.extract(context.active(), req.headers)
    const span = tracer.startSpan(
      spanName,
      { attributes: { 'http.method': req.method, 'http.route': spanName } },
      incomingCtx,
    )
    const spanCtx = trace.setSpan(incomingCtx, span)

    let flushed = false
    const flush = async (statusCode) => {
      if (flushed) return
      flushed = true
      if (statusCode !== undefined) span.setAttribute('http.status_code', statusCode)
      if (statusCode >= 400) span.setStatus({ code: SpanStatusCode.ERROR })
      span.end()
      await provider.forceFlush()
    }

    // Patch res so forceFlush is guaranteed before bytes leave the process.
    const origJson = res.json.bind(res)
    const origEnd = res.end.bind(res)
    const origStatus = res.status.bind(res)

    res.json = async (body) => {
      await flush(res.statusCode || 200)
      return origJson(body)
    }
    res.end = async (...args) => {
      await flush(res.statusCode || 200)
      return origEnd(...args)
    }
    res.status = (code) => {
      const r = origStatus(code)
      // Patch the chained .json() and .end() on the returned object.
      const rOrigJson = r.json.bind(r)
      const rOrigEnd = r.end.bind(r)
      r.json = async (body) => { await flush(code); return rOrigJson(body) }
      r.end = async (...args) => { await flush(code); return rOrigEnd(...args) }
      return r
    }

    return context.with(spanCtx, async () => {
      try {
        return await handler(req, res)
      } catch (e) {
        span.recordException(e)
        await flush(500)
        if (!res.headersSent) res.status(500).json({ error: e.message })
      }
    })
  }
}
