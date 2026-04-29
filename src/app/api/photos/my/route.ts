import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface MyPhotoRow {
  id: string;
  galleryId: string;
  eventId: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  watermarkUrl: string | null;
  priceCents: number;
  pointsCost: number;
  takenAt: Date | null;
  uploadedAt: Date;
  matchType: string;
  matchStatus: string;
  isUnlocked: boolean;
  unlockType: string | null;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Token de acesso ausente." } }, { status: 401 });
  }

  const rows = await prisma.$queryRaw<MyPhotoRow[]>(Prisma.sql`
    SELECT
      p.id,
      p."galleryId",
      p."eventId",
      p."previewUrl",
      p."thumbnailUrl",
      p."watermarkUrl",
      p."priceCents",
      p."pointsCost",
      p."takenAt",
      p."uploadedAt",
      m."matchType"::text AS "matchType",
      m.status::text AS "matchStatus",
      (u.id IS NOT NULL) AS "isUnlocked",
      u."unlockType"::text AS "unlockType"
    FROM public.photo_athlete_matches m
    INNER JOIN public.photos p ON p.id = m."photoId"
    LEFT JOIN public.photo_unlocks u
      ON u."photoId" = p.id
      AND u."athleteId" = ${auth.userId}
      AND u."organizationId" = ${auth.organizationId}
      AND (u."expiresAt" IS NULL OR u."expiresAt" > NOW())
    WHERE m."organizationId" = ${auth.organizationId}
      AND m."athleteId" = ${auth.userId}
      AND m.status = 'CONFIRMED'::"public"."PhotoMatchStatus"
      AND p.status = 'PUBLISHED'::"public"."PhotoAssetStatus"
    ORDER BY p."takenAt" DESC NULLS LAST, p."uploadedAt" DESC
  `);

  return NextResponse.json({ data: rows });
}
