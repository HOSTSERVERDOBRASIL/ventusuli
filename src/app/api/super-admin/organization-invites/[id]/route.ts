import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { getRequiredRuntimeEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isSuperAdminRole } from "@/lib/request-auth";

const updateInviteSchema = z.object({
  active: z.boolean(),
});

function buildActivationLink(token: string): string {
  const appUrl = getRequiredRuntimeEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${appUrl}/activate-admin?token=${encodeURIComponent(token)}`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role))
    return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

  const inviteId = params.id?.trim();
  if (!inviteId) return apiError("VALIDATION_ERROR", "ID do convite e obrigatorio.", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = updateInviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const existing = await prisma.adminActivationInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, accepted_at: true },
  });

  if (!existing) return apiError("USER_NOT_FOUND", "Convite nao encontrado.", 404);
  if (existing.accepted_at) {
    return apiError("VALIDATION_ERROR", "Nao e possivel alterar estado de convite ja aceito.", 400);
  }

  const updated = await prisma.adminActivationInvite.update({
    where: { id: inviteId },
    data: {
      active: parsed.data.active,
    },
    select: {
      id: true,
      organization_id: true,
      email: true,
      role: true,
      active: true,
      expires_at: true,
      accepted_at: true,
      created_at: true,
      token: true,
      organization: {
        select: { id: true, name: true, slug: true, plan: true, status: true },
      },
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      organizationId: updated.organization_id,
      email: updated.email,
      role: updated.role,
      active: updated.active,
      expiresAt: updated.expires_at,
      acceptedAt: updated.accepted_at,
      createdAt: updated.created_at,
      token: updated.token,
      activationLink: buildActivationLink(updated.token),
      organization: updated.organization,
    },
  });
}
