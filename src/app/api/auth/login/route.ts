import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateAccessToken, generateRefreshToken, hashRefreshToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";
import { apiError } from "@/lib/api-error";
import { clearAccessCookie, clearRefreshCookie, setAccessCookie, setRefreshCookie } from "@/lib/cookies";
import { checkRateLimit, getClientIp, isRateLimiterUnavailableError } from "@/lib/rate-limiter";
import { getAuthConfigError, isDemoRuntimeEnabled, isProductionRuntime } from "@/lib/auth-config";
import { logError, logWarn, toErrorContext, withRequestContext } from "@/lib/logger";
import { UserRole } from "@/types";

const REFRESH_TTL_DAYS = 30;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1_000;
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "admin@ventu.demo";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@1234";
const DEMO_ATHLETE_EMAIL = process.env.DEMO_ATHLETE_EMAIL ?? "atleta@ventu.demo";
const DEMO_ATHLETE_PASSWORD = process.env.DEMO_ATHLETE_PASSWORD ?? "Atleta@1234";
const DEMO_ATHLETE_PASSWORD_FALLBACK = process.env.DEMO_ATHLETE_PASSWORD_FALLBACK ?? "Demo@1234";

function isReservedDemoEmail(email: string): boolean {
  return email === DEMO_EMAIL || email === DEMO_ATHLETE_EMAIL;
}

function accountStatusMessage(
  status: string,
  athleteStatus?: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED" | null,
): string {
  if (status === "PENDING_APPROVAL") {
    return "Sua conta esta aguardando aprovacao da assessoria.";
  }
  if (status === "PENDING_INVITE") {
    return "Conta pendente de ativacao por convite.";
  }
  if (status === "SUSPENDED") {
    if (athleteStatus === "REJECTED") return "Seu cadastro foi rejeitado pela assessoria.";
    if (athleteStatus === "BLOCKED") return "Sua conta foi bloqueada pela assessoria.";
    return "Conta suspensa. Entre em contato com a assessoria.";
  }
  return "Conta temporariamente indisponivel.";
}

export async function POST(req: NextRequest) {
  const authConfigError = getAuthConfigError();
  if (authConfigError) {
    logError("auth_login_config_error", withRequestContext(req, { authConfigError }));
    return apiError("INTERNAL_ERROR", authConfigError, 500);
  }

  const ip = getClientIp(req.headers);
  let allowed = false;
  let remaining = 0;
  let resetAt = Date.now() + RATE_WINDOW_MS;
  try {
    ({ allowed, remaining, resetAt } = await checkRateLimit(`auth:login:${ip}`, RATE_LIMIT, RATE_WINDOW_MS));
  } catch (error) {
    if (isRateLimiterUnavailableError(error)) {
      logError("auth_login_rate_limiter_unavailable", withRequestContext(req, toErrorContext(error)));
      return apiError("INTERNAL_ERROR", "Rate limiter indisponivel no momento.", 503);
    }
    logError("auth_login_rate_limiter_failed", withRequestContext(req, toErrorContext(error)));
    throw error;
  }

  if (!allowed) {
    const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1_000);
    logWarn("auth_login_rate_limited", withRequestContext(req, { ip, retryAfterSec }));
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const { email, password } = parsed.data;
  const demoEnabled = isDemoRuntimeEnabled();

  if (isProductionRuntime() && isReservedDemoEmail(email)) {
    logWarn("auth_login_reserved_demo_email_blocked", withRequestContext(req, { email }));
    const response = apiError("INVALID_CREDENTIALS", "Email ou senha invalidos.", 401);
    clearRefreshCookie(response);
    clearAccessCookie(response);
    return response;
  }

  if (demoEnabled) {
    const isAdminDemo = email === DEMO_EMAIL && password === DEMO_PASSWORD;
    const isAthleteDemo =
      email === DEMO_ATHLETE_EMAIL &&
      (password === DEMO_ATHLETE_PASSWORD || password === DEMO_ATHLETE_PASSWORD_FALLBACK);

    if (!isAdminDemo && !isAthleteDemo) {
      const response = apiError("INVALID_CREDENTIALS", "Email ou senha invalidos.", 401);
      clearRefreshCookie(response);
      clearAccessCookie(response);
      return response;
    }

    const demoUserRole = isAthleteDemo ? UserRole.ATHLETE : UserRole.ADMIN;
    const demoUserEmail = isAthleteDemo ? DEMO_ATHLETE_EMAIL : DEMO_EMAIL;

    const demoUser = await prisma.user.findUnique({
      where: { email: demoUserEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization_id: true,
        account_status: true,
      },
    });

    if (!demoUser || demoUser.role !== demoUserRole) {
      const response = apiError("INVALID_CREDENTIALS", "Credenciais demo invalidas para este ambiente.", 401);
      clearRefreshCookie(response);
      clearAccessCookie(response);
      return response;
    }

    const demoAccessToken = generateAccessToken(demoUser.id, demoUser.role as UserRole, demoUser.organization_id, "ACTIVE", "7d");

    let hasCpf = true;
    if (demoUser.role === UserRole.ATHLETE) {
      const athleteProfile = await prisma.athleteProfile.findUnique({
        where: { user_id: demoUser.id },
        select: { cpf: true },
      });
      hasCpf = Boolean(athleteProfile?.cpf);
    }

    const response = NextResponse.json(
      {
        user: {
          id: demoUser.id,
          name: demoUser.name,
          email: demoUser.email,
          role: demoUser.role,
        },
        profile: { hasCpf },
        accessToken: demoAccessToken,
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

    setAccessCookie(response, demoAccessToken, 7 * 24 * 60 * 60);
    setRefreshCookie(response, generateRefreshToken());
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      password_hash: true,
      role: true,
      organization_id: true,
      account_status: true,
      athlete_profile: {
        select: { athlete_status: true },
      },
      organization: {
        select: {
          status: true,
          setup_completed_at: true,
        },
      },
    },
  });

  const passwordOk = user ? await verifyPassword(password, user.password_hash) : false;

  if (!user || !passwordOk) {
    logWarn("auth_login_invalid_credentials", withRequestContext(req, { email }));
    const response = apiError("INVALID_CREDENTIALS", "Email ou senha invalidos.", 401);
    clearRefreshCookie(response);
    clearAccessCookie(response);
    return response;
  }

  if (user.account_status !== "ACTIVE") {
    const response = apiError(
      "FORBIDDEN",
      accountStatusMessage(user.account_status, user.athlete_profile?.athlete_status),
      403,
    );
    response.headers.set("X-Session-Expired", "1");
    clearRefreshCookie(response);
    clearAccessCookie(response);
    return response;
  }

  const role = user.role as UserRole;
  const accessToken = generateAccessToken(user.id, role, user.organization_id, "ACTIVE");
  const refreshToken = generateRefreshToken();
  const token_hash = hashRefreshToken(refreshToken);
  const expires_at = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1_000);

  const hasCpf = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    await tx.refreshToken.create({
      data: {
        user_id: user.id,
        organization_id: user.organization_id,
        token_hash,
        expires_at,
      },
    });

    if (role !== UserRole.ATHLETE) return true;

    const athleteProfile = await tx.athleteProfile.findUnique({
      where: { user_id: user.id },
      select: { cpf: true },
    });

    return Boolean(athleteProfile?.cpf);
  });

  const response = NextResponse.json(
    {
      user: { id: user.id, name: user.name, email: user.email, role },
      profile: { hasCpf },
      organization: user.organization
        ? {
            status: user.organization.status,
            setup_completed_at: user.organization.setup_completed_at,
          }
        : null,
      accessToken,
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

  setRefreshCookie(response, refreshToken);
  setAccessCookie(response, accessToken);
  return response;
}
