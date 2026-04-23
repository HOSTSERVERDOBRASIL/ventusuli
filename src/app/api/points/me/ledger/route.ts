import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

interface LedgerRow {
  id: string;
  eventId: string | null;
  registrationId: string | null;
  type: string;
  sourceType: string;
  points: number | bigint;
  balanceAfter: number | bigint;
  description: string;
  referenceCode: string;
  createdBy: string;
  createdAt: Date;
  eventName: string | null;
}

interface CountRow {
  total: number | bigint;
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
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

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS total
      FROM public."AthletePointLedger"
      WHERE "organizationId" = ${auth.organizationId}
        AND "userId" = ${auth.userId}
    `,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT
        l.id,
        l."eventId",
        l."registrationId",
        l.type,
        l."sourceType",
        l.points,
        l."balanceAfter",
        l.description,
        l."referenceCode",
        l."createdBy",
        l."createdAt",
        e.name AS "eventName"
      FROM public."AthletePointLedger" l
      LEFT JOIN public.events e ON e.id = l."eventId"
      WHERE l."organizationId" = ${auth.organizationId}
        AND l."userId" = ${auth.userId}
      ORDER BY l."createdAt" DESC, l.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

  const data = rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    registrationId: row.registrationId,
    type: row.type,
    sourceType: row.sourceType,
    points: toNumber(row.points),
    balanceAfter: toNumber(row.balanceAfter),
    description: row.description,
    referenceCode: row.referenceCode,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    event: row.eventId
      ? {
          id: row.eventId,
          name: row.eventName,
        }
      : null,
  }));

  return NextResponse.json({ data, total, page, totalPages });
}
