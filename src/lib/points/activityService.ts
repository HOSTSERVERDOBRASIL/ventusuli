import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { creditPointsInTransaction } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";

export type PointActivityEntryStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PointActivityEntrySource = "ADMIN" | "USER";

interface PointActivityRow {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  suggestedPoints: number;
  activityDate: Date;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PointActivityEntryRow {
  id: string;
  organizationId: string;
  activityId: string;
  userId: string;
  points: number;
  status: PointActivityEntryStatus;
  source: PointActivityEntrySource;
  note: string | null;
  proofUrl: string | null;
  referenceCode: string;
  ledgerEntryId: string | null;
  createdBy: string;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  activityName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}

interface CountRow {
  total: number | bigint;
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function mapActivity(row: PointActivityRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    suggestedPoints: toNumber(row.suggestedPoints),
    activityDate: row.activityDate.toISOString(),
    active: row.active,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEntry(row: PointActivityEntryRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    activityId: row.activityId,
    userId: row.userId,
    points: toNumber(row.points),
    status: row.status,
    source: row.source,
    note: row.note,
    proofUrl: row.proofUrl,
    referenceCode: row.referenceCode,
    ledgerEntryId: row.ledgerEntryId,
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    activityName: row.activityName ?? null,
    userName: row.userName ?? null,
    userEmail: row.userEmail ?? null,
  };
}

export async function listPointActivities(params: {
  organizationId: string;
  active?: boolean;
}) {
  const rows = await prisma.$queryRaw<PointActivityRow[]>(Prisma.sql`
    SELECT
      id,
      "organizationId",
      name,
      description,
      "suggestedPoints",
      "activityDate",
      active,
      "createdBy",
      "createdAt",
      "updatedAt"
    FROM public.point_activities
    WHERE "organizationId" = ${params.organizationId}
      ${params.active === undefined ? Prisma.empty : Prisma.sql`AND active = ${params.active}`}
    ORDER BY "activityDate" DESC, "createdAt" DESC
  `);

  return rows.map(mapActivity);
}

export async function createPointActivity(params: {
  organizationId: string;
  name: string;
  description?: string | null;
  suggestedPoints?: number;
  activityDate: Date;
  createdBy: string;
}) {
  const rows = await prisma.$queryRaw<PointActivityRow[]>(Prisma.sql`
    INSERT INTO public.point_activities (
      id,
      "organizationId",
      name,
      description,
      "suggestedPoints",
      "activityDate",
      active,
      "createdBy",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${params.organizationId},
      ${params.name},
      ${params.description ?? null},
      ${params.suggestedPoints ?? 0},
      ${params.activityDate},
      true,
      ${params.createdBy},
      NOW(),
      NOW()
    )
    RETURNING *
  `);

  return mapActivity(rows[0]);
}

export async function listPointActivityEntries(params: {
  organizationId: string;
  status?: PointActivityEntryStatus;
  activityId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;

  const filters: Prisma.Sql[] = [Prisma.sql`e."organizationId" = ${params.organizationId}`];
  if (params.status) filters.push(Prisma.sql`e.status = ${params.status}::"public"."PointActivityEntryStatus"`);
  if (params.activityId) filters.push(Prisma.sql`e."activityId" = ${params.activityId}`);
  if (params.userId) filters.push(Prisma.sql`e."userId" = ${params.userId}`);

  const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM public.point_activity_entries e
      ${whereSql}
    `),
    prisma.$queryRaw<PointActivityEntryRow[]>(Prisma.sql`
      SELECT
        e.*,
        a.name AS "activityName",
        u.name AS "userName",
        u.email AS "userEmail"
      FROM public.point_activity_entries e
      INNER JOIN public.point_activities a ON a.id = e."activityId"
      INNER JOIN public.users u ON u.id = e."userId"
      ${whereSql}
      ORDER BY
        CASE WHEN e.status = 'PENDING' THEN 0 ELSE 1 END,
        e."createdAt" DESC,
        e.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
  ]);

  const total = toNumber(countRows[0]?.total);
  return {
    data: rows.map(mapEntry),
    total,
    page,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
  };
}

export async function createPointActivityEntry(params: {
  organizationId: string;
  activityId: string;
  userId: string;
  points: number;
  source: PointActivityEntrySource;
  note?: string | null;
  proofUrl?: string | null;
  createdBy: string;
}) {
  const referenceCode = `ACTIVITY-${params.activityId}-${params.userId}`;

  const rows = await prisma.$queryRaw<PointActivityEntryRow[]>(Prisma.sql`
    INSERT INTO public.point_activity_entries (
      id,
      "organizationId",
      "activityId",
      "userId",
      points,
      status,
      source,
      note,
      "proofUrl",
      "referenceCode",
      "createdBy",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${params.organizationId},
      ${params.activityId},
      ${params.userId},
      ${params.points},
      'PENDING'::"public"."PointActivityEntryStatus",
      ${params.source}::"public"."PointActivityEntrySource",
      ${params.note ?? null},
      ${params.proofUrl ?? null},
      ${referenceCode},
      ${params.createdBy},
      NOW(),
      NOW()
    )
    RETURNING *
  `);

  return mapEntry(rows[0]);
}

export async function updatePendingPointActivityEntry(params: {
  organizationId: string;
  entryId: string;
  points?: number;
  note?: string | null;
  proofUrl?: string | null;
}) {
  const rows = await prisma.$queryRaw<PointActivityEntryRow[]>(Prisma.sql`
    UPDATE public.point_activity_entries
    SET
      points = COALESCE(${params.points ?? null}, points),
      note = COALESCE(${params.note ?? null}, note),
      "proofUrl" = COALESCE(${params.proofUrl ?? null}, "proofUrl"),
      "updatedAt" = NOW()
    WHERE id = ${params.entryId}
      AND "organizationId" = ${params.organizationId}
      AND status = 'PENDING'::"public"."PointActivityEntryStatus"
    RETURNING *
  `);

  return rows[0] ? mapEntry(rows[0]) : null;
}

export async function reviewPointActivityEntry(params: {
  organizationId: string;
  entryId: string;
  action: "APPROVE" | "REJECT";
  adminId: string;
  note?: string | null;
  points?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<PointActivityEntryRow[]>(Prisma.sql`
      SELECT *
      FROM public.point_activity_entries
      WHERE id = ${params.entryId}
        AND "organizationId" = ${params.organizationId}
      LIMIT 1
    `);

    const entry = existing[0];
    if (!entry) return null;
    if (entry.status !== "PENDING") return mapEntry(entry);

    if (params.action === "REJECT") {
      const rejectedRows = await tx.$queryRaw<PointActivityEntryRow[]>(Prisma.sql`
        UPDATE public.point_activity_entries
        SET
          status = 'REJECTED'::"public"."PointActivityEntryStatus",
          note = COALESCE(${params.note ?? null}, note),
          "approvedBy" = ${params.adminId},
          "rejectedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id = ${params.entryId}
          AND "organizationId" = ${params.organizationId}
        RETURNING *
      `);

      return mapEntry(rejectedRows[0]);
    }

    const approvedPoints = params.points ?? entry.points;
    const ledgerResult = await creditPointsInTransaction(tx, {
      orgId: params.organizationId,
      userId: entry.userId,
      sourceType: "ACTIVITY_APPROVAL",
      points: approvedPoints,
      description: `Pontuacao aprovada para atividade ${entry.activityId}`,
      referenceCode: entry.referenceCode,
      createdBy: params.adminId,
    });

    const approvedRows = await tx.$queryRaw<PointActivityEntryRow[]>(Prisma.sql`
      UPDATE public.point_activity_entries
      SET
        points = ${approvedPoints},
        status = 'APPROVED'::"public"."PointActivityEntryStatus",
        note = COALESCE(${params.note ?? null}, note),
        "approvedBy" = ${params.adminId},
        "approvedAt" = NOW(),
        "ledgerEntryId" = ${ledgerResult.entry.id},
        "updatedAt" = NOW()
      WHERE id = ${params.entryId}
        AND "organizationId" = ${params.organizationId}
      RETURNING *
    `);

    return mapEntry(approvedRows[0]);
  });
}

export async function listUserPointActivityEntries(params: {
  organizationId: string;
  userId: string;
  page?: number;
  limit?: number;
}) {
  return listPointActivityEntries({
    organizationId: params.organizationId,
    userId: params.userId,
    page: params.page,
    limit: params.limit,
  });
}
