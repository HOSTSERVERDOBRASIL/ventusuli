import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuthAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { recordInternalEvent } from "@/lib/internal-events";
import { createCuidLike } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";
import { isAllowedImageUrl } from "@/lib/storage/image-url";

interface SponsorRow {
  id: string;
  organizationId: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  websiteUrl: string | null;
  sponsorType: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  campaignsCount: number | bigint;
  placementsCount: number | bigint;
}

interface CountRow {
  total: number | bigint;
}

const querySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  name: z.string().trim().min(2),
  logoUrl: z
    .string()
    .trim()
    .min(1)
    .refine((value) => isAllowedImageUrl(value), "Logo invalida.")
    .optional()
    .nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  websiteUrl: z.string().trim().url().optional().nullable(),
  sponsorType: z.string().trim().min(1).default("BRAND"),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Query invalida.", 400);

  const { status, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const filters: Prisma.Sql[] = [Prisma.sql`s."organizationId" = ${auth.organizationId}`];
  if (status) filters.push(Prisma.sql`s.status = ${status}::"public"."SponsorStatus"`);
  const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM public.sponsors s
      ${whereSql}
    `),
    prisma.$queryRaw<SponsorRow[]>(Prisma.sql`
      SELECT
        s.*,
        COUNT(DISTINCT c.id)::bigint AS "campaignsCount",
        COUNT(DISTINCT p.id)::bigint AS "placementsCount"
      FROM public.sponsors s
      LEFT JOIN public.sponsor_campaigns c ON c."sponsorId" = s.id
      LEFT JOIN public.sponsor_placements p ON p."sponsorId" = s.id
      ${whereSql}
      GROUP BY s.id
      ORDER BY s."createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  return NextResponse.json({
    data: rows.map((row) => ({
      ...row,
      campaignsCount: Number(row.campaignsCount),
      placementsCount: Number(row.placementsCount),
    })),
    total,
    page,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const payload = parsed.data;
  const id = createCuidLike();
  const rows = await prisma.$queryRaw<SponsorRow[]>(Prisma.sql`
    INSERT INTO public.sponsors (
      id,
      "organizationId",
      name,
      "logoUrl",
      description,
      "websiteUrl",
      "sponsorType",
      status,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${auth.organizationId},
      ${payload.name},
      ${payload.logoUrl ?? null},
      ${payload.description ?? null},
      ${payload.websiteUrl ?? null},
      ${payload.sponsorType},
      ${payload.status}::"public"."SponsorStatus",
      NOW(),
      NOW()
    )
    RETURNING *, 0::bigint AS "campaignsCount", 0::bigint AS "placementsCount"
  `);

  await Promise.all([
    writeAuthAuditLog(req, auth, {
      action: "sponsor.created",
      entityType: "Sponsor",
      entityId: id,
      afterData: payload,
    }),
    recordInternalEvent({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name: "sponsor.created",
      sourceType: "Sponsor",
      sourceId: id,
      payload,
    }),
  ]);

  return NextResponse.json({ data: rows[0] }, { status: 201 });
}
