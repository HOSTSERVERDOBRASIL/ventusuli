import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { recordInternalEvent } from "@/lib/internal-events";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface DownloadRow {
  id: string;
  originalUrl: string | null;
  originalStorageKey: string;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const unlocked = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM public.photo_unlocks
    WHERE "organizationId" = ${auth.organizationId}
      AND "athleteId" = ${auth.userId}
      AND "photoId" = ${params.id}
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    LIMIT 1
  `);
  if (!unlocked[0]) return apiError("FORBIDDEN", "Foto ainda nao desbloqueada.", 403);

  const rows = await prisma.$queryRaw<DownloadRow[]>(Prisma.sql`
    SELECT id, "originalUrl", "originalStorageKey"
    FROM public.photos
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
    LIMIT 1
  `);
  const photo = rows[0];
  if (!photo) return apiError("USER_NOT_FOUND", "Foto nao encontrada.", 404);

  await recordInternalEvent({
    organizationId: auth.organizationId,
    userId: auth.userId,
    name: "photo.download_requested",
    sourceType: "Photo",
    sourceId: photo.id,
    payload: { storageKey: photo.originalStorageKey },
  });

  return NextResponse.json({
    data: {
      photoId: photo.id,
      downloadUrl: photo.originalUrl,
      storageKey: photo.originalStorageKey,
      expiresInSeconds: photo.originalUrl ? 300 : null,
      signed: false,
    },
  });
}
