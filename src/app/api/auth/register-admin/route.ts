import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateSlug,
} from "@/lib/auth";
import { registerAdminSchema } from "@/lib/validations/auth";
import { apiError } from "@/lib/api-error";
import { setAccessCookie, setRefreshCookie } from "@/lib/cookies";
import {
  getAuthConfigError,
  isPublicAdminRegistrationEnabled,
} from "@/lib/auth-config";
import { checkRateLimit, getClientIp, isRateLimiterUnavailableError } from "@/lib/rate-limiter";
import { UserRole } from "@/types";

const REFRESH_TTL_DAYS = 30;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1_000;

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}

export async function POST(req: NextRequest) {
  const authConfigError = getAuthConfigError();
  if (authConfigError) {
    return apiError("INTERNAL_ERROR", authConfigError, 500);
  }

  const ip = getClientIp(req.headers);
  let allowed = false;
  let remaining = 0;
  let resetAt = Date.now() + RATE_WINDOW_MS;
  try {
    ({ allowed, remaining, resetAt } = await checkRateLimit(`auth:register-admin:${ip}`, RATE_LIMIT, RATE_WINDOW_MS));
  } catch (error) {
    if (isRateLimiterUnavailableError(error)) {
      return apiError("INTERNAL_ERROR", "Rate limiter indisponivel no momento.", 503);
    }
    throw error;
  }

  if (!allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
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

  if (!isPublicAdminRegistrationEnabled()) {
    return apiError(
      "FORBIDDEN",
      "Cadastro publico de assessoria desabilitado neste ambiente. Solicite convite comercial.",
      403,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = registerAdminSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const { name, email, password, orgName } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return apiError("EMAIL_ALREADY_EXISTS", "Este email ja esta em uso.", 409);
    }

    const slugBase = generateSlug(orgName);
    let slug = slugBase;
    let suffix = 1;

    while (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slugBase}-${suffix}`;
      suffix += 1;
    }

    const organization = await prisma.organization.create({
      data: { name: orgName, slug },
      select: { id: true },
    });

    const password_hash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: UserRole.ADMIN,
        account_status: "ACTIVE",
        organization_id: organization.id,
      },
      select: { id: true, name: true, email: true, role: true, organization_id: true },
    });

    const accessToken = generateAccessToken(
      user.id,
      user.role as UserRole,
      user.organization_id,
      "ACTIVE",
    );
    const refreshToken = generateRefreshToken();
    const token_hash = hashRefreshToken(refreshToken);
    const expires_at = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1_000);

    await prisma.refreshToken.create({
      data: { user_id: user.id, organization_id: user.organization_id, token_hash, expires_at },
    });

    const response = NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        accessToken,
      },
      {
        status: 201,
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
  } catch (error) {
    if (hasPrismaCode(error, "P2002")) {
      return apiError("VALIDATION_ERROR", "Email ou nome da assessoria ja esta em uso.", 409);
    }

    return apiError("INTERNAL_ERROR", "Erro interno ao criar conta da assessoria.", 500);
  }
}
