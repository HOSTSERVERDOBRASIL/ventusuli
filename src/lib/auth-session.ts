import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from "@/lib/auth";
import { UserRole } from "@/types";

const SHORT_REFRESH_TTL_DAYS = 1;
const LONG_REFRESH_TTL_DAYS = 30;

export function getRefreshTtlDays(rememberMe: boolean): number {
  return rememberMe ? LONG_REFRESH_TTL_DAYS : SHORT_REFRESH_TTL_DAYS;
}

export async function createSessionTokens(params: {
  userId: string;
  role: UserRole;
  organizationId: string;
  rememberMe: boolean;
  accountStatus?: "ACTIVE" | "PENDING_INVITE" | "PENDING_APPROVAL" | "SUSPENDED";
  accessExpiresIn?: Parameters<typeof generateAccessToken>[4];
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const {
    userId,
    role,
    organizationId,
    rememberMe,
    accountStatus = "ACTIVE",
    accessExpiresIn = "15m",
  } = params;

  const accessToken = generateAccessToken(userId, role, organizationId, accountStatus, accessExpiresIn);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + getRefreshTtlDays(rememberMe) * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      organization_id: organizationId,
      token_hash: hashRefreshToken(refreshToken),
      remember_me: rememberMe,
      expires_at: expiresAt,
    },
  });

  return { accessToken, refreshToken, expiresAt };
}
