import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface CountRow {
  total: number | bigint;
}

interface MeRedemptionRow {
  id: string;
  status: string;
  requestedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  pointsUsed: number;
  cashPaidCents: number;
  notes: string | null;
  rewardItemName: string | null;
  rewardItemImageUrl: string | null;
  rewardItemCategory: string | null;
}

function buildGatewayPaymentUrl(paymentId: string): string {
  return `/financeiro?payment=${paymentId}`;
}

function parseGatewayPaymentId(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/gateway_payment_id:([^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const parsed = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const whereSql = Prisma.sql`WHERE r."organizationId" = ${auth.organizationId} AND r."userId" = ${auth.userId}`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM public."RewardRedemption" r
      ${whereSql}
    `),
    prisma.$queryRaw<MeRedemptionRow[]>(Prisma.sql`
      SELECT
        r.id,
        r.status,
        r."requestedAt",
        r."deliveredAt",
        r."cancelledAt",
        r."pointsUsed",
        r."cashPaidCents",
        r.notes,
        i.name AS "rewardItemName",
        i."imageUrl" AS "rewardItemImageUrl",
        i.category AS "rewardItemCategory"
      FROM public."RewardRedemption" r
      LEFT JOIN public."RewardItem" i ON i.id = r."rewardItemId"
      ${whereSql}
      ORDER BY r."requestedAt" DESC, r.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

  const data = rows.map((row) => ({
    paymentUrl:
      row.status === "PENDING_PAYMENT"
        ? (() => {
            const paymentId = parseGatewayPaymentId(row.notes);
            return paymentId ? buildGatewayPaymentUrl(paymentId) : null;
          })()
        : null,
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt,
    deliveredAt: row.deliveredAt,
    cancelledAt: row.cancelledAt,
    pointsUsed: row.pointsUsed,
    cashPaidCents: row.cashPaidCents,
    rewardItem: {
      name: row.rewardItemName,
      imageUrl: row.rewardItemImageUrl,
      category: row.rewardItemCategory,
    },
  }));

  return NextResponse.json({ data, total, page, totalPages });
}
