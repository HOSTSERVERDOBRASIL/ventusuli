import { randomUUID } from "crypto";
import { getOrganizationPointPolicy } from "@/lib/points/policy";
import { prisma } from "@/lib/prisma";

export interface LedgerRow {
  id: string;
  userId: string;
  points: number | bigint;
  type: string;
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

interface CreditBucket {
  id: string;
  userId: string;
  points: number;
  remaining: number;
  createdAt: Date;
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

function subtractMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() - months);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function buildAvailableCreditBuckets(rows: LedgerRow[]): CreditBucket[] {
  const buckets: CreditBucket[] = [];

  for (const row of rows) {
    const points = toNumber(row.points);

    if (row.type === "CREDIT" && points > 0) {
      buckets.push({
        id: row.id,
        userId: row.userId,
        points,
        remaining: points,
        createdAt: row.createdAt,
      });
      continue;
    }

    if (points >= 0) continue;

    let debitRemaining = Math.abs(points);
    for (const bucket of buckets) {
      if (bucket.remaining <= 0) continue;
      const consumed = Math.min(bucket.remaining, debitRemaining);
      bucket.remaining -= consumed;
      debitRemaining -= consumed;
      if (debitRemaining <= 0) break;
    }
  }

  return buckets.filter((bucket) => bucket.remaining > 0);
}

async function insertExpirationLedger(params: {
  orgId: string;
  userId: string;
  points: number;
  referenceCode: string;
  description: string;
}): Promise<number> {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM public."AthletePointLedger"
    WHERE "referenceCode" = ${params.referenceCode}
    LIMIT 1
  `;

  if (existing[0]) return 0;

  const latest = await prisma.$queryRaw<Array<{ balanceAfter: number | bigint | null }>>`
    SELECT "balanceAfter"
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${params.orgId}
      AND "userId" = ${params.userId}
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 1
  `;

  const previousBalance = toNumber(latest[0]?.balanceAfter);
  const pointsToExpire = Math.min(Math.abs(params.points), previousBalance);
  if (pointsToExpire <= 0) return 0;

  const points = -pointsToExpire;
  const balanceAfter = previousBalance + points;

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
      ${points},
      ${balanceAfter},
      ${params.description},
      ${params.referenceCode},
      'system:expiration',
      NOW()
    )
  `;

  return pointsToExpire;
}

export async function expirePoints(orgId: string): Promise<ExpirationResult> {
  const policy = await getOrganizationPointPolicy(orgId);
  const cutoffDate = subtractMonths(new Date(), policy.expirationMonths);

  const ledgerRows = await prisma.$queryRaw<LedgerRow[]>`
    SELECT
      id,
      "userId",
      points,
      type,
      "createdAt"
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${orgId}
    ORDER BY "userId" ASC, "createdAt" ASC, id ASC
  `;

  const byUser = new Map<string, LedgerRow[]>();
  for (const row of ledgerRows) {
    const key = row.userId;
    const list = byUser.get(key) ?? [];
    list.push(row);
    byUser.set(key, list);
  }

  let pointsExpired = 0;
  let usersAffected = 0;

  for (const [userId, rows] of byUser.entries()) {
    let userExpired = 0;

    const expirableBuckets = buildAvailableCreditBuckets(rows).filter(
      (bucket) => bucket.createdAt < cutoffDate,
    );

    for (const bucket of expirableBuckets) {
      const pointsToExpire = -Math.abs(bucket.remaining);
      const referenceCode = `EXP-${bucket.id}`;
      const createdAtLabel = new Date(bucket.createdAt).toLocaleDateString("pt-BR");
      const description = `Expiracao de pontos creditados em ${createdAtLabel}`;

      const expiredPoints = await insertExpirationLedger({
        orgId,
        userId,
        points: pointsToExpire,
        referenceCode,
        description,
      });

      if (expiredPoints > 0) {
        userExpired += expiredPoints;
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
  const policy = await getOrganizationPointPolicy(orgId);
  const now = new Date();
  const windowStart = subtractMonths(now, policy.expirationMonths);

  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAhead);

  const ledgerRows = await prisma.$queryRaw<LedgerRow[]>`
    SELECT
      id,
      "userId",
      points,
      type,
      "createdAt"
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${orgId}
    ORDER BY "userId" ASC, "createdAt" ASC, id ASC
  `;

  const userIds = Array.from(new Set(ledgerRows.map((row) => row.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, organization_id: orgId },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const byUser = new Map<string, LedgerRow[]>();
  for (const row of ledgerRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  const warnings: ExpiringWarningRow[] = [];
  for (const [userId, rows] of byUser.entries()) {
    const pointsExpiring = buildAvailableCreditBuckets(rows)
      .filter((bucket) => bucket.createdAt >= windowStart && bucket.createdAt < windowEnd)
      .reduce((total, bucket) => total + bucket.remaining, 0);

    if (pointsExpiring <= 0) continue;
    const user = usersById.get(userId);
    warnings.push({
      userId,
      userName: user?.name ?? "",
      userEmail: user?.email ?? "",
      pointsExpiring,
    });
  }

  return warnings
    .sort(
      (a, b) =>
        toNumber(b.pointsExpiring) - toNumber(a.pointsExpiring) ||
        (a.userName ?? "").localeCompare(b.userName ?? ""),
    )
    .map((row) => ({
      userId: row.userId,
      userName: row.userName ?? "",
      userEmail: row.userEmail ?? "",
      pointsExpiring: toNumber(row.pointsExpiring),
    }));
}

export function getCreditExpirationDate(createdAt: Date, expirationMonths: number): Date {
  return addMonths(createdAt, expirationMonths);
}
