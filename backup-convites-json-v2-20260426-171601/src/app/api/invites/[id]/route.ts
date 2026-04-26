import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiException } from "@/lib/api-error";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

interface RouteParams {
  params: { id: string };
}

const patchInviteSchema = z.object({
  active: z.boolean().optional(),
  label: z.string().trim().max(80).nullable().optional(),
  max_uses: z.number().int().min(1).max(10000).nullable().optional(),
  expires_at: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Data de expiracao invalida.",
    })
    .nullable()
    .optional(),
});

const inviteSelect = {
  id: true,
  token: true,
  label: true,
  active: true,
  expires_at: true,
  max_uses: true,
  used_count: true,
  created_at: true,
} as const;

async function findOwnInvite(inviteId: string, orgId: string) {
  return prisma.organizationInvite.findFirst({
    where: { id: inviteId, organization_id: orgId },
    select: { id: true },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthContext(req);
    if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
    if (!isAdminRole(auth.role))
      return apiError("FORBIDDEN", "Acesso restrito ao administrador.", 403);

    const existing = await findOwnInvite(params.id, auth.organizationId);
    if (!existing) return apiError("USER_NOT_FOUND", "Convite nao encontrado.", 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("VALIDATION_ERROR", "Body invalido.", 400);
    }

    const parsed = patchInviteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message ?? "Dados invalidos.",
        400,
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.active !== undefined) updateData.active = data.active;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.max_uses !== undefined) updateData.max_uses = data.max_uses;
    if (data.expires_at !== undefined) {
      updateData.expires_at = data.expires_at ? new Date(data.expires_at) : null;
    }

    const updated = await prisma.organizationInvite.update({
      where: { id: params.id },
      data: updateData,
      select: inviteSelect,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel atualizar convite.");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = getAuthContext(req);
    if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
    if (!isAdminRole(auth.role))
      return apiError("FORBIDDEN", "Acesso restrito ao administrador.", 403);

    const existing = await findOwnInvite(params.id, auth.organizationId);
    if (!existing) return apiError("USER_NOT_FOUND", "Convite nao encontrado.", 404);

    await prisma.organizationInvite.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel excluir convite.");
  }
}
