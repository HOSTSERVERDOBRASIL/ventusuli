import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isFinanceRole } from "@/lib/request-auth";

const entrySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amountCents: z.number().int().positive(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  occurredAt: z.string().datetime(),
  dueAt: z.string().datetime().nullable().optional(),
  settledAt: z.string().datetime().nullable().optional(),
  status: z.enum(["OPEN", "PAID", "CANCELLED"]).default("PAID"),
  entryKind: z.enum(["CASH", "RECEIVABLE", "PAYABLE"]).default("CASH"),
  accountCode: z.string().trim().max(40).nullable().optional(),
  costCenter: z.string().trim().max(80).nullable().optional(),
  counterparty: z.string().trim().max(120).nullable().optional(),
  paymentMethod: z.string().trim().max(60).nullable().optional(),
  documentUrl: z.string().trim().url().nullable().optional(),
});

function mapEntry(entry: {
  id: string;
  type: string;
  amount_cents: number;
  category: string;
  description: string | null;
  occurred_at: Date;
  due_at: Date | null;
  settled_at: Date | null;
  status: string;
  entry_kind: string;
  account_code: string | null;
  cost_center: string | null;
  counterparty: string | null;
  payment_method: string | null;
  document_url: string | null;
  created_at: Date;
  creator: { name: string; email: string };
}) {
  return {
    id: entry.id,
    type: entry.type,
    amountCents: entry.amount_cents,
    category: entry.category,
    description: entry.description,
    occurredAt: entry.occurred_at.toISOString(),
    dueAt: entry.due_at?.toISOString() ?? null,
    settledAt: entry.settled_at?.toISOString() ?? null,
    status: entry.status,
    entryKind: entry.entry_kind,
    accountCode: entry.account_code,
    costCenter: entry.cost_center,
    counterparty: entry.counterparty,
    paymentMethod: entry.payment_method,
    documentUrl: entry.document_url,
    createdAt: entry.created_at.toISOString(),
    createdByName: entry.creator.name,
    createdByEmail: entry.creator.email,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Financeiro.", 403);

  const startParam = req.nextUrl.searchParams.get("startDate");
  const endParam = req.nextUrl.searchParams.get("endDate");
  const status = req.nextUrl.searchParams.get("status");
  const type = req.nextUrl.searchParams.get("type");
  const entryKind = req.nextUrl.searchParams.get("entryKind");
  const startDate = startParam ? new Date(startParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = endParam ? new Date(endParam) : new Date();

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return apiError("VALIDATION_ERROR", "Periodo invalido.", 400);
  }

  const entries = await prisma.financialEntry.findMany({
    where: {
      organization_id: auth.organizationId,
      occurred_at: { gte: startDate, lte: endDate },
      ...(status && status !== "ALL" ? { status } : {}),
      ...(type && type !== "ALL" ? { type } : {}),
      ...(entryKind && entryKind !== "ALL" ? { entry_kind: entryKind } : {}),
    },
    orderBy: [{ occurred_at: "desc" }, { created_at: "desc" }],
    include: { creator: { select: { name: true, email: true } } },
  });

  const incomeCents = entries
    .filter((entry) => entry.type === "INCOME" && entry.status === "PAID")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);
  const expenseCents = entries
    .filter((entry) => entry.type === "EXPENSE" && entry.status === "PAID")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);
  const openReceivableCents = entries
    .filter((entry) => entry.type === "INCOME" && entry.status === "OPEN")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);
  const openPayableCents = entries
    .filter((entry) => entry.type === "EXPENSE" && entry.status === "OPEN")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);

  return NextResponse.json({
    data: entries.map(mapEntry),
    summary: {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      openReceivableCents,
      openPayableCents,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Financeiro.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const entry = await prisma.financialEntry.create({
    data: {
      organization_id: auth.organizationId,
      type: parsed.data.type,
      amount_cents: parsed.data.amountCents,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      occurred_at: new Date(parsed.data.occurredAt),
      due_at: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      settled_at: parsed.data.settledAt ? new Date(parsed.data.settledAt) : parsed.data.status === "PAID" ? new Date(parsed.data.occurredAt) : null,
      status: parsed.data.status,
      entry_kind: parsed.data.entryKind,
      account_code: parsed.data.accountCode || null,
      cost_center: parsed.data.costCenter || null,
      counterparty: parsed.data.counterparty || null,
      payment_method: parsed.data.paymentMethod || null,
      document_url: parsed.data.documentUrl || null,
      created_by: auth.userId,
    },
    include: { creator: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ data: mapEntry(entry) }, { status: 201 });
}
