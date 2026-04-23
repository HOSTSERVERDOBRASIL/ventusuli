import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { hashOneTimeToken, hashPassword } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { checkRateLimit, getClientIp, isRateLimiterUnavailableError } from "@/lib/rate-limiter";
import { logError, toErrorContext, withRequestContext } from "@/lib/logger";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 15 * 60 * 1_000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  let allowed = false;
  let resetAt = Date.now() + RATE_WINDOW_MS;
  try {
    ({ allowed, resetAt } = await checkRateLimit(`auth:password:reset:${ip}`, RATE_LIMIT, RATE_WINDOW_MS));
  } catch (error) {
    if (isRateLimiterUnavailableError(error)) {
      logError("auth_password_reset_rate_limiter_unavailable", withRequestContext(req, toErrorContext(error)));
      return apiError("INTERNAL_ERROR", "Rate limiter indisponivel no momento.", 503);
    }
    logError("auth_password_reset_rate_limiter_failed", withRequestContext(req, toErrorContext(error)));
    throw error;
  }

  if (!allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Muitas tentativas. Tente novamente em ${retryAfterSec}s.`,
        },
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
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

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const tokenHash = hashOneTimeToken(parsed.data.token);
  const newPasswordHash = await hashPassword(parsed.data.password);

  const tokenRow = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
    select: {
      id: true,
      user_id: true,
      used_at: true,
      expires_at: true,
    },
  });

  if (!tokenRow) {
    return apiError("TOKEN_INVALID", "Token de recuperacao invalido.", 400);
  }

  if (tokenRow.used_at) {
    return apiError("TOKEN_INVALID", "Token de recuperacao ja foi utilizado.", 400);
  }

  if (tokenRow.expires_at.getTime() < Date.now()) {
    return apiError("TOKEN_EXPIRED", "Token de recuperacao expirado.", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tokenRow.user_id },
      data: {
        password_hash: newPasswordHash,
        last_login_at: null,
      },
    });

    await tx.passwordResetToken.update({
      where: { id: tokenRow.id },
      data: {
        used_at: new Date(),
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        user_id: tokenRow.user_id,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });
  });

  return NextResponse.json(
    { message: "Senha redefinida com sucesso. Faca login novamente." },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
