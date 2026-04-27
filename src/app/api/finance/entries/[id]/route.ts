import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isFinanceRole } from "@/lib/request-auth";

const patchSchema = z.object({
  action: z.enum(["MARK_PAID", "REOPEN", "CANCEL"]),
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Financeiro.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const current = await prisma.financialEntry.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
    },
    select: { id: true },
  });

  if (!current) return apiError("USER_NOT_FOUND", "Lancamento financeiro nao encontrado.", 404);

  const data =
    parsed.data.action === "MARK_PAID"
      ? { status: "PAID", settled_at: new Date() }
      : parsed.data.action === "CANCEL"
        ? { status: "CANCELLED", settled_at: null }
        : { status: "OPEN", settled_at: null };

  const updated = await prisma.financialEntry.update({
    where: { id: current.id },
    data,
    include: { creator: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ data: mapEntry(updated) });
}
