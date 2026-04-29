import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken, hashRefreshToken, verifyAccessToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import {
  REFRESH_TOKEN_COOKIE,
  clearAccessCookie,
  clearRefreshCookie,
  setAccessCookie,
  setRefreshCookie,
} from "@/lib/cookies";
import { getAuthConfigError, isDemoRuntimeEnabled } from "@/lib/auth-config";
import { getRefreshTtlDays } from "@/lib/auth-session";
import { checkRateLimit, getClientIp, isRateLimiterUnavailableError } from "@/lib/rate-limiter";
import { getAccessTokenFromRequest } from "@/lib/request-auth";
import { logError, logWarn, toErrorContext, withRequestContext } from "@/lib/logger";
import { UserRole } from "@/types";
import { buildEffectiveRoles } from "@/lib/access-profiles";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 15 * 60 * 1_000;

function sessionExpiredResponse(code: "TOKEN_INVALID" | "TOKEN_EXPIRED" | "TOKEN_REVOKED", message: string) {
  const response = apiError(code, message, 401);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Session-Expired", "1");
  clearRefreshCookie(response);
  clearAccessCookie(response);
  return response;
}

function accountStatusMessage(
  status: string,
  athleteStatus?: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED" | null,
): string {
  if (status === "PENDING_APPROVAL") {
    return "Conta aguardando aprovacao da assessoria.";
  }
  if (status === "PENDING_INVITE") {
    return "Conta pendente de ativacao por convite.";
  }
  if (status === "SUSPENDED") {
    if (athleteStatus === "REJECTED") return "Cadastro rejeitado pela assessoria.";
    if (athleteStatus === "BLOCKED") return "Conta bloqueada pela assessoria.";
    return "Conta suspensa.";
  }
  return "Conta indisponivel.";
}

export async function POST(req: NextRequest) {
  const authConfigError = getAuthConfigError();
  if (authConfigError) {
    logError("auth_refresh_config_error", withRequestContext(req, { authConfigError }));
    return apiError("INTERNAL_ERROR", authConfigError, 500);
  }

  const ip = getClientIp(req.headers);
  let allowed = false;
  let remaining = 0;
  let resetAt = Date.now() + RATE_WINDOW_MS;
  try {
    ({ allowed, remaining, resetAt } = await checkRateLimit(`auth:refresh:${ip}`, RATE_LIMIT, RATE_WINDOW_MS));
  } catch (error) {
    if (isRateLimiterUnavailableError(error)) {
      logError("auth_refresh_rate_limiter_unavailable", withRequestContext(req, toErrorContext(error)));
      return apiError("INTERNAL_ERROR", "Rate limiter indisponivel no momento.", 503);
    }
    logError("auth_refresh_rate_limiter_failed", withRequestContext(req, toErrorContext(error)));
    throw error;
  }

  if (!allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
    logWarn("auth_refresh_rate_limited", withRequestContext(req, { ip, retryAfterSec }));
    return new NextResponse(
      JSON.stringify({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Muitas tentativas. Tente novamente em ${retryAfterSec}s.`,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
        },
      },
    );
  }

  const incomingToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!incomingToken) {
    logWarn("auth_refresh_missing_token", withRequestContext(req));
    return sessionExpiredResponse("TOKEN_INVALID", "Refresh token ausente.");
  }

  if (isDemoRuntimeEnabled()) {
    const currentAccess = getAccessTokenFromRequest(req, "bearer-first");
    const payload = currentAccess ? verifyAccessToken(currentAccess) : null;

    if (!payload) {
      return sessionExpiredResponse("TOKEN_EXPIRED", "Sessao demo expirada. Faca login novamente.");
    }

    const refreshedAccess = generateAccessToken(payload.sub, payload.role, payload.org, "ACTIVE", "7d");
    const response = NextResponse.json(
      {
        user: { id: payload.sub, role: payload.role, email: null, name: null },
        accessToken: refreshedAccess,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
        },
      },
    );

    setAccessCookie(response, refreshedAccess, 7 * 24 * 60 * 60);
    setRefreshCookie(response, incomingToken, true);
    return response;
  }

  const token_hash = hashRefreshToken(incomingToken);
  const newRefreshToken = generateRefreshToken();
  const newHash = hashRefreshToken(newRefreshToken);
  const result = await prisma.$transaction(async (tx) => {
    const stored = await tx.refreshToken.findUnique({
      where: { token_hash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            organization_id: true,
            account_status: true,
            athlete_profile: { select: { id: true, athlete_status: true } },
          },
        },
      },
    });

    if (!stored) {
      return { status: "invalid" as const };
    }

    if (stored.revoked) {
      await tx.refreshToken.updateMany({
        where: { user_id: stored.user_id, revoked: false },
        data: { revoked: true },
      });
      return { status: "revoked" as const };
    }

    if (stored.expires_at < new Date()) {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revoked: true },
      });
      return { status: "expired" as const };
    }

    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const rememberMe = stored.remember_me;
    const expires_at = new Date(Date.now() + getRefreshTtlDays(rememberMe) * 24 * 60 * 60 * 1_000);

    await tx.refreshToken.create({
      data: {
        user_id: stored.user.id,
        organization_id: stored.user.organization_id,
        token_hash: newHash,
        remember_me: rememberMe,
        expires_at,
      },
    });

    return {
      status: "ok" as const,
      user: stored.user,
      rememberMe,
    };
  });

  if (result.status === "invalid") {
    return sessionExpiredResponse("TOKEN_INVALID", "Refresh token invalido.");
  }

  if (result.status === "revoked") {
    return sessionExpiredResponse("TOKEN_REVOKED", "Token revogado. Faca login novamente.");
  }

  if (result.status === "expired") {
    return sessionExpiredResponse("TOKEN_EXPIRED", "Refresh token expirado.");
  }

  if (result.user.account_status !== "ACTIVE") {
    return sessionExpiredResponse(
      "TOKEN_REVOKED",
      accountStatusMessage(result.user.account_status, result.user.athlete_profile?.athlete_status),
    );
  }

  const role = result.user.role as UserRole;
  const roles = buildEffectiveRoles({
    primaryRole: role,
    hasAthleteProfile: Boolean(result.user.athlete_profile),
  });
  const accessToken = generateAccessToken(result.user.id, role, result.user.organization_id, "ACTIVE", "15m", roles);

  const response = NextResponse.json(
    { user: { id: result.user.id, name: result.user.name, email: result.user.email, role, roles }, accessToken },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
      },
    },
  );

  setAccessCookie(response, accessToken);
  setRefreshCookie(response, newRefreshToken, result.rememberMe);
  return response;
}
