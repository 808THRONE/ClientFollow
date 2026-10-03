/**
 * Structured Logger for Production Observability
 *
 * Outputs JSON-structured logs in production for ingestion by log aggregators
 * (Datadog, Sentry, LogDNA, etc.). Falls back to readable console output in development.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  service?: string;
  leadId?: string;
  orgId?: string;
  channel?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";

function formatMessage(level: LogLevel, message: string, context?: LogContext): void {
  if (isProduction) {
    // Structured JSON for log aggregators
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
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
    const contextStr = context
      ? ` ${JSON.stringify(
          Object.fromEntries(
            Object.entries(context).filter(([k]) => k !== "service")
          )
        )}`
      : "";

    switch (level) {
      case "error":
        console.error(`❌ ${prefix} ${message}${contextStr}`);
        break;
      case "warn":
        console.warn(`⚠️  ${prefix} ${message}${contextStr}`);
        break;
      case "debug":
        console.debug(`🔍 ${prefix} ${message}${contextStr}`);
        break;
      default:
        console.log(`ℹ️  ${prefix} ${message}${contextStr}`);
    }
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => formatMessage("debug", message, context),
  info: (message: string, context?: LogContext) => formatMessage("info", message, context),
  warn: (message: string, context?: LogContext) => formatMessage("warn", message, context),
  error: (message: string, context?: LogContext) => formatMessage("error", message, context),
};
