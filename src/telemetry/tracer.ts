import { trace, context, SpanStatusCode, SpanKind, Span, Tracer } from '@opentelemetry/api';

/**
 * OpenTelemetry Tracer Instance for AegisOps HITL & Ledger Execution Lifecycle.
 */
export const tracer: Tracer = trace.getTracer('aegisops-hitl-engine', '1.0.0');

export interface TraceRecord {
  traceId: string;
  spanId: string;
  name: string;
  kind: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: {
    code: 'UNSET' | 'OK' | 'ERROR';
    message?: string;
  };
  attributes: Record<string, any>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
  }>;
}

// In-memory ring buffer for recent active traces for observability & UI audit trails
const TRACE_BUFFER_LIMIT = 50;
const activeTraceRecords: TraceRecord[] = [];

/**
 * Get recorded traces for real-time observability and audit inspection.
 */
export function getActiveTraceRecords(): TraceRecord[] {
  return [...activeTraceRecords];
}

/**
 * Lightweight OpenTelemetry wrapper function as requested:
 * traceSpan<T>(name: string, attributes: Record<string, any>, fn: () => Promise<T>): Promise<T>
 * Logs structured span data (traceId, spanId, duration, service.name, telemetry.sdk.language, custom attributes)
 */
export async function traceSpan<T>(
  name: string,
  attributes: Record<string, any> = {},
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const parentCtx = context.active();

  return context.with(parentCtx, async () => {
    const span = tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'service.name': 'aegisops-autonomous-engine',
        'telemetry.sdk.language': 'typescript',
        ...attributes
      }
    });

    const spanContext = span.spanContext();
    const traceRecord: TraceRecord = {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      name,
      kind: 'INTERNAL',
      startTime,
      status: { code: 'UNSET' },
      attributes: {
        'service.name': 'aegisops-autonomous-engine',
        'telemetry.sdk.language': 'typescript',
        ...attributes
      },
      events: []
    };

    try {
      span.addEvent('execution.started', { timestamp: new Date().toISOString() });
      const result = await fn();

      span.setStatus({ code: SpanStatusCode.OK });
      span.addEvent('execution.completed', { timestamp: new Date().toISOString() });
      
      const endTime = Date.now();
      traceRecord.endTime = endTime;
      traceRecord.durationMs = endTime - startTime;
      traceRecord.status = { code: 'OK' };

      // Structured logging for Cloud Logging ingestion
      console.log(`[OTel Trace] [OK] ${name} (${traceRecord.durationMs}ms) traceId=${spanContext.traceId} spanId=${spanContext.spanId}`, {
        service: 'aegisops-autonomous-engine',
        language: 'typescript',
        durationMs: traceRecord.durationMs,
        attributes: traceRecord.attributes
      });

      return result;
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err?.message || 'Unknown execution error'
      });
      span.addEvent('execution.failed', {
        'error.message': err?.message,
        'error.name': err?.name || 'Error',
        timestamp: new Date().toISOString()
      });

      const endTime = Date.now();
      traceRecord.endTime = endTime;
      traceRecord.durationMs = endTime - startTime;
      traceRecord.status = {
        code: 'ERROR',
        message: err?.message || 'Execution error'
      };

      console.error(`[OTel Trace] [ERROR] ${name} (${traceRecord.durationMs}ms) traceId=${spanContext.traceId} spanId=${spanContext.spanId}:`, {
        service: 'aegisops-autonomous-engine',
        error: err?.message || err,
        attributes: traceRecord.attributes
      });
      throw err;
    } finally {
      span.end();
      activeTraceRecords.unshift(traceRecord);
      if (activeTraceRecords.length > TRACE_BUFFER_LIMIT) {
        activeTraceRecords.pop();
      }
    }
  });
}

/**
 * Enhanced helper withSpan accepting span parameter in callback for advanced tracing.
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, any>,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    parentSpan?: Span;
  }
): Promise<T> {
  const startTime = Date.now();
  const parentCtx = options?.parentSpan 
    ? trace.setSpan(context.active(), options.parentSpan)
    : context.active();

  return context.with(parentCtx, async () => {
    const span = tracer.startSpan(name, {
      kind: options?.kind ?? SpanKind.INTERNAL,
      attributes: {
        'service.name': 'aegisops-autonomous-engine',
        'telemetry.sdk.language': 'typescript',
        ...attributes
      }
    });

    const spanContext = span.spanContext();
    const traceRecord: TraceRecord = {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      name,
      kind: options?.kind ? SpanKind[options.kind] : 'INTERNAL',
      startTime,
      status: { code: 'UNSET' },
      attributes: {
        'service.name': 'aegisops-autonomous-engine',
        'telemetry.sdk.language': 'typescript',
        ...attributes
      },
      events: []
    };

    try {
      span.addEvent('execution.started', { timestamp: new Date().toISOString() });
      const result = await fn(span);

      span.setStatus({ code: SpanStatusCode.OK });
      span.addEvent('execution.completed', { timestamp: new Date().toISOString() });
      
      const endTime = Date.now();
      traceRecord.endTime = endTime;
      traceRecord.durationMs = endTime - startTime;
      traceRecord.status = { code: 'OK' };

      console.log(`[OTel Trace] [OK] ${name} (${traceRecord.durationMs}ms) traceId=${spanContext.traceId} spanId=${spanContext.spanId}`, {
        attributes: traceRecord.attributes
      });

      return result;
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err?.message || 'Unknown execution error'
      });
      span.addEvent('execution.failed', {
        'error.message': err?.message,
        'error.name': err?.name || 'Error',
        timestamp: new Date().toISOString()
      });

      const endTime = Date.now();
      traceRecord.endTime = endTime;
      traceRecord.durationMs = endTime - startTime;
      traceRecord.status = {
        code: 'ERROR',
        message: err?.message || 'Execution error'
      };

      console.error(`[OTel Trace] [ERROR] ${name} (${traceRecord.durationMs}ms) traceId=${spanContext.traceId} spanId=${spanContext.spanId}:`, err);
      throw err;
    } finally {
      span.end();
      activeTraceRecords.unshift(traceRecord);
      if (activeTraceRecords.length > TRACE_BUFFER_LIMIT) {
        activeTraceRecords.pop();
      }
    }
  });
}

