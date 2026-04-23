import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getUserPointsBalance } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface RewardItemRow {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  pointsCost: number;
  cashPriceCents: number;
  allowPoints: boolean;
  allowCash: boolean;
  allowMixed: boolean;
  maxPointsDiscountPercent: number;
  minimumCashCents: number;
  stockQuantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const querySchema = z.object({
  category: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface CountRow {
  total: number | bigint;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);

  const parsed = querySchema.safeParse({
    category: req.nextUrl.searchParams.get("category") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  const page = parsed.success ? parsed.data.page : 1;
  const limit = parsed.success ? parsed.data.limit : 20;
  const category = parsed.success ? parsed.data.category : undefined;
  const offset = (page - 1) * limit;

  const filters: Prisma.Sql[] = [Prisma.sql`active = true`, Prisma.sql`"stockQuantity" > 0`];
  if (category) filters.push(Prisma.sql`category = ${category}`);
  if (auth?.organizationId) filters.push(Prisma.sql`"organizationId" = ${auth.organizationId}`);

  const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM public."RewardItem"
      ${whereSql}
    `),
    prisma.$queryRaw<RewardItemRow[]>(Prisma.sql`
      SELECT *
      FROM public."RewardItem"
      ${whereSql}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
  ]);

  let currentBalance: number | null = null;
  if (auth) {
    try {
      const balance = await getUserPointsBalance(auth.userId, auth.organizationId);
      currentBalance = balance.balance;
    } catch {
      currentBalance = null;
    }
  }

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

  return NextResponse.json({ data: rows, total, page, totalPages, currentBalance });
}
