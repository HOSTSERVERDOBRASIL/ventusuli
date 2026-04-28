import { AuthChallenge, MfaMethod, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOtpAuthUrl, createChallengeToken, generateTotpSecret, hashChallengeToken, maskEmail } from "@/lib/auth-mfa";

const MFA_ISSUER = "Ventu Suli";

export async function getChallengeByToken(token: string) {
  const tokenHash = hashChallengeToken(token);
  return prisma.authChallenge.findUnique({
    where: { token_hash: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organization_id: true,
          account_status: true,
          mfa_settings: {
            select: {
              enabled: true,
              totp_secret: true,
              email_otp_enabled: true,
              recovery_codes_hashes: true,
            },
          },
        },
      },
    },
  });
}

export function challengeHasExpired(challenge: Pick<AuthChallenge, "expires_at" | "consumed_at" | "failed_attempts" | "max_attempts">): boolean {
  if (challenge.consumed_at) return true;
  if (challenge.expires_at.getTime() < Date.now()) return true;
  if (challenge.failed_attempts >= challenge.max_attempts) return true;
  return false;
}

export async function registerChallengeFailure(challengeId: string): Promise<void> {
  await prisma.authChallenge.update({
    where: { id: challengeId },
    data: {
      failed_attempts: { increment: 1 },
    },
  });
}

export async function consumeChallenge(challengeId: string): Promise<void> {
  await prisma.authChallenge.update({
    where: { id: challengeId },
    data: {
      consumed_at: new Date(),
      verified_at: new Date(),
    },
  });
}

export function buildMfaSetupPayload(params: {
  secret: string;
  email: string;
  mfaToken: string;
  availableMethods?: MfaMethod[];
}) {
  const otpAuthUrl = buildOtpAuthUrl({
    issuer: MFA_ISSUER,
    accountName: params.email,
    secret: params.secret,
  });

  return {
    mfa_token: params.mfaToken,
    secret: params.secret,
    otp_auth_url: otpAuthUrl,
    qr_code_data: otpAuthUrl,
    manual_entry_key: params.secret,
    available_methods: params.availableMethods ?? [MfaMethod.TOTP],
    masked_email: maskEmail(params.email),
  };
}

export async function createAuthenticatedSetupChallenge(params: {
  userId: string;
  organizationId: string;
  email: string;
  role: UserRole;
}) {
  const { rawToken, tokenHash } = createChallengeToken();
  const secret = generateTotpSecret();

  await prisma.authChallenge.create({
    data: {
      user_id: params.userId,
      organization_id: params.organizationId,
      purpose: "MFA_SETUP",
      token_hash: tokenHash,
      primary_method: MfaMethod.TOTP,
      available_methods: [MfaMethod.TOTP],
      temp_totp_secret: secret,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
      metadata: {
        createdByRole: params.role,
        maskedEmail: maskEmail(params.email),
      },
    },
  });

  return buildMfaSetupPayload({
    secret,
    email: params.email,
    mfaToken: rawToken,
  });
}
