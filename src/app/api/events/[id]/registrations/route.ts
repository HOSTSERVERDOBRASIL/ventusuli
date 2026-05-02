import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { reverseEventPointsForRegistrationInTransaction } from "@/lib/points/pointsService";
import { getAuthContext, isFinanceRole } from "@/lib/request-auth";

function isAdminRole(role: UserRole): boolean {
  const value = String(role);
  return (
    value === "ADMIN" ||
    value === "SUPER_ADMIN" ||
    value === "MANAGER" ||
    value === "ORGANIZER"
  );
}

interface RouteParams {
  params: { id: string };
}

interface RegistrationAttendanceRow {
  registration_id: string;
  athlete_name: string;
  athlete_email: string;
  distance_label: string;
  registration_status: string;
  payment_status: string | null;
  amount_cents: number;
  registered_at: Date;
  attendance_status: string;
  attendance_checked_at: Date | null;
  attendance_checked_by: string | null;
  check_in_at: Date | null;
  check_in_distance_m: number | null;
  check_out_at: Date | null;
  check_out_distance_m: number | null;
}

function mapRegistration(row: RegistrationAttendanceRow) {
  return {
    registration_id: row.registration_id,
    athlete_name: row.athlete_name,
    athlete_email: row.athlete_email,
    distance_label: row.distance_label,
    registration_status: row.registration_status,
    payment_status: row.payment_status ?? "PENDING",
    amount_cents: row.amount_cents,
    registered_at: row.registered_at,
    attendance_status: row.attendance_status,
    attendance_checked_at: row.attendance_checked_at,
    attendance_checked_by: row.attendance_checked_by,
    check_in_at: row.check_in_at,
    check_in_distance_m: row.check_in_distance_m,
    check_out_at: row.check_out_at,
    check_out_distance_m: row.check_out_distance_m,
  };
}

async function getEventRegistrationRows(eventId: string, organizationId: string) {
  return prisma.$queryRaw<RegistrationAttendanceRow[]>(Prisma.sql`
    SELECT
      r.id AS registration_id,
      athlete.name AS athlete_name,
      athlete.email AS athlete_email,
      d.label AS distance_label,
      r.status::text AS registration_status,
      p.status::text AS payment_status,
      COALESCE(p.amount_cents, d.price_cents) AS amount_cents,
      r.registered_at,
      r.attendance_status::text AS attendance_status,
      r.attendance_checked_at,
      checker.name AS attendance_checked_by,
      r.check_in_at,
      r.check_in_distance_m,
      r.check_out_at,
      r.check_out_distance_m
    FROM public.registrations r
    INNER JOIN public.users athlete ON athlete.id = r.user_id
    INNER JOIN public.event_distances d ON d.id = r.distance_id
    LEFT JOIN public.payments p ON p.registration_id = r.id
    LEFT JOIN public.users checker ON checker.id = r.attendance_checked_by
    WHERE r.event_id = ${eventId}
      AND r.organization_id = ${organizationId}
    ORDER BY r.registered_at DESC
  `);
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role) && !isAdminRole(auth.role)) {
    return apiError("FORBIDDEN", "Acesso restrito ao Gestor ou Financeiro.", 403);
  }

  const event = await prisma.event.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
    },
    select: { id: true },
  });

  if (!event) {
    return apiError("USER_NOT_FOUND", "Prova nao encontrada.", 404);
  }

  const registrations = await getEventRegistrationRows(params.id, auth.organizationId);
  return NextResponse.json({ data: registrations.map(mapRegistration) });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role) && !isAdminRole(auth.role)) {
    return apiError("FORBIDDEN", "Acesso restrito ao Gestor ou Financeiro.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const source = body as Record<string, unknown> | null;
  const registrationId =
    typeof source?.registrationId === "string" ? source.registrationId.trim() : "";
  const action = source?.action;

  if (
    !registrationId ||
    (action !== "MARK_PRESENT" && action !== "MARK_ABSENT" && action !== "RESET")
  ) {
    return apiError("VALIDATION_ERROR", "Dados invalidos para validar presenca.", 400);
  }

  const existing = await prisma.$queryRaw<
    Array<{ id: string; user_id: string; event_id: string }>
  >(Prisma.sql`
    SELECT id, user_id, event_id
    FROM public.registrations
    WHERE id = ${registrationId}
      AND event_id = ${params.id}
      AND organization_id = ${auth.organizationId}
    LIMIT 1
  `);

  if (!existing[0]) {
    return apiError("USER_NOT_FOUND", "Inscricao nao encontrada para esta prova.", 404);
  }

  const attendanceStatus =
    action === "MARK_PRESENT"
      ? Prisma.sql`'PRESENT'::"public"."AttendanceStatus"`
      : action === "MARK_ABSENT"
        ? Prisma.sql`'ABSENT'::"public"."AttendanceStatus"`
        : Prisma.sql`'PENDING'::"public"."AttendanceStatus"`;

  const checkedAt = action === "RESET" ? Prisma.sql`NULL` : Prisma.sql`NOW()`;
  const checkedBy = action === "RESET" ? Prisma.sql`NULL` : Prisma.sql`${auth.userId}`;
  const resetCheckInFields =
    action === "RESET"
      ? Prisma.sql`,
      check_in_at = NULL,
      check_in_latitude = NULL,
      check_in_longitude = NULL,
      check_in_distance_m = NULL,
      check_out_at = NULL,
      check_out_latitude = NULL,
      check_out_longitude = NULL,
      check_out_distance_m = NULL`
      : Prisma.empty;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        UPDATE public.registrations
        SET
          attendance_status = ${attendanceStatus},
          attendance_checked_at = ${checkedAt},
          attendance_checked_by = ${checkedBy}
          ${resetCheckInFields}
        WHERE id = ${registrationId}
          AND event_id = ${params.id}
          AND organization_id = ${auth.organizationId}
      `);

      if (action !== "MARK_PRESENT") {
        await reverseEventPointsForRegistrationInTransaction(tx, {
          orgId: auth.organizationId,
          userId: existing[0].user_id,
          eventId: existing[0].event_id,
          registrationId,
          createdBy: auth.userId,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "points_balance_cannot_be_negative") {
      return apiError(
        "VALIDATION_ERROR",
        "Nao foi possivel alterar a presenca porque o atleta nao possui saldo suficiente para estornar os pontos desta prova.",
        409,
      );
    }

    return apiError("INTERNAL_ERROR", "Nao foi possivel atualizar presenca.", 500);
  }

  const rows = await getEventRegistrationRows(params.id, auth.organizationId);
  const updated = rows.find((row) => row.registration_id === registrationId);

  if (!updated) {
    return apiError("INTERNAL_ERROR", "Nao foi possivel retornar a inscricao atualizada.", 500);
  }

  return NextResponse.json({ data: mapRegistration(updated) });
}
