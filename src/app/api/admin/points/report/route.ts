import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
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

  const [
    totalsRows,
    activeUsersRows,
    cashCollectedRows,
    byCategoryRows,
    topItemsRows,
    byStatusRows,
  ] = await Promise.all([
    prisma.$queryRaw<TotalsRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN points ELSE 0 END), 0) AS "totalPointsIssued",
        COALESCE(SUM(CASE WHEN "sourceType" = 'REDEMPTION' THEN ABS(points) ELSE 0 END), 0) AS "totalPointsRedeemed",
        COALESCE(SUM(CASE WHEN type = 'EXPIRATION' THEN ABS(points) ELSE 0 END), 0) AS "totalPointsExpired"
      FROM public."AthletePointLedger"
      WHERE "organizationId" = ${auth.organizationId}
        AND "createdAt" >= ${period.start}
        AND "createdAt" <= ${period.end}
    `,
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
  });
}
