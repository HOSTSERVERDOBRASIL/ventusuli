type LogLevel = "debug" | "info" | "warn" | "error";

export interface RequestLike {
  method?: string;
  nextUrl?: { pathname?: string };
  headers?: Headers;
}

export interface LogContext extends Record<string, unknown> {
  requestId?: string;
  scope?: string;
  method?: string;
  path?: string;
}

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  env: string;
  service: string;
  context?: LogContext;
}

const REQUEST_ID_HEADER = "x-request-id";

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    env: process.env.NODE_ENV ?? "development",
    service: "ventu-suli",
    ...(context ? { context } : {}),
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(serialized);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(serialized);
}

export function getRequestIdFromHeaders(headers?: Headers | null): string | undefined {
  const value = headers?.get(REQUEST_ID_HEADER) ?? headers?.get("x-correlation-id") ?? null;
  return value?.trim() || undefined;
}

export function createRequestId(): string {
  const fromWebCrypto = globalThis.crypto?.randomUUID?.();
  if (fromWebCrypto) return fromWebCrypto;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withRequestContext(request: RequestLike | null | undefined, context?: LogContext): LogContext {
  const requestId = getRequestIdFromHeaders(request?.headers) ?? context?.requestId;
  return {
    ...(context ?? {}),
    ...(requestId ? { requestId } : {}),
    ...(request?.method ? { method: request.method } : {}),
    ...(request?.nextUrl?.pathname ? { path: request.nextUrl.pathname } : {}),
  };
}

export function toErrorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }

  return {
    errorMessage: String(error),
  };
}

export function logDebug(message: string, context?: LogContext): void {
  emit("debug", message, context);
}

export function logInfo(message: string, context?: LogContext): void {
  emit("info", message, context);
}

export function logWarn(message: string, context?: LogContext): void {
  emit("warn", message, context);
}

export function logError(message: string, context?: LogContext): void {
  emit("error", message, context);
}

export function logIntegration(
  integration: "telegram" | "strava",
  event: string,
  context?: LogContext,
): void {
  logInfo(`[integration:${integration}] ${event}`, context);
}
