import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken, verifyPassword } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { getAccessTokenFromRequest } from "@/lib/request-auth";
import { consumeRecoveryCode, verifyTotp } from "@/lib/auth-mfa";
import { mfaDisableSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  const accessToken = getAccessTokenFromRequest(req, "bearer-first");
  if (!accessToken) {
    return apiError("UNAUTHORIZED", "Sessao obrigatoria.", 401);
  }

  const payload = verifyAccessToken(accessToken);
  if (!payload) {
    return apiError("TOKEN_INVALID", "Sessao invalida.", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = mfaDisableSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      organization_id: true,
      password_hash: true,
      mfa_settings: {
        select: {
          id: true,
          totp_secret: true,
          recovery_codes_hashes: true,
        },
      },
    },
  });

  if (!user || user.organization_id !== payload.org) {
    return apiError("UNAUTHORIZED", "Sessao invalida.", 401);
  }

  if (!user.mfa_settings?.totp_secret) {
    return apiError("FORBIDDEN", "MFA nao esta ativo para esta conta.", 403);
  }

  const passwordOk = await verifyPassword(parsed.data.password, user.password_hash);
  if (!passwordOk) {
    return apiError("INVALID_CREDENTIALS", "Senha atual invalida.", 401);
  }

  const code = parsed.data.code.trim();
  const totpOk = verifyTotp(code, user.mfa_settings.totp_secret);
  const recoveryLeft = consumeRecoveryCode(code, user.mfa_settings.recovery_codes_hashes);
  if (!totpOk && !recoveryLeft) {
    return apiError("INVALID_CREDENTIALS", "Codigo MFA invalido.", 401);
  }

  await prisma.userMfaSettings.update({
    where: { user_id: user.id },
    data: {
      enabled: false,
      totp_secret: null,
      recovery_codes_hashes: [],
      last_verified_at: new Date(),
    },
  });

  return NextResponse.json(
    { message: "MFA desativado com sucesso." },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
