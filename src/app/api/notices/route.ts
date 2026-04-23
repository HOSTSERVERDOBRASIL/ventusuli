import { NextRequest, NextResponse } from "next/server";
import { NoticeAudience, NoticeStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { logError } from "@/lib/logger";
import { processScheduledNotices } from "@/lib/notices/delivery";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const createNoticeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Titulo deve ter ao menos 3 caracteres.")
    .max(120, "Titulo deve ter no maximo 120 caracteres."),
  body: z
    .string()
    .trim()
    .min(5, "Corpo do aviso deve ter ao menos 5 caracteres.")
    .max(5000, "Corpo do aviso excede limite de 5000 caracteres."),
  audience: z.nativeEnum(NoticeAudience),
  pinned: z.boolean().optional().default(false),
  publish_at: z.string().datetime().nullable().optional(),
  telegram_enabled: z.boolean().optional().default(false),
});

const listQuerySchema = z.object({
  status: z.nativeEnum(NoticeStatus).optional(),
  audience: z.nativeEnum(NoticeAudience).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

function isNoticeManager(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

function audienceFilterForRole(role: UserRole): NoticeAudience[] {
  if (role === UserRole.ATHLETE) return [NoticeAudience.ALL, NoticeAudience.ATHLETES];
  if (role === UserRole.COACH) return [NoticeAudience.ALL, NoticeAudience.COACHES];
  return [NoticeAudience.ALL, NoticeAudience.ADMINS];
}

function mapNoticeOutput<T extends { organization_id: string | null }>(notice: T) {
  return {
    ...notice,
    is_global: notice.organization_id === null,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const parsedQuery = listQuerySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    audience: req.nextUrl.searchParams.get("audience") ?? undefined,
    startDate: req.nextUrl.searchParams.get("startDate") ?? undefined,
    endDate: req.nextUrl.searchParams.get("endDate") ?? undefined,
  });

  if (!parsedQuery.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsedQuery.error.errors[0]?.message ?? "Query invalida.",
      400,
    );
  }

  try {
    const isManager = isNoticeManager(auth.role);
    const now = new Date();

    await Promise.all([
      processScheduledNotices(prisma, auth.organizationId),
      processScheduledNotices(prisma, null),
    ]);

    const startDate = parsedQuery.data.startDate ? new Date(parsedQuery.data.startDate) : undefined;
    const endDate = parsedQuery.data.endDate ? new Date(parsedQuery.data.endDate) : undefined;

    const notices = await prisma.notice.findMany({
      where: {
        ...(isManager
          ? {
              organization_id: auth.organizationId,
              ...(parsedQuery.data.status ? { status: parsedQuery.data.status } : {}),
              ...(parsedQuery.data.audience ? { audience: parsedQuery.data.audience } : {}),
              ...(startDate || endDate
                ? {
                    created_at: {
                      ...(startDate ? { gte: startDate } : {}),
                      ...(endDate ? { lte: endDate } : {}),
                    },
                  }
                : {}),
            }
          : {
              status: NoticeStatus.PUBLISHED,
              audience: { in: audienceFilterForRole(auth.role) },
              OR: [{ publish_at: null }, { publish_at: { lte: now } }],
              AND: [
                {
                  OR: [{ organization_id: auth.organizationId }, { organization_id: null }],
                },
              ],
            }),
      },
      orderBy: [{ pinned: "desc" }, { publish_at: "desc" }, { created_at: "desc" }],
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

    return NextResponse.json({
      data: notices.map((notice) =>
        mapNoticeOutput({
          ...notice,
          creator_name: notice.creator?.name ?? null,
          creator: undefined,
        }),
      ),
    });
  } catch (error) {
    logError("notices_list_failed", {
      organizationId: auth.organizationId,
      role: auth.role,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("INTERNAL_ERROR", "Falha ao carregar avisos.", 503);
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isNoticeManager(auth.role)) {
    return apiError("FORBIDDEN", "Apenas ADMIN pode criar avisos.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createNoticeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  try {
    const data = parsed.data;
    const notice = await prisma.notice.create({
      data: {
        organization_id: auth.organizationId,
        created_by: auth.userId,
        title: data.title,
        body: data.body,
        audience: data.audience,
        status: NoticeStatus.DRAFT,
        pinned: data.pinned,
        publish_at: data.publish_at ? new Date(data.publish_at) : null,
        telegram_enabled: data.telegram_enabled,
      },
      include: {
        creator: { select: { name: true } },
        deliveries: {
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

    return NextResponse.json(
      {
        data: mapNoticeOutput({
          ...notice,
          creator_name: notice.creator?.name ?? null,
          creator: undefined,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    logError("notice_create_failed", {
      organizationId: auth.organizationId,
      userId: auth.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError("INTERNAL_ERROR", "Falha ao criar aviso.", 503);
  }
}
