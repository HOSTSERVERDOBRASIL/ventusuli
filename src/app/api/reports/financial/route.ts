import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.string().trim().min(1).optional(),
});

type FinancialRow = {
  payment_id: string;
  athlete_name: string;
  athlete_email: string;
  event_name: string;
  distance_label: string;
  amount_cents: number;
  payment_status: string;
  created_at: Date;
};

export interface FinancialReportResponse {
  data: FinancialRow[];
  totals: {
    totalCobrado: number;
    totalPago: number;
    totalPendente: number;
  };
}

function getAuthContext(req: NextRequest) {
  const role = req.headers.get("x-user-role") as UserRole | null;
  const orgId = req.headers.get("x-org-id");
  if (!role || !orgId) return null;
  return { role, orgId };
}

function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdmin(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    startDate: req.nextUrl.searchParams.get("startDate") ?? undefined,
    endDate: req.nextUrl.searchParams.get("endDate") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : defaultStart;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : now;
  const status = parsed.data.status;

  const statusClause = status
    ? Prisma.sql`AND p.status = ${status}`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<FinancialRow[]>`
    SELECT
      p.id AS payment_id,
      u.name AS athlete_name,
      u.email AS athlete_email,
      e.name AS event_name,
      d.label AS distance_label,
      p.amount_cents,
      p.status AS payment_status,
      p.created_at
    FROM "public"."payments" p
    INNER JOIN "public"."registrations" r ON r.id = p.registration_id
    INNER JOIN "public"."events" e ON e.id = r.event_id
    INNER JOIN "public"."event_distances" d ON d.id = r.distance_id
    INNER JOIN "public"."users" u ON u.id = r.user_id
    WHERE p.organization_id = ${auth.orgId}
      AND p.created_at >= ${startDate}
      AND p.created_at <= ${endDate}
      ${statusClause}
    ORDER BY p.created_at DESC
    LIMIT 1000
  `;

  const totalCobrado = rows.reduce((acc, row) => acc + row.amount_cents, 0);
  const totalPago = rows
    .filter((row) => row.payment_status === "PAID")
    .reduce((acc, row) => acc + row.amount_cents, 0);
  const totalPendente = rows
    .filter((row) => row.payment_status === "PENDING")
    .reduce((acc, row) => acc + row.amount_cents, 0);

  const payload: FinancialReportResponse = {
    data: rows,
    totals: {
      totalCobrado,
      totalPago,
      totalPendente,
    },
  };

  return NextResponse.json(payload);
}
