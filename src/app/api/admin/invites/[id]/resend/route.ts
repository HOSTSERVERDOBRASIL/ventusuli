import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { buildPublicInviteUrl } from "@/lib/public-url";
import { getAuthContext, isStaffRole } from "@/lib/request-auth";

interface RouteParams {
  params: { id: string };
}

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isStaffRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao time administrativo.", 403);

  const current = await prisma.organizationInvite.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
    },
    select: {
      id: true,
      label: true,
      max_uses: true,
      expires_at: true,
    },
  });

  if (!current) return apiError("USER_NOT_FOUND", "Convite nao encontrado.", 404);

  const resent = await prisma.$transaction(async (tx) => {
    await tx.organizationInvite.update({
      where: { id: current.id },
      data: { active: false },
    });

    return tx.organizationInvite.create({
      data: {
        organization_id: auth.organizationId,
        token: generateInviteToken(),
        label: current.label,
        active: true,
        max_uses: current.max_uses,
        expires_at: current.expires_at,
      },
      select: {
        id: true,
        token: true,
        label: true,
        active: true,
        expires_at: true,
        max_uses: true,
        used_count: true,
        created_at: true,
      },
    });
  });

  return NextResponse.json({
    data: {
      id: resent.id,
      token: resent.token,
      label: resent.label,
      active: resent.active,
      expiresAt: resent.expires_at,
      maxUses: resent.max_uses,
      usedCount: resent.used_count,
      reusable: resent.max_uses === null,
      createdAt: resent.created_at,
      signupUrl: buildPublicInviteUrl(resent.token),
    },
  });
}

