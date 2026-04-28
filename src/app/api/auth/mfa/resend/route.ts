import { MfaMethod } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { generateEmailOtpCode, hashMfaCode, maskEmail, MFA_EMAIL_OTP_TTL_MS } from "@/lib/auth-mfa";
import { getChallengeByToken, challengeHasExpired } from "@/lib/mfa-service";
import { mfaChallengeSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = mfaChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const challenge = await getChallengeByToken(parsed.data.mfa_token);
  if (!challenge) {
    return apiError("TOKEN_INVALID", "Desafio MFA invalido.", 400);
  }

  if (challengeHasExpired(challenge)) {
    return apiError("TOKEN_EXPIRED", "Desafio MFA expirado. Faca login novamente.", 400);
  }

  if (challenge.purpose !== "LOGIN_MFA") {
    return apiError("FORBIDDEN", "Reenvio por email disponivel apenas no desafio de login.", 403);
  }

  if (!challenge.available_methods.includes(MfaMethod.EMAIL_OTP)) {
    return apiError("FORBIDDEN", "Este usuario nao possui MFA por email habilitado.", 403);
  }

  const code = generateEmailOtpCode();
  await prisma.authChallenge.update({
    where: { id: challenge.id },
    data: {
      primary_method: MfaMethod.EMAIL_OTP,
      email_otp_code_hash: hashMfaCode(code),
      email_otp_sent_at: new Date(),
      expires_at: new Date(Date.now() + MFA_EMAIL_OTP_TTL_MS),
      metadata: {
        ...(typeof challenge.metadata === "object" && challenge.metadata ? challenge.metadata : {}),
        maskedEmail: maskEmail(challenge.user.email),
      },
    },
  });

  return NextResponse.json(
    {
      message: "Codigo reenviado para o email cadastrado.",
      masked_email: maskEmail(challenge.user.email),
      ...(process.env.NODE_ENV !== "production" ? { debug_code: code } : {}),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
