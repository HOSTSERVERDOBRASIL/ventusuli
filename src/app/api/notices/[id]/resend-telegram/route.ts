import { NoticeStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { logError } from "@/lib/logger";
import { deliverNoticeChannels } from "@/lib/notices/delivery";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

function isNoticeManager(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isNoticeManager(auth.role)) {
    return apiError("FORBIDDEN", "Apenas ADMIN pode reenviar avisos.", 403);
  }

  try {
    const notice = await prisma.notice.findFirst({
      where: {
        id: params.id,
        status: NoticeStatus.PUBLISHED,
        organization_id: auth.organizationId,
      },
    });

    if (!notice) {
      return apiError("USER_NOT_FOUND", "Aviso publicado nao encontrado.", 404);
    }

    if (!notice.telegram_enabled) {
      return apiError("VALIDATION_ERROR", "Telegram nao esta habilitado neste aviso.", 400);
    }

    await deliverNoticeChannels(prisma, notice.id, notice.organization_id ?? null, {
      forceTelegram: true,
    });

    const updated = await prisma.notice.findFirst({
      where: {
        id: notice.id,
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

    if (!updated)
      return apiError("INTERNAL_ERROR", "Nao foi possivel carregar o aviso apos o reenvio.", 500);

    return NextResponse.json({
      data: {
        ...updated,
        is_global: updated.organization_id === null,
        creator_name: updated.creator?.name ?? null,
        creator: undefined,
      },
    });
  } catch (error) {
    logError("notice_resend_telegram_failed", {
      noticeId: params.id,
      organizationId: auth.organizationId,
      userId: auth.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("INTERNAL_ERROR", "Falha ao reenviar aviso para Telegram.", 503);
  }
}
