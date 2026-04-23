import { UserRole } from "@/types";
import { prisma } from "@/lib/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
} from "@/lib/auth";
import { ApiErrorCode } from "@/lib/api-error";

const REFRESH_TTL_DAYS = 30;

export interface ActivateAdminInviteInput {
  token: string;
  name: string;
  password: string;
}

export interface ActivateAdminInviteResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    organization_id: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    setup_completed_at: Date | null;
  };
}

export interface ActivateAdminInviteError {
  code: ApiErrorCode;
  message: string;
  status: number;
}

function isInviteValid(invite: { active: boolean; expires_at: Date | null; accepted_at: Date | null }): boolean {
  if (!invite.active) return false;
  if (invite.accepted_at) return false;
  if (invite.expires_at && invite.expires_at.getTime() < Date.now()) return false;
  return true;
}

export async function activateAdminInvite(
  input: ActivateAdminInviteInput,
): Promise<{ data: ActivateAdminInviteResult } | { error: ActivateAdminInviteError }> {
  const invite = await prisma.adminActivationInvite.findUnique({
    where: { token: input.token },
    select: {
      id: true,
      organization_id: true,
      email: true,
      role: true,
      active: true,
      expires_at: true,
      accepted_at: true,
    },
  });

  if (!invite) {
    return {
      error: { code: "USER_NOT_FOUND", message: "Convite nao encontrado.", status: 404 },
    };
  }

  if (!isInviteValid(invite)) {
    return {
      error: { code: "FORBIDDEN", message: "Convite expirado, inativo ou ja utilizado.", status: 410 },
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, organization_id: true },
  });

  if (existing) {
    return {
      error: { code: "VALIDATION_ERROR", message: "Ja existe uma conta ativa para este email.", status: 409 },
    };
  }

  const passwordHash = await hashPassword(input.password);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1_000);

  const activated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organization_id: invite.organization_id,
        email: invite.email,
        password_hash: passwordHash,
        role: invite.role,
        account_status: "ACTIVE",
        email_verified: true,
        name: input.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization_id: true,
      },
    });

    await tx.adminActivationInvite.update({
      where: { id: invite.id },
      data: {
        active: false,
        accepted_at: new Date(),
        invitee_name: input.name,
      },
    });

    await tx.refreshToken.create({
      data: {
        user_id: user.id,
        organization_id: user.organization_id,
        token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt,
      },
    });

    const organization = await tx.organization.findUnique({
      where: { id: user.organization_id },
      select: { id: true, name: true, slug: true, plan: true, status: true, setup_completed_at: true },
    });

    if (!organization) {
      throw new Error("Organization not found during admin invite activation.");
    }

    return { user, organization };
  });

  const accessToken = generateAccessToken(
    activated.user.id,
    activated.user.role as unknown as UserRole,
    activated.user.organization_id,
    "ACTIVE",
  );

  return {
    data: {
      accessToken,
      refreshToken,
      user: activated.user,
      organization: {
        id: activated.organization.id,
        name: activated.organization.name,
        slug: activated.organization.slug,
        plan: activated.organization.plan,
        status: activated.organization.status,
        setup_completed_at: activated.organization.setup_completed_at,
      },
    },
  };
}
