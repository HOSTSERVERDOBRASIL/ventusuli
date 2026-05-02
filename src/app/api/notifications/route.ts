import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

function parseLimit(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 10;
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(parsed, 1), 30);
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  const where = {
    organizationId: auth.organizationId,
    recipientId: auth.userId,
    channel: "IN_APP",
    status: "SENT",
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notificationJob.findMany({
      where,
      select: {
        id: true,
        eventType: true,
        entityType: true,
        entityId: true,
        templateCode: true,
        title: true,
        body: true,
        url: true,
        readAt: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.notificationJob.count({
      where: {
        organizationId: auth.organizationId,
        recipientId: auth.userId,
        channel: "IN_APP",
        status: "SENT",
        readAt: null,
      },
    }),
  ]);

  return NextResponse.json({
    data: items.map((item) => ({
      id: item.id,
      event_type: item.eventType,
      entity_type: item.entityType,
      entity_id: item.entityId,
      template_code: item.templateCode,
      title: item.title,
      body: item.body,
      url: item.url,
      read_at: item.readAt?.toISOString() ?? null,
      sent_at: item.sentAt?.toISOString() ?? null,
      created_at: item.createdAt.toISOString(),
    })),
    meta: {
      unread_count: unreadCount,
    },
  });
}
