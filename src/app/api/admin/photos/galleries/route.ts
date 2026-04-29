import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuthAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { createCuidLike } from "@/lib/ids";
import { recordInternalEvent } from "@/lib/internal-events";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

interface GalleryRow {
  id: string;
  organizationId: string;
  eventId: string | null;
  title: string;
  description: string | null;
  coverPhotoId: string | null;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  photosCount: number | bigint;
}

const querySchema = z.object({
  eventId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

const createSchema = z.object({
  eventId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(2),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    eventId: req.nextUrl.searchParams.get("eventId") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Query invalida.", 400);

  const filters: Prisma.Sql[] = [Prisma.sql`g."organizationId" = ${auth.organizationId}`];
  if (parsed.data.eventId) filters.push(Prisma.sql`g."eventId" = ${parsed.data.eventId}`);
  if (parsed.data.status) filters.push(Prisma.sql`g.status = ${parsed.data.status}::"public"."PhotoGalleryStatus"`);

  const rows = await prisma.$queryRaw<GalleryRow[]>(Prisma.sql`
    SELECT g.*, COUNT(p.id)::bigint AS "photosCount"
    FROM public.photo_galleries g
    LEFT JOIN public.photos p ON p."galleryId" = g.id
    WHERE ${Prisma.join(filters, " AND ")}
    GROUP BY g.id
    ORDER BY g."createdAt" DESC
  `);

  return NextResponse.json({ data: rows.map((row) => ({ ...row, photosCount: Number(row.photosCount) })) });
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

  if (parsed.data.eventId) {
    const event = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM public.events
      WHERE id = ${parsed.data.eventId}
        AND organization_id = ${auth.organizationId}
      LIMIT 1
    `);
    if (!event[0]) return apiError("USER_NOT_FOUND", "Prova nao encontrada.", 404);
  }

  const id = createCuidLike();
  const publishedAt = parsed.data.status === "PUBLISHED" ? new Date() : null;
  const rows = await prisma.$queryRaw<GalleryRow[]>(Prisma.sql`
    INSERT INTO public.photo_galleries (
      id,
      "organizationId",
      "eventId",
      title,
      description,
      status,
      "publishedAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${auth.organizationId},
      ${parsed.data.eventId ?? null},
      ${parsed.data.title},
      ${parsed.data.description ?? null},
      ${parsed.data.status}::"public"."PhotoGalleryStatus",
      ${publishedAt},
      NOW(),
      NOW()
    )
    RETURNING *, 0::bigint AS "photosCount"
  `);

  await Promise.all([
    writeAuthAuditLog(req, auth, {
      action: "photo_gallery.created",
      entityType: "PhotoGallery",
      entityId: id,
      afterData: parsed.data,
    }),
    recordInternalEvent({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name: "photo.gallery_created",
      sourceType: "PhotoGallery",
      sourceId: id,
      payload: parsed.data,
    }),
  ]);

  return NextResponse.json({ data: rows[0] }, { status: 201 });
}
