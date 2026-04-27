import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isFinanceRole } from "@/lib/request-auth";

const dueFilterValues = ["ALL", "OVERDUE", "TODAY", "NEXT_7_DAYS", "NO_DUE_DATE"] as const;
const sortByValues = ["createdAt", "expiresAt", "amount"] as const;
const sortDirValues = ["asc", "desc"] as const;

const querySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.nativeEnum(PaymentStatus).optional(),
  athlete: z.string().trim().optional(),
  event: z.string().trim().optional(),
  due: z.enum(dueFilterValues).default("ALL"),
  sortBy: z.enum(sortByValues).default("createdAt"),
  sortDir: z.enum(sortDirValues).default("desc"),
});

function buildPixCode(txId: string, amountCents: number): string {
  const amount = (amountCents / 100).toFixed(2).replace(".", "");
  return `00020126580014BR.GOV.BCB.PIX0136ventu-suli-${txId.toLowerCase()}52040000530398654${amount}5802BR5925VENTU SULI ASSESSORIA6009SAO PAULO62070503***6304ABCD`;
}

function dayBounds(reference: Date): { start: Date; end: Date } {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(reference);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getDueState(status: PaymentStatus, expiresAt: Date | null, now: Date) {
  if (status !== PaymentStatus.PENDING) return "CLOSED" as const;
  if (!expiresAt) return "NO_DUE_DATE" as const;

  const { start, end } = dayBounds(now);
  if (expiresAt.getTime() < now.getTime()) return "OVERDUE" as const;
  if (expiresAt.getTime() >= start.getTime() && expiresAt.getTime() <= end.getTime()) return "DUE_TODAY" as const;

  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);
  if (expiresAt.getTime() <= weekAhead.getTime()) return "DUE_SOON" as const;

  return "DUE_SOON" as const;
}

function getDaysUntilDue(expiresAt: Date | null, now: Date): number | null {
  if (!expiresAt) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);
}

function getReconciliation(status: PaymentStatus) {
  if (status === PaymentStatus.PAID) {
    return { reconciliationStatus: "SETTLED" as const, reconciliationNote: "Liquidacao confirmada e conciliada." };
  }
  if (status === PaymentStatus.PENDING) {
    return { reconciliationStatus: "OPEN" as const, reconciliationNote: "Aguardando pagamento para conciliacao." };
  }
  return { reconciliationStatus: "CLOSED" as const, reconciliationNote: "Cobranca encerrada sem liquidacao." };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Financeiro.", 403);

  const parsed = querySchema.safeParse({
    startDate: req.nextUrl.searchParams.get("startDate") ?? undefined,
    endDate: req.nextUrl.searchParams.get("endDate") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    athlete: req.nextUrl.searchParams.get("athlete") ?? undefined,
    event: req.nextUrl.searchParams.get("event") ?? undefined,
    due: req.nextUrl.searchParams.get("due") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
    sortDir: req.nextUrl.searchParams.get("sortDir") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const now = new Date();
  const { startDate, endDate, athlete, event, status, due, sortBy, sortDir } = parsed.data;

  const basePayments = await prisma.payment.findMany({
    where: {
      organization_id: auth.organizationId,
      created_at: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      ...(athlete
        ? {
            user: {
              name: { contains: athlete, mode: "insensitive" },
            },
          }
        : {}),
      ...(event
        ? {
            registration: {
              event: {
                name: { contains: event, mode: "insensitive" },
              },
            },
          }
        : {}),
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      registration: {
        select: {
          id: true,
          status: true,
          event: {
            select: {
              name: true,
            },
          },
          distance: {
            select: {
              label: true,
            },
          },
        },
      },
    },
  });

  const queueSource = basePayments.filter((payment) => payment.status === PaymentStatus.PENDING);
  const overdue = queueSource.filter((payment) => payment.expires_at && payment.expires_at.getTime() < now.getTime());
  const dueToday = queueSource.filter((payment) => {
    if (!payment.expires_at) return false;
    const { start, end } = dayBounds(now);
    return payment.expires_at.getTime() >= start.getTime() && payment.expires_at.getTime() <= end.getTime();
  });
  const dueSoon = queueSource.filter((payment) => {
    if (!payment.expires_at) return false;
    const future = new Date(now);
    future.setDate(future.getDate() + 7);
    return payment.expires_at.getTime() > now.getTime() && payment.expires_at.getTime() <= future.getTime();
  });
  const noDueDate = queueSource.filter((payment) => !payment.expires_at);
  const settledLast24h = basePayments.filter(
    (payment) =>
      payment.status === PaymentStatus.PAID &&
      payment.paid_at &&
      now.getTime() - payment.paid_at.getTime() <= 24 * 60 * 60 * 1000,
  );

  const rows = basePayments
    .map((payment) => {
      const txId =
        payment.efi_tx_id ?? `VS-TX-${payment.id.replace(/-/g, "").slice(0, 20).toUpperCase()}`;
      const dueState = getDueState(payment.status, payment.expires_at, now);
      const dueDays = getDaysUntilDue(payment.expires_at, now);
      const reconciliation = getReconciliation(payment.status);

      return {
        id: payment.id,
        registrationId: payment.registration.id,
        amountCents: payment.amount_cents,
        status: payment.status,
        txId,
        qrCodeUrl: payment.qr_code_url ?? undefined,
        pixCopyPaste: payment.pix_key ?? buildPixCode(txId, payment.amount_cents),
        expiresAt: payment.expires_at?.toISOString() ?? undefined,
        paidAt: payment.paid_at?.toISOString() ?? undefined,
        athleteName: payment.user.name,
        athleteEmail: payment.user.email,
        eventName: payment.registration.event.name,
        distanceLabel: payment.registration.distance.label,
        createdAt: payment.created_at.toISOString(),
        registrationStatus: payment.registration.status,
        dueState,
        reconciliationStatus: reconciliation.reconciliationStatus,
        reconciliationNote: reconciliation.reconciliationNote,
        daysUntilDue: dueDays,
        updatedAt: (payment.paid_at ?? payment.created_at).toISOString(),
      };
    })
    .filter((row) => {
      if (status && row.status !== status) return false;
      if (due === "ALL") return true;
      if (due === "OVERDUE") return row.status === "PENDING" && row.dueState === "OVERDUE";
      if (due === "TODAY") return row.dueState === "DUE_TODAY";
      if (due === "NEXT_7_DAYS") {
        return (
          row.status === "PENDING" &&
          row.daysUntilDue !== null &&
          row.daysUntilDue >= 1 &&
          row.daysUntilDue <= 7
        );
      }
      if (due === "NO_DUE_DATE") return row.dueState === "NO_DUE_DATE";
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "amount") return (a.amountCents - b.amountCents) * dir;
      if (sortBy === "expiresAt") {
        const aTs = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        const bTs = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        return (aTs - bTs) * dir;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });

  const summary = {
    totalCobrado: rows.reduce((sum, row) => sum + row.amountCents, 0),
    totalPago: rows.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.amountCents, 0),
    totalPendente: rows.filter((row) => row.status === "PENDING").reduce((sum, row) => sum + row.amountCents, 0),
    totalExpirado: rows.filter((row) => row.status === "EXPIRED").reduce((sum, row) => sum + row.amountCents, 0),
    totalCancelado: rows.filter((row) => row.status === "CANCELLED").reduce((sum, row) => sum + row.amountCents, 0),
  };

  const queue = {
    totalOpenCount: queueSource.length,
    totalOpenAmount: queueSource.reduce((sum, payment) => sum + payment.amount_cents, 0),
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((sum, payment) => sum + payment.amount_cents, 0),
    dueTodayCount: dueToday.length,
    dueSoonCount: dueSoon.length,
    noDueDateCount: noDueDate.length,
    recentSettlementsCount: settledLast24h.length,
  };

  const filters = {
    athletes: Array.from(new Set(basePayments.map((payment) => payment.user.name))).sort((a, b) =>
      a.localeCompare(b),
    ),
    events: Array.from(new Set(basePayments.map((payment) => payment.registration.event.name))).sort((a, b) =>
      a.localeCompare(b),
    ),
  };

  return NextResponse.json({ data: rows, rows, summary, queue, filters });
}
