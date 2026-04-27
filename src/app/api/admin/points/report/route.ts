import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventId: z.string().min(1).optional(),
  sourceType: z
    .enum([
      "EVENT_PARTICIPATION",
      "EARLY_SIGNUP",
      "EARLY_PAYMENT",
      "CAMPAIGN_BONUS",
      "REFERRAL",
      "RECURRENCE",
      "MANUAL",
      "REDEMPTION",
      "REFUND",
      "EXPIRATION",
    ])
    .optional(),
});

interface TotalsRow {
  totalPointsIssued: number | bigint | null;
  totalPointsRedeemed: number | bigint | null;
  totalPointsExpired: number | bigint | null;
}

interface CountRow {
  total: number | bigint;
}

interface CashCollectedRow {
  total: number | bigint | null;
}

interface RedemptionsByCategoryRow {
  category: string;
  count: number | bigint;
  pointsUsed: number | bigint | null;
  cashCollectedCents: number | bigint | null;
}

interface TopItemRow {
  rewardItemId: string;
  name: string;
  count: number | bigint;
}

interface RedemptionsByStatusRow {
  status: string;
  count: number | bigint;
}

interface PointsBySourceRow {
  sourceType: string;
  type: string;
  points: number | bigint | null;
  count: number | bigint;
}

interface LedgerMovementRow {
  id: string;
  sourceType: string;
  type: string;
  points: number | bigint;
  balanceAfter: number | bigint;
  description: string;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
  eventName: string | null;
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

function resolvePeriod(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("period_invalid_date");
  }

  if (start.getTime() > end.getTime()) {
    throw new Error("period_start_after_end");
  }

  return { start, end };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    startDate: req.nextUrl.searchParams.get("startDate") ?? undefined,
    endDate: req.nextUrl.searchParams.get("endDate") ?? undefined,
    eventId: req.nextUrl.searchParams.get("eventId") ?? undefined,
    sourceType: req.nextUrl.searchParams.get("sourceType") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  let period: { start: Date; end: Date };
  try {
    period = resolvePeriod(parsed.data.startDate, parsed.data.endDate);
  } catch {
    return apiError("VALIDATION_ERROR", "Periodo invalido: startDate deve ser menor ou igual a endDate.", 400);
  }

  const ledgerFilters: Prisma.Sql[] = [
    Prisma.sql`l."organizationId" = ${auth.organizationId}`,
    Prisma.sql`l."createdAt" >= ${period.start}`,
    Prisma.sql`l."createdAt" <= ${period.end}`,
  ];
  if (parsed.data.eventId) ledgerFilters.push(Prisma.sql`l."eventId" = ${parsed.data.eventId}`);
  if (parsed.data.sourceType) ledgerFilters.push(Prisma.sql`l."sourceType" = ${parsed.data.sourceType}`);
  const ledgerWhere = Prisma.sql`WHERE ${Prisma.join(ledgerFilters, " AND ")}`;

  const [
    totalsRows,
    activeUsersRows,
    cashCollectedRows,
    byCategoryRows,
    topItemsRows,
    byStatusRows,
    bySourceRows,
    movementRows,
  ] = await Promise.all([
    prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN points ELSE 0 END), 0) AS "totalPointsIssued",
        COALESCE(SUM(CASE WHEN "sourceType" = 'REDEMPTION' THEN ABS(points) ELSE 0 END), 0) AS "totalPointsRedeemed",
        COALESCE(SUM(CASE WHEN type = 'EXPIRATION' THEN ABS(points) ELSE 0 END), 0) AS "totalPointsExpired"
      FROM public."AthletePointLedger" l
      ${ledgerWhere}
    `),
    prisma.$queryRaw<CountRow[]>`
      WITH latest AS (
        SELECT
          "userId",
          "balanceAfter",
          ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC, id DESC) AS rn
        FROM public."AthletePointLedger"
        WHERE "organizationId" = ${auth.organizationId}
      )
      SELECT COUNT(*)::bigint AS total
      FROM latest
      WHERE rn = 1
        AND "balanceAfter" > 0
    `,
    prisma.$queryRaw<CashCollectedRow[]>`
      SELECT COALESCE(SUM("cashPaidCents"), 0) AS total
      FROM public."RewardRedemption"
      WHERE "organizationId" = ${auth.organizationId}
        AND status IN ('APPROVED', 'SEPARATED', 'DELIVERED')
        AND "requestedAt" >= ${period.start}
        AND "requestedAt" <= ${period.end}
    `,
    prisma.$queryRaw<RedemptionsByCategoryRow[]>`
      SELECT
        COALESCE(i.category, 'UNDEFINED') AS category,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(r."pointsUsed"), 0) AS "pointsUsed",
        COALESCE(
          SUM(
            CASE
              WHEN r.status IN ('APPROVED', 'SEPARATED', 'DELIVERED') THEN r."cashPaidCents"
              ELSE 0
            END
          ),
          0
        ) AS "cashCollectedCents"
      FROM public."RewardRedemption" r
      LEFT JOIN public."RewardItem" i ON i.id = r."rewardItemId"
      WHERE r."organizationId" = ${auth.organizationId}
        AND r."requestedAt" >= ${period.start}
        AND r."requestedAt" <= ${period.end}
      GROUP BY COALESCE(i.category, 'UNDEFINED')
      ORDER BY count DESC, category ASC
    `,
    prisma.$queryRaw<TopItemRow[]>`
      SELECT
        r."rewardItemId" AS "rewardItemId",
        COALESCE(i.name, 'Item removido') AS name,
        COUNT(*)::bigint AS count
      FROM public."RewardRedemption" r
      LEFT JOIN public."RewardItem" i ON i.id = r."rewardItemId"
      WHERE r."organizationId" = ${auth.organizationId}
        AND r."requestedAt" >= ${period.start}
        AND r."requestedAt" <= ${period.end}
      GROUP BY r."rewardItemId", COALESCE(i.name, 'Item removido')
      ORDER BY count DESC, name ASC
      LIMIT 5
    `,
    prisma.$queryRaw<RedemptionsByStatusRow[]>`
      SELECT
        status,
        COUNT(*)::bigint AS count
      FROM public."RewardRedemption"
      WHERE "organizationId" = ${auth.organizationId}
        AND "requestedAt" >= ${period.start}
        AND "requestedAt" <= ${period.end}
      GROUP BY status
      ORDER BY count DESC, status ASC
    `,
    prisma.$queryRaw<PointsBySourceRow[]>(Prisma.sql`
      SELECT
        l."sourceType" AS "sourceType",
        l.type,
        COALESCE(SUM(ABS(l.points)), 0) AS points,
        COUNT(*)::bigint AS count
      FROM public."AthletePointLedger" l
      ${ledgerWhere}
      GROUP BY l."sourceType", l.type
      ORDER BY points DESC, l."sourceType" ASC
    `),
    prisma.$queryRaw<LedgerMovementRow[]>(Prisma.sql`
      SELECT
        l.id,
        l."sourceType",
        l.type,
        l.points,
        l."balanceAfter",
        l.description,
        l."createdAt",
        u.name AS "userName",
        u.email AS "userEmail",
        e.name AS "eventName"
      FROM public."AthletePointLedger" l
      LEFT JOIN public.users u ON u.id = l."userId"
      LEFT JOIN public.events e ON e.id = l."eventId"
      ${ledgerWhere}
      ORDER BY l."createdAt" DESC, l.id DESC
      LIMIT 25
    `),
  ]);

  const totals = totalsRows[0] ?? {
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    totalPointsExpired: 0,
  };

  return NextResponse.json({
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    totalPointsIssued: toNumber(totals.totalPointsIssued),
    totalPointsRedeemed: toNumber(totals.totalPointsRedeemed),
    totalPointsExpired: toNumber(totals.totalPointsExpired),
    activeUsersWithBalance: toNumber(activeUsersRows[0]?.total ?? 0),
    cashCollectedCents: toNumber(cashCollectedRows[0]?.total ?? 0),
    redemptionsByCategory: byCategoryRows.map((row) => ({
      category: row.category,
      count: toNumber(row.count),
      pointsUsed: toNumber(row.pointsUsed),
      cashCollectedCents: toNumber(row.cashCollectedCents),
    })),
    topItems: topItemsRows.map((row) => ({
      rewardItemId: row.rewardItemId,
      name: row.name,
      count: toNumber(row.count),
    })),
    redemptionsByStatus: byStatusRows.map((row) => ({
      status: row.status,
      count: toNumber(row.count),
    })),
    pointsBySource: bySourceRows.map((row) => ({
      sourceType: row.sourceType,
      type: row.type,
      points: toNumber(row.points),
      count: toNumber(row.count),
    })),
    recentMovements: movementRows.map((row) => ({
      id: row.id,
      sourceType: row.sourceType,
      type: row.type,
      points: toNumber(row.points),
      balanceAfter: toNumber(row.balanceAfter),
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      athleteName: row.userName,
      athleteEmail: row.userEmail,
      eventName: row.eventName,
    })),
  });
}
