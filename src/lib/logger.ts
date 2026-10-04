/**
 * Structured Logger for Production Observability
 *
 * Outputs JSON-structured logs in production for ingestion by log aggregators
 * (Datadog, Sentry, LogDNA, etc.). Falls back to readable console output in development.
 */

import { AsyncLocalStorage } from "async_hooks";

type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  service?: string;
  leadId?: string;
  orgId?: string;
  channel?: string;
  correlationId?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";
const correlationStorage = new AsyncLocalStorage<string>();

/**
 * Runs a function within the context of a correlation ID for distributed tracing.
 */
export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run(correlationId, fn);
}

/**
 * Retrieves the current execution context's correlation ID.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): void {
  const activeCorrelationId = context?.correlationId || getCorrelationId();

  if (isProduction) {
    // Structured JSON for log aggregators
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(activeCorrelationId ? { correlationId: activeCorrelationId } : {}),
      ...context,
    };

    switch (level) {
      case "error":
        console.error(JSON.stringify(entry));
        break;
      case "warn":
        console.warn(JSON.stringify(entry));
        break;
      case "debug":
        // Suppress debug in production unless explicitly enabled
        if (process.env.LOG_DEBUG === "true") {
          console.debug(JSON.stringify(entry));
        }
        break;
      default:
        console.log(JSON.stringify(entry));
    }
  } else {
    // Readable output for development
    const prefix = context?.service ? `[${context.service}]` : "";
    const tracePrefix = activeCorrelationId ? `[trace:${activeCorrelationId.slice(0, 8)}]` : "";
    const contextStr = context
      ? ` ${JSON.stringify(
          Object.fromEntries(
            Object.entries(context).filter(([k]) => k !== "service" && k !== "correlationId")
          )
        )}`
      : "";

    const fullPrefix = [prefix, tracePrefix].filter(Boolean).join(" ");

    switch (level) {
      case "error":
        console.error(`❌ ${fullPrefix} ${message}${contextStr}`);
        break;
      case "warn":
        console.warn(`⚠️  ${fullPrefix} ${message}${contextStr}`);
        break;
      case "debug":
        console.debug(`🔍 ${fullPrefix} ${message}${contextStr}`);
        break;
      default:
        console.log(`ℹ️  ${fullPrefix} ${message}${contextStr}`);
    }
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => formatMessage("debug", message, context),
  info: (message: string, context?: LogContext) => formatMessage("info", message, context),
  warn: (message: string, context?: LogContext) => formatMessage("warn", message, context),
  error: (message: string, context?: LogContext) => formatMessage("error", message, context),
  withCorrelationId,
  getCorrelationId,
};

