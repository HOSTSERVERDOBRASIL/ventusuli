import { MfaMethod } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth";
import {
  createChallengeToken,
  generateTotpSecret,
  getAvailableMfaMethods,
  isMfaMandatoryForRole,
  maskEmail,
  MFA_LOGIN_TTL_MS,
  MFA_MAX_ATTEMPTS,
} from "@/lib/auth-mfa";
import { createSessionTokens } from "@/lib/auth-session";
import { loginSchema } from "@/lib/validations/auth";
import { apiError } from "@/lib/api-error";
import { clearAccessCookie, clearRefreshCookie, setAccessCookie, setRefreshCookie } from "@/lib/cookies";
import { checkRateLimit, getClientIp, isRateLimiterUnavailableError } from "@/lib/rate-limiter";
import { getAuthConfigError, isDemoRuntimeEnabled, isProductionRuntime } from "@/lib/auth-config";
import { logError, logWarn, toErrorContext, withRequestContext } from "@/lib/logger";
import { UserRole } from "@/types";
import { buildEffectiveRoles } from "@/lib/access-profiles";

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

async function resolveHasCpf(userId: string, role: UserRole): Promise<boolean> {
  if (role !== UserRole.ATHLETE && role !== UserRole.PREMIUM_ATHLETE) return true;

  const athleteProfile = await prisma.athleteProfile.findUnique({
    where: { user_id: userId },
    select: { cpf: true },
  });

  return Boolean(athleteProfile?.cpf);
}

async function createMfaChallenge(params: {
  userId: string;
  organizationId: string;
  rememberMe: boolean;
  email: string;
  setupRequired: boolean;
  emailOtpEnabled: boolean;
}) {
  const { rawToken, tokenHash } = createChallengeToken();
  const expiresAt = new Date(Date.now() + MFA_LOGIN_TTL_MS);
  const availableMethods = params.setupRequired
    ? [MfaMethod.TOTP]
    : getAvailableMfaMethods(params.emailOtpEnabled);

  await prisma.$transaction(async (tx) => {
    await tx.authChallenge.updateMany({
      where: {
        user_id: params.userId,
        purpose: params.setupRequired ? "MFA_SETUP" : "LOGIN_MFA",
        consumed_at: null,
      },
      data: { consumed_at: new Date() },
    });

    await tx.authChallenge.create({
      data: {
        user_id: params.userId,
        organization_id: params.organizationId,
        purpose: params.setupRequired ? "MFA_SETUP" : "LOGIN_MFA",
        token_hash: tokenHash,
        primary_method: MfaMethod.TOTP,
        available_methods: availableMethods,
        remember_me: params.rememberMe,
        max_attempts: MFA_MAX_ATTEMPTS,
        expires_at: expiresAt,
        temp_totp_secret: params.setupRequired ? generateTotpSecret() : null,
        metadata: {
          maskedEmail: maskEmail(params.email),
        },
      },
    });
  });

  return {
    mfa_required: true as const,
    mfa_token: rawToken,
    mfa_setup_required: params.setupRequired,
    available_methods: availableMethods,
    masked_email: maskEmail(params.email),
  };
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

  const { email, password, rememberMe } = parsed.data;
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
        avatar_url: true,
        role: true,
        organization_id: true,
        athlete_profile: {
          select: { id: true },
        },
      },
    });

    if (!demoUser || demoUser.role !== demoUserRole) {
      const response = apiError("INVALID_CREDENTIALS", "Credenciais demo invalidas para este ambiente.", 401);
      clearRefreshCookie(response);
      clearAccessCookie(response);
      return response;
    }

    const accessToken = generateAccessToken(
      demoUser.id,
      demoUser.role as UserRole,
      demoUser.organization_id,
      "ACTIVE",
      "7d",
      buildEffectiveRoles({
        primaryRole: demoUser.role as UserRole,
        hasAthleteProfile: Boolean(demoUser.athlete_profile),
      }),
    );
    const hasCpf = await resolveHasCpf(demoUser.id, demoUser.role as UserRole);

    const response = NextResponse.json(
      {
        user: {
          id: demoUser.id,
          name: demoUser.name,
          email: demoUser.email,
          avatar_url: demoUser.avatar_url,
          role: demoUser.role,
          roles: buildEffectiveRoles({
            primaryRole: demoUser.role as UserRole,
            hasAthleteProfile: Boolean(demoUser.athlete_profile),
          }),
        },
        profile: { hasCpf },
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

    setAccessCookie(response, accessToken, 7 * 24 * 60 * 60);
    setRefreshCookie(response, generateRefreshToken(), rememberMe);
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      avatar_url: true,
      password_hash: true,
      role: true,
      organization_id: true,
      account_status: true,
      athlete_profile: {
        select: { id: true, athlete_status: true },
      },
      organization: {
        select: {
          status: true,
          setup_completed_at: true,
        },
      },
      mfa_settings: {
        select: {
          enabled: true,
          totp_secret: true,
          email_otp_enabled: true,
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
  const roles = buildEffectiveRoles({
    primaryRole: role,
    hasAthleteProfile: Boolean(user.athlete_profile),
  });
  const mfaEnabled = Boolean(user.mfa_settings?.enabled && user.mfa_settings?.totp_secret);
  const mfaRequired = mfaEnabled || isMfaMandatoryForRole(role);

  if (mfaRequired) {
    const challenge = await createMfaChallenge({
      userId: user.id,
      organizationId: user.organization_id,
      rememberMe,
      email: user.email,
      setupRequired: !mfaEnabled,
      emailOtpEnabled: user.mfa_settings?.email_otp_enabled ?? true,
    });

    return NextResponse.json(challenge, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
      },
    });
  }

  const hasCpf = await resolveHasCpf(user.id, role);

  const { accessToken, refreshToken } = await createSessionTokens({
    userId: user.id,
    role,
    organizationId: user.organization_id,
    rememberMe,
    roles,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  const responseBody = {
    user: { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url, role, roles },
    profile: { hasCpf },
    organization: user.organization
      ? {
          status: user.organization.status,
          setup_completed_at: user.organization.setup_completed_at,
        }
      : null,
  };

  const response = NextResponse.json(
    {
      ...responseBody,
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

  setAccessCookie(response, accessToken);
  setRefreshCookie(response, refreshToken, rememberMe);

  return response;
}
