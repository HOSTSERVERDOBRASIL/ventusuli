import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { creditPoints } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface MissionClaimRow {
  userMissionId: string;
  missionId: string;
  missionName: string;
  rewardPoints: number;
  status: string;
  claimedAt: Date | null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const rows = await prisma.$queryRaw<MissionClaimRow[]>(Prisma.sql`
    SELECT
      um.id AS "userMissionId",
      m.id AS "missionId",
      m.name AS "missionName",
      m."rewardPoints",
      um.status::text AS status,
      um."claimedAt"
    FROM public.user_missions um
    INNER JOIN public.missions m ON m.id = um."missionId"
    WHERE um."missionId" = ${params.id}
      AND um."userId" = ${auth.userId}
      AND um."organizationId" = ${auth.organizationId}
    LIMIT 1
  `);

  const mission = rows[0];
  if (!mission) return apiError("USER_NOT_FOUND", "Missão não encontrada.", 404);
  if (mission.status === "CLAIMED" || mission.claimedAt) {
    return NextResponse.json({ data: mission, alreadyClaimed: true });
  }
  if (mission.status !== "COMPLETED") {
    return apiError("VALIDATION_ERROR", "Missão ainda não está concluída.", 400);
  }
  if (mission.rewardPoints <= 0) {
    return apiError("VALIDATION_ERROR", "Missão sem pontos para resgate.", 400);
  }

  const result = await creditPoints({
    orgId: auth.organizationId,
    userId: auth.userId,
    sourceType: "MANUAL",
    points: mission.rewardPoints,
    description: `Missão concluída: ${mission.missionName}`,
    referenceCode: `mission:${auth.organizationId}:${auth.userId}:${mission.missionId}`,
    createdBy: auth.userId,
  });

  await prisma.$executeRaw(Prisma.sql`
    UPDATE public.user_missions
    SET status = 'CLAIMED'::"public"."UserMissionStatus",
        "claimedAt" = COALESCE("claimedAt", NOW()),
        "updatedAt" = NOW()
    WHERE id = ${mission.userMissionId}
  `);

  return NextResponse.json({
    data: {
      missionId: mission.missionId,
      points: mission.rewardPoints,
      ledgerEntry: result.entry,
      created: result.created,
    },
  });
}
