import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

interface CreditRow {
  id: string;
  userId: string;
  points: number | bigint;
  createdAt: Date;
}

interface ExpiringWarningRow {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  pointsExpiring: number | bigint;
}

interface ExpirationResult {
  usersAffected: number;
  pointsExpired: number;
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

async function insertExpirationLedger(params: {
  orgId: string;
  userId: string;
  points: number;
  referenceCode: string;
  description: string;
}): Promise<boolean> {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM public."AthletePointLedger"
    WHERE "referenceCode" = ${params.referenceCode}
    LIMIT 1
  `;

  if (existing[0]) return false;

  const latest = await prisma.$queryRaw<Array<{ balanceAfter: number | bigint | null }>>`
    SELECT "balanceAfter"
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${params.orgId}
      AND "userId" = ${params.userId}
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 1
  `;

  const previousBalance = toNumber(latest[0]?.balanceAfter);
  const balanceAfter = previousBalance + params.points;

  await prisma.$executeRaw`
    INSERT INTO public."AthletePointLedger" (
      id,
      "organizationId",
      "userId",
      "eventId",
      "registrationId",
      type,
      "sourceType",
      points,
      "balanceAfter",
      description,
      "referenceCode",
      "createdBy",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${params.orgId},
      ${params.userId},
      NULL,
      NULL,
      'EXPIRATION',
      'EXPIRATION',
      ${params.points},
      ${balanceAfter},
      ${params.description},
      ${params.referenceCode},
      'system:expiration',
      NOW()
    )
  `;

  return true;
}

export async function expirePoints(orgId: string): Promise<ExpirationResult> {
  const cutoffDate = new Date();
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - 12);

  const credits = await prisma.$queryRaw<CreditRow[]>`
    SELECT
      c.id,
      c."userId",
      c.points,
      c."createdAt"
    FROM public."AthletePointLedger" c
    WHERE c."organizationId" = ${orgId}
      AND c.type = 'CREDIT'
      AND c.points > 0
      AND c."createdAt" < ${cutoffDate}
      AND NOT EXISTS (
        SELECT 1
        FROM public."AthletePointLedger" e
        WHERE e."organizationId" = c."organizationId"
          AND e."userId" = c."userId"
          AND e.type = 'EXPIRATION'
          AND e."referenceCode" = ('EXP-' || c.id)
      )
    ORDER BY c."userId" ASC, c."createdAt" ASC, c.id ASC
  `;

  const byUser = new Map<string, CreditRow[]>();
  for (const row of credits) {
    const key = row.userId;
    const list = byUser.get(key) ?? [];
    list.push(row);
    byUser.set(key, list);
  }

  let pointsExpired = 0;
  let usersAffected = 0;

  for (const [userId, rows] of byUser.entries()) {
    let userExpired = 0;

    for (const row of rows) {
      const pointsToExpire = -Math.abs(toNumber(row.points));
      const referenceCode = `EXP-${row.id}`;
      const createdAtLabel = new Date(row.createdAt).toLocaleDateString("pt-BR");
      const description = `Expiracao de pontos creditados em ${createdAtLabel}`;

      const created = await insertExpirationLedger({
        orgId,
        userId,
        points: pointsToExpire,
        referenceCode,
        description,
      });

      if (created) {
        userExpired += Math.abs(pointsToExpire);
      }
    }

    if (userExpired > 0) {
      usersAffected += 1;
      pointsExpired += userExpired;
    }
  }

  return { usersAffected, pointsExpired };
}

export async function getExpiringWarnings(
  orgId: string,
  daysAhead: number,
): Promise<Array<{ userId: string; userName: string; userEmail: string; pointsExpiring: number }>> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCMonth(windowStart.getUTCMonth() - 12);

  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAhead);

  const rows = await prisma.$queryRaw<ExpiringWarningRow[]>`
    SELECT
      c."userId" AS "userId",
      u.name AS "userName",
      u.email AS "userEmail",
      COALESCE(SUM(c.points), 0) AS "pointsExpiring"
    FROM public."AthletePointLedger" c
    INNER JOIN public.users u ON u.id = c."userId"
    WHERE c."organizationId" = ${orgId}
      AND c.type = 'CREDIT'
      AND c.points > 0
      AND c."createdAt" >= ${windowStart}
      AND c."createdAt" < ${windowEnd}
      AND NOT EXISTS (
        SELECT 1
        FROM public."AthletePointLedger" e
        WHERE e."organizationId" = c."organizationId"
          AND e."userId" = c."userId"
          AND e.type = 'EXPIRATION'
          AND e."referenceCode" = ('EXP-' || c.id)
      )
    GROUP BY c."userId", u.name, u.email
    HAVING COALESCE(SUM(c.points), 0) > 0
    ORDER BY "pointsExpiring" DESC, u.name ASC
  `;

  return rows.map((row) => ({
    userId: row.userId,
    userName: row.userName ?? "",
    userEmail: row.userEmail ?? "",
    pointsExpiring: toNumber(row.pointsExpiring),
  }));
}
