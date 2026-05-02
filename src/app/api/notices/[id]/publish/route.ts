import { NextRequest, NextResponse } from "next/server";
import { NoticeStatus, UserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { logError } from "@/lib/logger";
import { deliverNoticeChannels } from "@/lib/notices/delivery";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

function isNoticeManager(role: UserRole): boolean {
  const value = String(role);
  return value === "ADMIN" || value === "MANAGER" || value === "MODERATOR";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isNoticeManager(auth.role)) {
    return apiError("FORBIDDEN", "Apenas ADMIN pode publicar avisos.", 403);
  }

  const noticeId = params.id;

  try {
    const existing = await prisma.notice.findFirst({
      where: {
        id: noticeId,
        organization_id: auth.organizationId,
      },
    });

    if (!existing) return apiError("USER_NOT_FOUND", "Aviso nao encontrado.", 404);
    if (existing.status === NoticeStatus.ARCHIVED) {
      return apiError("VALIDATION_ERROR", "Aviso arquivado nao pode ser publicado.", 400);
    }

    await prisma.notice.update({
      where: { id: noticeId },
      data: {
        status: NoticeStatus.PUBLISHED,
        publish_at: existing.publish_at ?? new Date(),
      },
    });

    await deliverNoticeChannels(prisma, noticeId, existing.organization_id ?? null);

    const fullNotice = await prisma.notice.findFirst({
      where: {
        id: noticeId,
        organization_id: auth.organizationId,
      },
      include: {
        creator: { select: { name: true } },
        deliveries: {
          orderBy: [{ channel: "asc" }, { created_at: "desc" }],
          select: {
            id: true,
            channel: true,
            status: true,
            external_id: true,
            error_message: true,
            attempt_count: true,
            last_attempt_at: true,
            sent_at: true,
          },
        },
      },
    });

    if (!fullNotice)
      return apiError(
        "INTERNAL_ERROR",
        "Aviso publicado, mas nao foi possivel carregar retorno.",
        500,
      );

    return NextResponse.json({
      data: {
        ...fullNotice,
        is_global: fullNotice.organization_id === null,
        creator_name: fullNotice.creator?.name ?? null,
        creator: undefined,
      },
    });
  } catch (error) {
    logError("notice_publish_failed", {
      noticeId,
      organizationId: auth.organizationId,
      userId: auth.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("INTERNAL_ERROR", "Falha ao publicar aviso.", 503);
  }
}
