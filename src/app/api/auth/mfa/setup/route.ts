import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { getAccessTokenFromRequest } from "@/lib/request-auth";
import { mfaChallengeSchema } from "@/lib/validations/auth";
import { buildMfaSetupPayload, challengeHasExpired, createAuthenticatedSetupChallenge, getChallengeByToken } from "@/lib/mfa-service";
import { logWarn, withRequestContext } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const maybeChallenge = mfaChallengeSchema.safeParse(body);
  if (maybeChallenge.success) {
    const challenge = await getChallengeByToken(maybeChallenge.data.mfa_token);
    if (!challenge || challenge.purpose !== "MFA_SETUP") {
      return apiError("TOKEN_INVALID", "Desafio MFA invalido.", 400);
    }

    if (challengeHasExpired(challenge)) {
      return apiError("TOKEN_EXPIRED", "Desafio MFA expirado. Faca login novamente.", 400);
    }

    if (!challenge.temp_totp_secret) {
      return apiError("INTERNAL_ERROR", "Segredo temporario MFA indisponivel.", 500);
    }

    return NextResponse.json(
      buildMfaSetupPayload({
        secret: challenge.temp_totp_secret,
        email: challenge.user.email,
        mfaToken: maybeChallenge.data.mfa_token,
        availableMethods: challenge.available_methods,
      }),
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const accessToken = getAccessTokenFromRequest(req, "bearer-first");
  if (!accessToken) {
    return apiError("UNAUTHORIZED", "Sessao obrigatoria para ativar MFA.", 401);
  }

  const payload = verifyAccessToken(accessToken);
  if (!payload) {
    return apiError("TOKEN_INVALID", "Sessao invalida.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      role: true,
      organization_id: true,
      account_status: true,
    },
  });

  if (!user || user.organization_id !== payload.org) {
    logWarn("auth_mfa_setup_user_mismatch", withRequestContext(req, { userId: payload.sub }));
    return apiError("UNAUTHORIZED", "Sessao invalida.", 401);
  }

  if (user.account_status !== "ACTIVE") {
    return apiError("FORBIDDEN", "Conta indisponivel para ativar MFA.", 403);
  }

  const setupPayload = await createAuthenticatedSetupChallenge({
    userId: user.id,
    organizationId: user.organization_id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json(setupPayload, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
