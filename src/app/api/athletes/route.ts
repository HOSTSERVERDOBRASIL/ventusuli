import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

type AthleteStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
type FinancialSituation = "EM_DIA" | "PENDENTE" | "SEM_HISTORICO";

const querySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["ALL", "PENDING_APPROVAL", "ACTIVE", "REJECTED", "BLOCKED"]).default("ALL"),
  financial: z.enum(["ALL", "EM_DIA", "PENDENTE", "SEM_HISTORICO"]).default("ALL"),
  sortBy: z
    .enum(["createdAt", "name", "registrations", "nextEvent", "pending", "paid", "lastPayment"])
    .default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function canManageAthletes(role: UserRole): boolean {
  const value = String(role);
  return value === "ADMIN" || value === "MANAGER" || value === "COACH" || value === "SUPPORT";
}

function getInternalNote(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const note = (value as Record<string, unknown>).internal_note;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}

function financialFromData(paymentsCount: number, pendingAmount: number): FinancialSituation {
  if (paymentsCount === 0) return "SEM_HISTORICO";
  if (pendingAmount > 0) return "PENDENTE";
  return "EM_DIA";
}

function resolveAthleteStatus(profileStatus: unknown, accountStatus: string): AthleteStatus {
  if (
    profileStatus === "PENDING_APPROVAL" ||
    profileStatus === "ACTIVE" ||
    profileStatus === "REJECTED" ||
    profileStatus === "BLOCKED"
  ) {
    return profileStatus;
  }

  if (accountStatus === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (accountStatus === "SUSPENDED") return "BLOCKED";
  return "ACTIVE";
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role))
    return apiError("FORBIDDEN", "Acesso restrito ao time administrativo.", 403);

  const parsed = querySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    financial: req.nextUrl.searchParams.get("financial") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
    sortDir: req.nextUrl.searchParams.get("sortDir") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const { q, status, financial, sortBy, sortDir, page, pageSize } = parsed.data;
  const now = new Date();

  const users = await prisma.user.findMany({
    where: {
      organization_id: auth.organizationId,
      role: UserRole.ATHLETE,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      athlete_profile: {
        select: {
          athlete_status: true,
          city: true,
          state: true,
          phone: true,
          cpf: true,
          emergency_contact: true,
        },
      },
      registrations: {
        where: { organization_id: auth.organizationId },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              event_date: true,
            },
          },
          payment: {
            select: {
              status: true,
              amount_cents: true,
              paid_at: true,
              created_at: true,
            },
          },
        },
      },
      financial_entries_subject: {
        where: {
          organization_id: auth.organizationId,
          entry_kind: "RECEIVABLE",
        },
        select: {
          status: true,
          amount_cents: true,
          settled_at: true,
          created_at: true,
        },
      },
    },
  });

  const rows = users.map((user) => {
    const payments = user.registrations.flatMap((registration) =>
      registration.payment ? [registration.payment] : [],
    );
    const recurringEntries = user.financial_entries_subject;

    const pendingAmountCents =
      payments
        .filter((payment) => payment.status === "PENDING")
        .reduce((sum, payment) => sum + payment.amount_cents, 0) +
      recurringEntries
        .filter((entry) => entry.status === "OPEN")
        .reduce((sum, entry) => sum + entry.amount_cents, 0);

    const paidAmountCents =
      payments
        .filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + payment.amount_cents, 0) +
      recurringEntries
        .filter((entry) => entry.status === "PAID")
        .reduce((sum, entry) => sum + entry.amount_cents, 0);

    const nextRegistration =
      user.registrations
        .filter((registration) => new Date(registration.event.event_date) >= now)
        .sort(
          (a, b) => new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime(),
        )[0] ?? null;

    const lastPayment =
      [
        ...payments
          .filter((payment) => payment.status === "PAID")
          .map((payment) => ({
            paidAt: payment.paid_at,
            createdAt: payment.created_at,
          })),
        ...recurringEntries
          .filter((entry) => entry.status === "PAID")
          .map((entry) => ({
            paidAt: entry.settled_at,
            createdAt: entry.created_at,
          })),
      ].sort((a, b) => {
        const aDate = a.paidAt ? new Date(a.paidAt) : new Date(a.createdAt);
        const bDate = b.paidAt ? new Date(b.paidAt) : new Date(b.createdAt);
        return bDate.getTime() - aDate.getTime();
      })[0] ?? null;

    const athleteStatus = resolveAthleteStatus(
      user.athlete_profile?.athlete_status,
      user.account_status,
    );
    const financialSituation = financialFromData(
      payments.length + recurringEntries.length,
      pendingAmountCents,
    );

    return {
      id: user.id,
      createdAt: user.created_at.toISOString(),
      name: user.name,
      email: user.email,
      status: athleteStatus,
      approvalPending: athleteStatus === "PENDING_APPROVAL",
      registrationsCount: user.registrations.length,
      nextEventName: nextRegistration?.event.name ?? null,
      nextEventDate: nextRegistration
        ? new Date(nextRegistration.event.event_date).toISOString()
        : null,
      pendingAmountCents,
      paidAmountCents,
      financialSituation,
      lastPaymentAt: lastPayment?.paidAt ? new Date(lastPayment.paidAt).toISOString() : null,
      city: user.athlete_profile?.city ?? null,
      state: user.athlete_profile?.state ?? null,
      internalNote: getInternalNote(user.athlete_profile?.emergency_contact),
    };
  });

  const filteredRows = rows.filter((row) => {
    const statusMatch = status === "ALL" ? true : row.status === status;
    const financialMatch = financial === "ALL" ? true : row.financialSituation === financial;
    return statusMatch && financialMatch;
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;

    if (sortBy === "registrations") return (a.registrationsCount - b.registrationsCount) * dir;
    if (sortBy === "pending") return (a.pendingAmountCents - b.pendingAmountCents) * dir;
    if (sortBy === "paid") return (a.paidAmountCents - b.paidAmountCents) * dir;
    if (sortBy === "nextEvent") {
      const aDate = a.nextEventDate
        ? new Date(a.nextEventDate).getTime()
        : Number.POSITIVE_INFINITY;
      const bDate = b.nextEventDate
        ? new Date(b.nextEventDate).getTime()
        : Number.POSITIVE_INFINITY;
      return (aDate - bDate) * dir;
    }
    if (sortBy === "lastPayment") {
      const aDate = a.lastPaymentAt ? new Date(a.lastPaymentAt).getTime() : 0;
      const bDate = b.lastPaymentAt ? new Date(b.lastPaymentAt).getTime() : 0;
      return (aDate - bDate) * dir;
    }
    if (sortBy === "createdAt") {
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }

    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * dir;
  });

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const data = sortedRows.slice(start, start + pageSize);

  const summary = {
    totalAthletes: rows.length,
    active: rows.filter((row) => row.status === "ACTIVE").length,
    pendingApproval: rows.filter((row) => row.status === "PENDING_APPROVAL").length,
    rejected: rows.filter((row) => row.status === "REJECTED").length,
    blocked: rows.filter((row) => row.status === "BLOCKED").length,
    totalPendingCents: rows.reduce((sum, row) => sum + row.pendingAmountCents, 0),
    totalPaidCents: rows.reduce((sum, row) => sum + row.paidAmountCents, 0),
  };

  return NextResponse.json({
    data,
    summary,
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  });
}
