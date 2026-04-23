import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const querySchema = z.object({
  status: z.enum(["REQUESTED", "PENDING_PAYMENT", "APPROVED", "SEPARATED", "DELIVERED", "CANCELLED", "PAYMENT_FAILED"]).optional(),
  userId: z.string().min(1).optional(),
  rewardItemId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface CountRow {
  total: number | bigint;
}

interface AdminRedemptionRow {
  id: string;
  status: string;
  requestedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  pointsUsed: number;
  cashPaidCents: number;
  notes: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  rewardItemId: string;
  rewardItemName: string | null;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    userId: req.nextUrl.searchParams.get("userId") ?? undefined,
    rewardItemId: req.nextUrl.searchParams.get("rewardItemId") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const { status, userId, rewardItemId, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const filters: Prisma.Sql[] = [Prisma.sql`r."organizationId" = ${auth.organizationId}`];
  if (status) filters.push(Prisma.sql`r.status = ${status}`);
  if (userId) filters.push(Prisma.sql`r."userId" = ${userId}`);
  if (rewardItemId) filters.push(Prisma.sql`r."rewardItemId" = ${rewardItemId}`);

  const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM public."RewardRedemption" r
      ${whereSql}
    `),
    prisma.$queryRaw<AdminRedemptionRow[]>(Prisma.sql`
      SELECT
        r.id,
        r.status,
        r."requestedAt",
        r."deliveredAt",
        r."cancelledAt",
        r."pointsUsed",
        r."cashPaidCents",
        r.notes,
        u.id AS "userId",
        u.name AS "userName",
        u.email AS "userEmail",
        i.id AS "rewardItemId",
        i.name AS "rewardItemName"
      FROM public."RewardRedemption" r
      LEFT JOIN public.users u ON u.id = r."userId"
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
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt,
    deliveredAt: row.deliveredAt,
    cancelledAt: row.cancelledAt,
    pointsUsed: row.pointsUsed,
    cashPaidCents: row.cashPaidCents,
    notes: row.notes,
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
    },
    rewardItem: {
      id: row.rewardItemId,
      name: row.rewardItemName,
    },
  }));

  return NextResponse.json({ data, total, page, totalPages });
}
