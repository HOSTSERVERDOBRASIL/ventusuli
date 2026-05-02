import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { notificationTemplates } from "@/lib/notifications/templates";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

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

async function ensureOrganizationTemplates(organizationId: string) {
  for (const template of notificationTemplates) {
    const existing = await prisma.notificationTemplate.findFirst({
      where: {
        organizationId,
        code: template.code,
        channel: template.channel,
        version: 1,
      },
      select: { id: true },
    });

    if (existing) continue;

    await prisma.notificationTemplate.create({
      data: {
        organizationId,
        code: template.code,
        name: template.name,
        channel: template.channel,
        audience: template.audience,
        subject: template.subject ?? null,
        body: template.body,
        version: 1,
      },
    });
  }
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  await ensureOrganizationTemplates(auth.organizationId);

  const channel = req.nextUrl.searchParams.get("channel");
  const templates = await prisma.notificationTemplate.findMany({
    where: {
      organizationId: auth.organizationId,
      ...(channel ? { channel } : {}),
    },
    orderBy: [{ channel: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: templates.map(mapTemplate) });
}
