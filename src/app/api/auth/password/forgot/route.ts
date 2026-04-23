import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { generateOneTimeToken, hashOneTimeToken } from "@/lib/auth";
import { getRequiredRuntimeEnv } from "@/lib/env";
import { apiError } from "@/lib/api-error";
import { checkRateLimit, getClientIp, isRateLimiterUnavailableError } from "@/lib/rate-limiter";
import { logError, logWarn, toErrorContext, withRequestContext } from "@/lib/logger";

const RESET_TTL_MINUTES = 30;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1_000;

function buildResetLink(token: string): string {
  const baseUrl = getRequiredRuntimeEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  let allowed = false;
  let remaining = 0;
  let resetAt = Date.now() + RATE_WINDOW_MS;
  try {
    ({ allowed, remaining, resetAt } = await checkRateLimit(`auth:password:forgot:${ip}`, RATE_LIMIT, RATE_WINDOW_MS));
  } catch (error) {
    if (isRateLimiterUnavailableError(error)) {
      logError("auth_password_forgot_rate_limiter_unavailable", withRequestContext(req, toErrorContext(error)));
      return apiError("INTERNAL_ERROR", "Rate limiter indisponivel no momento.", 503);
    }
    logError("auth_password_forgot_rate_limiter_failed", withRequestContext(req, toErrorContext(error)));
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

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, account_status: true },
  });

  if (user && user.account_status === "ACTIVE") {
    const rawToken = generateOneTimeToken();
    const tokenHash = hashOneTimeToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          user_id: user.id,
          used_at: null,
        },
        data: {
          used_at: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        },
      });
    });

    // In production we do not leak reset links in API response.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          message: "Se o email existir, enviamos o link de recuperacao.",
          debug: {
            resetLink: buildResetLink(rawToken),
            expiresAt,
          },
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
    }
  } else if (user && user.account_status !== "ACTIVE") {
    logWarn("password_reset_denied_inactive_account", { userId: user.id, email, accountStatus: user.account_status });
  }

  return NextResponse.json(
    { message: "Se o email existir, enviamos o link de recuperacao." },
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
}
