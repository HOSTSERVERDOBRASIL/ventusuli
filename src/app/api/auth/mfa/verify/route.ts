import { MfaMethod, UserRole as PrismaUserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { createSessionTokens } from "@/lib/auth-session";
import { consumeRecoveryCode as removeRecoveryCode, verifyHashedMfaCode, verifyTotp } from "@/lib/auth-mfa";
import { mfaVerifySchema } from "@/lib/validations/auth";
import { getChallengeByToken, challengeHasExpired, registerChallengeFailure } from "@/lib/mfa-service";
import { setAccessCookie, setRefreshCookie } from "@/lib/cookies";
import { logWarn, withRequestContext } from "@/lib/logger";
import { UserRole } from "@/types";
import { buildEffectiveRoles } from "@/lib/access-profiles";

async function resolveHasCpf(userId: string, role: PrismaUserRole): Promise<boolean> {
  if (role !== PrismaUserRole.ATHLETE) return true;

  const athleteProfile = await prisma.athleteProfile.findUnique({
    where: { user_id: userId },
    select: { cpf: true },
  });

  return Boolean(athleteProfile?.cpf);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = mfaVerifySchema.safeParse(body);
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

  if (challenge.user.account_status !== "ACTIVE") {
    return apiError("FORBIDDEN", "Conta indisponivel para autenticacao.", 403);
  }

  const method = parsed.data.method as MfaMethod;
  const rawCode = parsed.data.code.trim();
  let verified = false;
  let nextRecoveryHashes: string[] | null = null;

  if (challenge.purpose === "MFA_SETUP") {
    if (method !== MfaMethod.TOTP || !challenge.temp_totp_secret) {
      return apiError("VALIDATION_ERROR", "Setup MFA aceita apenas codigo do autenticador.", 400);
    }
    verified = verifyTotp(rawCode, challenge.temp_totp_secret);
  } else if (method === MfaMethod.TOTP) {
    verified = verifyTotp(rawCode, challenge.user.mfa_settings?.totp_secret ?? "");
  } else if (method === MfaMethod.EMAIL_OTP) {
    verified = verifyHashedMfaCode(rawCode, challenge.email_otp_code_hash);
  } else if (method === MfaMethod.RECOVERY_CODE) {
    nextRecoveryHashes = removeRecoveryCode(rawCode, challenge.user.mfa_settings?.recovery_codes_hashes ?? []);
    verified = Boolean(nextRecoveryHashes);
  }

  if (!verified) {
    await registerChallengeFailure(challenge.id);
    logWarn("auth_mfa_verify_failed", withRequestContext(req, { userId: challenge.user.id, method }));
    return apiError("INVALID_CREDENTIALS", "Codigo MFA invalido ou expirado.", 401);
  }

  const role = challenge.user.role as unknown as UserRole;
  const hasCpf = await resolveHasCpf(challenge.user.id, challenge.user.role);
  const userRecord = await prisma.user.findUnique({
    where: { id: challenge.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organization_id: true,
      athlete_profile: {
        select: { id: true },
      },
      organization: {
        select: {
          status: true,
          setup_completed_at: true,
        },
      },
    },
  });

  if (!userRecord) {
    return apiError("USER_NOT_FOUND", "Usuario nao encontrado.", 404);
  }

  let recoveryCodes: string[] | undefined;
  const roles = buildEffectiveRoles({
    primaryRole: role,
    hasAthleteProfile: Boolean(userRecord.athlete_profile),
  });

  if (challenge.purpose === "MFA_SETUP" && challenge.temp_totp_secret) {
    const { generateRecoveryCodes, hashRecoveryCodes } = await import("@/lib/auth-mfa");
    recoveryCodes = generateRecoveryCodes();

    await prisma.$transaction(async (tx) => {
      await tx.userMfaSettings.upsert({
        where: { user_id: challenge.user.id },
        create: {
          user_id: challenge.user.id,
          organization_id: challenge.user.organization_id,
          enabled: true,
          totp_secret: challenge.temp_totp_secret,
          email_otp_enabled: true,
          recovery_codes_hashes: hashRecoveryCodes(recoveryCodes ?? []),
          last_verified_at: new Date(),
        },
        update: {
          enabled: true,
          totp_secret: challenge.temp_totp_secret,
          recovery_codes_hashes: hashRecoveryCodes(recoveryCodes ?? []),
          last_verified_at: new Date(),
        },
      });

      await tx.authChallenge.update({
        where: { id: challenge.id },
        data: {
          verified_at: new Date(),
          consumed_at: new Date(),
        },
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      if (method === MfaMethod.RECOVERY_CODE && nextRecoveryHashes) {
        await tx.userMfaSettings.update({
          where: { user_id: challenge.user.id },
          data: {
            recovery_codes_hashes: nextRecoveryHashes,
            last_verified_at: new Date(),
          },
        });
      } else {
        await tx.userMfaSettings.updateMany({
          where: { user_id: challenge.user.id },
          data: { last_verified_at: new Date() },
        });
      }

      await tx.authChallenge.update({
        where: { id: challenge.id },
        data: {
          verified_at: new Date(),
          consumed_at: new Date(),
        },
      });
    });
  }

  const { accessToken, refreshToken } = await createSessionTokens({
    userId: userRecord.id,
    role,
    roles,
    organizationId: userRecord.organization_id,
    rememberMe: challenge.remember_me,
  });

  await prisma.user.update({
    where: { id: userRecord.id },
    data: { last_login_at: new Date() },
  });

  const response = NextResponse.json(
    {
      user: {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role,
        roles,
      },
      profile: { hasCpf },
      organization: userRecord.organization
        ? {
            status: userRecord.organization.status,
            setup_completed_at: userRecord.organization.setup_completed_at,
          }
        : null,
      access_token: accessToken,
      refresh_token: refreshToken,
      ...(recoveryCodes ? { recovery_codes: recoveryCodes } : {}),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );

  setAccessCookie(response, accessToken);
  setRefreshCookie(response, refreshToken, challenge.remember_me);

  return response;
}
