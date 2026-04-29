import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface GalleryRow {
  id: string;
  eventId: string | null;
  title: string;
  description: string | null;
  coverPhotoId: string | null;
  publishedAt: Date | null;
  photosCount: number | bigint;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  const filters: Prisma.Sql[] = [Prisma.sql`g.status = 'PUBLISHED'::"public"."PhotoGalleryStatus"`];
  if (auth?.organizationId) filters.push(Prisma.sql`g."organizationId" = ${auth.organizationId}`);

  const rows = await prisma.$queryRaw<GalleryRow[]>(Prisma.sql`
    SELECT
      g.id,
      g."eventId",
      g.title,
      g.description,
      g."coverPhotoId",
      g."publishedAt",
      COUNT(p.id)::bigint AS "photosCount"
    FROM public.photo_galleries g
    LEFT JOIN public.photos p
      ON p."galleryId" = g.id
      AND p.status = 'PUBLISHED'::"public"."PhotoAssetStatus"
    WHERE ${Prisma.join(filters, " AND ")}
    GROUP BY g.id
    ORDER BY g."publishedAt" DESC NULLS LAST, g."createdAt" DESC
  `);

  return NextResponse.json({ data: rows.map((row) => ({ ...row, photosCount: Number(row.photosCount) })) });
}
