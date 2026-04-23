import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalIntegrationEnv, getRequiredRuntimeEnv } from "@/lib/env";
import { logWarn, toErrorContext, withRequestContext } from "@/lib/logger";
import { getRateLimiterBackend } from "@/lib/rate-limiter";

function toStatus(ok: boolean): "ok" | "error" {
  return ok ? "ok" : "error";
}

function evaluateCriticalDependencies(): {
  ok: boolean;
  details: {
    storage: "ok" | "error";
    auth: "ok" | "error";
  };
  error: string | null;
} {
  const storageDriver = process.env.STORAGE_DRIVER ?? "local";
  const hasAuthSecrets = Boolean(process.env.JWT_SECRET && process.env.NEXTAUTH_SECRET);

  // Current upload backend uses local driver only.
  // If S3 is declared in production, readiness must fail to avoid false green deployments.
  const storageOk = storageDriver !== "s3";
  const authOk = hasAuthSecrets;

  if (!storageOk) {
    return {
      ok: false,
      details: {
        storage: "error",
        auth: authOk ? "ok" : "error",
      },
      error:
        "STORAGE_DRIVER=s3 configurado, mas driver S3 ainda nao esta habilitado neste runtime. Use STORAGE_DRIVER=local ate concluir o driver S3.",
    };
  }

  if (!authOk) {
    return {
      ok: false,
      details: {
        storage: "ok",
        auth: "error",
      },
      error: "Segredos de autenticacao ausentes (JWT_SECRET e/ou NEXTAUTH_SECRET).",
    };
  }

  return {
    ok: true,
    details: {
      storage: "ok",
      auth: "ok",
    },
    error: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const startedAt = Date.now();
    const timestamp = new Date().toISOString();
    const scope = req.nextUrl.searchParams.get("scope") === "readiness" ? "readiness" : "liveness";

    // Liveness: process-only check. Should be fast and not depend on DB.
    if (scope === "liveness") {
      return NextResponse.json(
        {
          status: "ok",
          scope,
          timestamp,
          uptimeSeconds: Math.floor(process.uptime()),
          durationMs: Date.now() - startedAt,
          checks: {
            process: "ok",
          },
          version: process.env.npm_package_version ?? "0.1.0",
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Readiness: validates required env + database.
    let envOk = true;
    let envError: string | null = null;

    try {
      getRequiredRuntimeEnv();
    } catch (error) {
      envOk = false;
      envError = error instanceof Error ? error.message : "Invalid runtime env configuration.";
      logWarn("health_env_validation_failed", withRequestContext(req, { scope, envError }));
    }

    // Optional integrations should not block readiness in local/dev.
    try {
      getOptionalIntegrationEnv();
    } catch (error) {
      logWarn(
        "health_optional_env_validation_warning",
        withRequestContext(req, {
          scope,
          optionalEnvError: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    let dbOk = true;
    let dbError: string | null = null;

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbOk = false;
      dbError = error instanceof Error ? error.message : "Database check failed";
      logWarn(
        "health_database_check_failed",
        withRequestContext(req, { scope, ...toErrorContext(error) }),
      );
    }

    const rateLimiterBackend = getRateLimiterBackend();
    const rateLimiterOk = rateLimiterBackend !== "unconfigured";
    const rateLimiterError = rateLimiterOk
      ? null
      : "Rate limiter backend nao configurado. Defina RATE_LIMIT_BACKEND=memory para cPanel single-instance, ou configure Redis/Upstash.";

    if (!rateLimiterOk) {
      logWarn(
        "health_rate_limiter_backend_unconfigured",
        withRequestContext(req, { scope, rateLimiterBackend }),
      );
    }

    const dependencies = evaluateCriticalDependencies();
    const dependenciesOk = dependencies.ok;
    const ready = envOk && dbOk && rateLimiterOk && dependenciesOk;

    return NextResponse.json(
      {
        status: toStatus(ready),
        scope,
        timestamp,
        uptimeSeconds: Math.floor(process.uptime()),
        durationMs: Date.now() - startedAt,
        checks: {
          env: toStatus(envOk),
          db: toStatus(dbOk),
          rateLimiter: toStatus(rateLimiterOk),
          dependencies: toStatus(dependenciesOk),
        },
        dependencyDetails: dependencies.details,
        ...(envError ? { envError } : {}),
        ...(dbError ? { dbError } : {}),
        ...(rateLimiterError ? { rateLimiterError } : {}),
        ...(dependencies.error ? { dependenciesError: dependencies.error } : {}),
        rateLimiterBackend,
        version: process.env.npm_package_version ?? "0.1.0",
      },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const scope = req.nextUrl.searchParams.get("scope") === "readiness" ? "readiness" : "liveness";
    logWarn(
      "health_unexpected_failure",
      withRequestContext(req, { scope, ...toErrorContext(error) }),
    );
    return NextResponse.json(
      {
        status: "error",
        scope,
        timestamp: new Date().toISOString(),
        checks: {
          process: "error",
        },
        message: "Health check failed unexpectedly.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
