import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { writeAuthAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { createCuidLike } from "@/lib/ids";
import { recordInternalEvent } from "@/lib/internal-events";
import { debitPoints } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface PhotoForUnlock {
  id: string;
  pointsCost: number;
  status: string;
}

interface UnlockRow {
  id: string;
  organizationId: string;
  athleteId: string;
  photoId: string;
  unlockType: string;
  pointTransactionId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const existingUnlock = await prisma.$queryRaw<UnlockRow[]>(Prisma.sql`
    SELECT *
    FROM public.photo_unlocks
    WHERE "organizationId" = ${auth.organizationId}
      AND "athleteId" = ${auth.userId}
      AND "photoId" = ${params.id}
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    LIMIT 1
  `);
  if (existingUnlock[0]) return NextResponse.json({ data: existingUnlock[0], alreadyUnlocked: true });

  const photos = await prisma.$queryRaw<PhotoForUnlock[]>(Prisma.sql`
    SELECT id, "pointsCost", status::text
    FROM public.photos
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
      AND status = 'PUBLISHED'::"public"."PhotoAssetStatus"
    LIMIT 1
  `);
  const photo = photos[0];
  if (!photo) return apiError("USER_NOT_FOUND", "Foto nao encontrada.", 404);
  if (photo.pointsCost <= 0) return apiError("VALIDATION_ERROR", "Foto sem custo em pontos configurado.", 400);

  const match = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM public.photo_athlete_matches
    WHERE "organizationId" = ${auth.organizationId}
      AND "photoId" = ${params.id}
      AND "athleteId" = ${auth.userId}
      AND status = 'CONFIRMED'::"public"."PhotoMatchStatus"
    LIMIT 1
  `);
  if (!match[0]) return apiError("FORBIDDEN", "Foto nao vinculada ao atleta.", 403);

  let ledgerEntryId: string;
  try {
    const debit = await debitPoints({
      orgId: auth.organizationId,
      userId: auth.userId,
      sourceType: "REDEMPTION",
      points: -photo.pointsCost,
      description: "Desbloqueio de foto com pontos",
      referenceCode: `PHOTO-${params.id}-${auth.userId}`,
      createdBy: auth.userId,
    });
    ledgerEntryId = debit.entry.id;
  } catch (error) {
    if (error instanceof Error && error.message === "points_balance_cannot_be_negative") {
      return apiError("VALIDATION_ERROR", "Saldo de pontos insuficiente.", 400);
    }
    throw error;
  }

  const id = createCuidLike();
  const rows = await prisma.$queryRaw<UnlockRow[]>(Prisma.sql`
    INSERT INTO public.photo_unlocks (
      id,
      "organizationId",
      "athleteId",
      "photoId",
      "unlockType",
      "pointTransactionId",
      "createdAt"
    )
    VALUES (
      ${id},
      ${auth.organizationId},
      ${auth.userId},
      ${params.id},
      'POINTS'::"public"."PhotoUnlockType",
      ${ledgerEntryId},
      NOW()
    )
    ON CONFLICT ("organizationId", "athleteId", "photoId")
    DO UPDATE SET
      "unlockType" = EXCLUDED."unlockType",
      "pointTransactionId" = EXCLUDED."pointTransactionId",
      "expiresAt" = NULL
    RETURNING *
  `);

  await Promise.all([
    writeAuthAuditLog(req, auth, {
      action: "photo.unlocked_with_points",
      entityType: "PhotoUnlock",
      entityId: rows[0]?.id ?? id,
      afterData: { photoId: params.id, pointsCost: photo.pointsCost, ledgerEntryId },
    }),
    recordInternalEvent({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name: "photo.unlocked",
      sourceType: "Photo",
      sourceId: params.id,
      payload: { unlockType: "POINTS", pointsCost: photo.pointsCost, ledgerEntryId },
    }),
  ]);

  return NextResponse.json({ data: rows[0] }, { status: 201 });
}
