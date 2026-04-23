import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

interface RouteParams {
  params: { token: string };
}

function isInviteValid(invite: { active: boolean; expires_at: Date | null; accepted_at: Date | null }): boolean {
  if (!invite.active) return false;
  if (invite.accepted_at) return false;
  if (invite.expires_at && invite.expires_at.getTime() < Date.now()) return false;
  return true;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  if (!params.token || params.token.trim().length < 12) {
    return apiError("VALIDATION_ERROR", "Token invalido.", 400);
  }

  const invite = await prisma.adminActivationInvite.findUnique({
    where: { token: params.token.trim() },
    select: {
      id: true,
      email: true,
      active: true,
      expires_at: true,
      accepted_at: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
        },
      },
    },
  });

  if (!invite) {
    return apiError("USER_NOT_FOUND", "Convite nao encontrado.", 404);
  }

  if (!isInviteValid(invite)) {
    return apiError("FORBIDDEN", "Convite expirado, inativo ou ja utilizado.", 410);
  }

  return NextResponse.json({
    data: {
      inviteId: invite.id,
      email: invite.email,
      organization: invite.organization,
      expiresAt: invite.expires_at,
    },
  });
}
