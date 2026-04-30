import { UserRole as PrismaUserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { verifyAccessToken } from "@/lib/auth";
import { isMfaMandatoryForRole } from "@/lib/auth-mfa";
import { prisma } from "@/lib/prisma";
import { getAccessTokenFromRequest } from "@/lib/request-auth";

export async function GET(req: NextRequest) {
  const accessToken = getAccessTokenFromRequest(req, "bearer-first");
  if (!accessToken) {
    return apiError("UNAUTHORIZED", "Sessao obrigatoria.", 401);
  }

  const payload = verifyAccessToken(accessToken);
  if (!payload) {
    return apiError("TOKEN_INVALID", "Sessao invalida.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      role: true,
      organization_id: true,
      mfa_settings: {
        select: {
          enabled: true,
          totp_secret: true,
          email_otp_enabled: true,
          recovery_codes_hashes: true,
          last_verified_at: true,
          updated_at: true,
        },
      },
    },
  });

  if (!user || user.organization_id !== payload.org) {
    return apiError("UNAUTHORIZED", "Sessao invalida.", 401);
  }

  const enabled = Boolean(user.mfa_settings?.enabled && user.mfa_settings.totp_secret);

  return NextResponse.json(
    {
      data: {
        enabled,
        requiredByRole: isMfaMandatoryForRole(user.role as PrismaUserRole),
        emailOtpEnabled: user.mfa_settings?.email_otp_enabled ?? true,
        recoveryCodesRemaining: user.mfa_settings?.recovery_codes_hashes.length ?? 0,
        lastVerifiedAt: user.mfa_settings?.last_verified_at?.toISOString() ?? null,
        updatedAt: user.mfa_settings?.updated_at?.toISOString() ?? null,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
