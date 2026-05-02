import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

interface RouteParams {
  params: { id: string };
}

const updateSchema = z.object({
  subject: z.string().trim().max(180).optional().nullable(),
  body: z.string().trim().min(5).max(5000).optional(),
  isActive: z.boolean().optional(),
});

function mapTemplate(template: {
  id: string;
  code: string;
  name: string;
  channel: string;
  audience: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  version: number;
  updatedAt: Date;
}) {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    channel: template.channel,
    audience: template.audience,
    subject: template.subject,
    body: template.body,
    is_active: template.isActive,
    version: template.version,
    updated_at: template.updatedAt.toISOString(),
  };
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const existing = await prisma.notificationTemplate.findFirst({
    where: {
      id: params.id,
      organizationId: auth.organizationId,
    },
    select: { id: true },
  });

  if (!existing) return apiError("USER_NOT_FOUND", "Modelo de notificacao nao encontrado.", 404);

  const updated = await prisma.notificationTemplate.update({
    where: { id: params.id },
    data: {
      ...(Object.prototype.hasOwnProperty.call(parsed.data, "subject")
        ? { subject: parsed.data.subject?.trim() || null }
        : {}),
      ...(parsed.data.body !== undefined ? { body: parsed.data.body.trim() } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    },
  });

  return NextResponse.json({ data: mapTemplate(updated) });
}
