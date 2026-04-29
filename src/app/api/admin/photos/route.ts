import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuthAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { createCuidLike } from "@/lib/ids";
import { recordInternalEvent } from "@/lib/internal-events";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";
import { isAllowedImageUrl } from "@/lib/storage/image-url";

interface PhotoRow {
  id: string;
  organizationId: string;
  galleryId: string;
  eventId: string | null;
  photographerId: string | null;
  originalStorageKey: string;
  previewStorageKey: string | null;
  thumbnailStorageKey: string | null;
  watermarkStorageKey: string | null;
  originalUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  watermarkUrl: string | null;
  priceCents: number;
  pointsCost: number;
  status: string;
  metadata: unknown;
  takenAt: Date | null;
  uploadedAt: Date;
  updatedAt: Date;
}

const querySchema = z.object({
  galleryId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  status: z.enum(["PROCESSING", "PUBLISHED", "HIDDEN", "ARCHIVED"]).optional(),
});

const matchSchema = z.object({
  athleteId: z.string().min(1),
  bibNumber: z.string().trim().min(1).optional().nullable(),
  matchType: z.enum(["MANUAL", "BIB_NUMBER", "FACIAL_RECOGNITION", "IMPORT"]).default("MANUAL"),
  confidenceScore: z.number().min(0).max(1).optional().nullable(),
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED"]).default("CONFIRMED"),
});

const createSchema = z.object({
  galleryId: z.string().min(1),
  eventId: z.string().min(1).optional().nullable(),
  photographerId: z.string().min(1).optional().nullable(),
  originalStorageKey: z.string().trim().min(1),
  previewStorageKey: z.string().trim().min(1).optional().nullable(),
  thumbnailStorageKey: z.string().trim().min(1).optional().nullable(),
  watermarkStorageKey: z.string().trim().min(1).optional().nullable(),
  originalUrl: z.string().trim().min(1).refine(isAllowedImageUrl, "URL original invalida.").optional().nullable(),
  previewUrl: z.string().trim().min(1).refine(isAllowedImageUrl, "Preview invalido.").optional().nullable(),
  thumbnailUrl: z.string().trim().min(1).refine(isAllowedImageUrl, "Thumbnail invalido.").optional().nullable(),
  watermarkUrl: z.string().trim().min(1).refine(isAllowedImageUrl, "Watermark invalido.").optional().nullable(),
  priceCents: z.number().int().min(0).default(0),
  pointsCost: z.number().int().min(0).default(0),
  status: z.enum(["PROCESSING", "PUBLISHED", "HIDDEN", "ARCHIVED"]).default("PROCESSING"),
  takenAt: z.coerce.date().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  matches: z.array(matchSchema).max(50).default([]),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    galleryId: req.nextUrl.searchParams.get("galleryId") ?? undefined,
    eventId: req.nextUrl.searchParams.get("eventId") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Query invalida.", 400);

  const filters: Prisma.Sql[] = [Prisma.sql`p."organizationId" = ${auth.organizationId}`];
  if (parsed.data.galleryId) filters.push(Prisma.sql`p."galleryId" = ${parsed.data.galleryId}`);
  if (parsed.data.eventId) filters.push(Prisma.sql`p."eventId" = ${parsed.data.eventId}`);
  if (parsed.data.status) filters.push(Prisma.sql`p.status = ${parsed.data.status}::"public"."PhotoAssetStatus"`);

  const rows = await prisma.$queryRaw<PhotoRow[]>(Prisma.sql`
    SELECT p.*
    FROM public.photos p
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY p."uploadedAt" DESC
    LIMIT 200
  `);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const payload = parsed.data;
  const gallery = await prisma.$queryRaw<Array<{ id: string; eventId: string | null }>>(Prisma.sql`
    SELECT id, "eventId"
    FROM public.photo_galleries
    WHERE id = ${payload.galleryId}
      AND "organizationId" = ${auth.organizationId}
    LIMIT 1
  `);
  if (!gallery[0]) return apiError("USER_NOT_FOUND", "Galeria nao encontrada.", 404);

  const eventId = payload.eventId ?? gallery[0].eventId;
  const id = createCuidLike();
  const rows = await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<PhotoRow[]>(Prisma.sql`
      INSERT INTO public.photos (
        id,
        "organizationId",
        "galleryId",
        "eventId",
        "photographerId",
        "originalStorageKey",
        "previewStorageKey",
        "thumbnailStorageKey",
        "watermarkStorageKey",
        "originalUrl",
        "previewUrl",
        "thumbnailUrl",
        "watermarkUrl",
        "priceCents",
        "pointsCost",
        status,
        metadata,
        "takenAt",
        "uploadedAt",
        "updatedAt"
      )
      VALUES (
        ${id},
        ${auth.organizationId},
        ${payload.galleryId},
        ${eventId},
        ${payload.photographerId ?? null},
        ${payload.originalStorageKey},
        ${payload.previewStorageKey ?? null},
        ${payload.thumbnailStorageKey ?? null},
        ${payload.watermarkStorageKey ?? null},
        ${payload.originalUrl ?? null},
        ${payload.previewUrl ?? null},
        ${payload.thumbnailUrl ?? null},
        ${payload.watermarkUrl ?? null},
        ${payload.priceCents},
        ${payload.pointsCost},
        ${payload.status}::"public"."PhotoAssetStatus",
        ${payload.metadata ?? null},
        ${payload.takenAt ?? null},
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    for (const match of payload.matches) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public.photo_athlete_matches (
          id,
          "organizationId",
          "photoId",
          "athleteId",
          "bibNumber",
          "matchType",
          "confidenceScore",
          status,
          "createdAt"
        )
        VALUES (
          ${createCuidLike()},
          ${auth.organizationId},
          ${id},
          ${match.athleteId},
          ${match.bibNumber ?? null},
          ${match.matchType}::"public"."PhotoMatchType",
          ${match.confidenceScore ?? null},
          ${match.status}::"public"."PhotoMatchStatus",
          NOW()
        )
        ON CONFLICT ("photoId", "athleteId")
        DO UPDATE SET
          "bibNumber" = EXCLUDED."bibNumber",
          "matchType" = EXCLUDED."matchType",
          "confidenceScore" = EXCLUDED."confidenceScore",
          status = EXCLUDED.status
      `);
    }

    return inserted;
  });

  await Promise.all([
    writeAuthAuditLog(req, auth, {
      action: "photo.created",
      entityType: "Photo",
      entityId: id,
      afterData: JSON.parse(
        JSON.stringify({ ...payload, takenAt: payload.takenAt?.toISOString() ?? null }),
      ) as Prisma.InputJsonValue,
    }),
    recordInternalEvent({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name: "photo.uploaded",
      sourceType: "Photo",
      sourceId: id,
      payload: { galleryId: payload.galleryId, eventId, status: payload.status },
    }),
  ]);

  return NextResponse.json({ data: rows[0] }, { status: 201 });
}
