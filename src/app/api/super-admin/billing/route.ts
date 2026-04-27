import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isSuperAdminRole } from "@/lib/request-auth";

const querySchema = z.object({
  status: z.enum(["ALL", "OPEN", "PAID", "OVERDUE", "CANCELLED"]).default("ALL"),
});

const createSchema = z.object({
  organizationId: z.string().min(1),
  amountCents: z.number().int().positive(),
  dueAt: z.string().datetime(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  description: z.string().trim().max(500).optional(),
  paymentMethod: z.string().trim().max(80).optional(),
  documentUrl: z.string().trim().url().optional(),
});

function mapInvoice(invoice: {
  id: string;
  type: string;
  status: string;
  amount_cents: number;
  due_at: Date;
  paid_at: Date | null;
  period_start: Date;
  period_end: Date;
  description: string | null;
  payment_method: string | null;
  document_url: string | null;
  created_at: Date;
  organization: { id: string; name: string; slug: string; plan: string; status: string };
}) {
  const now = Date.now();
  const effectiveStatus =
    invoice.status === "OPEN" && invoice.due_at.getTime() < now ? "OVERDUE" : invoice.status;

  return {
    id: invoice.id,
    type: invoice.type,
    status: effectiveStatus,
    amountCents: invoice.amount_cents,
    dueAt: invoice.due_at.toISOString(),
    paidAt: invoice.paid_at?.toISOString() ?? null,
    periodStart: invoice.period_start.toISOString(),
    periodEnd: invoice.period_end.toISOString(),
    description: invoice.description,
    paymentMethod: invoice.payment_method,
    documentUrl: invoice.document_url,
    createdAt: invoice.created_at.toISOString(),
    organization: invoice.organization,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

  const parsed = querySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? "ALL",
  });
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const invoices = await prisma.platformBillingInvoice.findMany({
    where: parsed.data.status === "ALL" || parsed.data.status === "OVERDUE" ? {} : { status: parsed.data.status },
    orderBy: [{ due_at: "desc" }, { created_at: "desc" }],
    include: {
      organization: { select: { id: true, name: true, slug: true, plan: true, status: true } },
    },
  });

  const mapped = invoices.map(mapInvoice).filter((invoice) => {
    if (parsed.data.status !== "OVERDUE") return true;
    return invoice.status === "OVERDUE";
  });

  const summary = mapped.reduce(
    (acc, invoice) => {
      if (invoice.status === "PAID") acc.paidCents += invoice.amountCents;
      if (invoice.status === "OPEN") acc.openCents += invoice.amountCents;
      if (invoice.status === "OVERDUE") acc.overdueCents += invoice.amountCents;
      return acc;
    },
    { paidCents: 0, openCents: 0, overdueCents: 0 },
  );

  return NextResponse.json({ data: mapped, summary });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

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

  const organization = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { id: true },
  });
  if (!organization) return apiError("ORG_NOT_FOUND", "Organizacao nao encontrada.", 404);

  const invoice = await prisma.platformBillingInvoice.create({
    data: {
      organization_id: parsed.data.organizationId,
      amount_cents: parsed.data.amountCents,
      due_at: new Date(parsed.data.dueAt),
      period_start: new Date(parsed.data.periodStart),
      period_end: new Date(parsed.data.periodEnd),
      description: parsed.data.description ?? null,
      payment_method: parsed.data.paymentMethod ?? null,
      document_url: parsed.data.documentUrl ?? null,
      created_by: auth.userId,
    },
    include: {
      organization: { select: { id: true, name: true, slug: true, plan: true, status: true } },
    },
  });

  return NextResponse.json({ data: mapInvoice(invoice) }, { status: 201 });
}
