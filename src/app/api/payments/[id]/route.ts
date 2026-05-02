import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, Prisma, RegistrationStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { notifyRegistrationConfirmed } from "@/lib/notifications/domain-events";
import { approveRedemptionAfterPayment, RedemptionServiceError } from "@/lib/points/redemptionService";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isFinanceRole } from "@/lib/request-auth";

const patchPaymentSchema = z.object({
  action: z.enum(["MARK_PAID", "CANCEL", "MARK_EXPIRED", "REOPEN_PENDING"]),
});

interface RouteParams {
  params: { id: string };
}

interface HistoryEvent {
  id: string;
  type: "CREATED" | "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "REOPENED";
  label: string;
  detail: string;
  occurredAt: string;
  actor: string | null;
}

function buildTxId(paymentId: string): string {
  return `VS-TX-${paymentId.replace(/-/g, "").slice(0, 20).toUpperCase()}`;
}

function buildPixCode(txId: string, amountCents: number): string {
  const amount = (amountCents / 100).toFixed(2).replace(".", "");
  return `00020126580014BR.GOV.BCB.PIX0136ventu-suli-${txId.toLowerCase()}52040000530398654${amount}5802BR5925VENTU SULI ASSESSORIA6009SAO PAULO62070503***6304ABCD`;
}

function parseHistory(payload: Prisma.JsonValue | null): HistoryEvent[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const history = (payload as Record<string, unknown>).history;
  if (!Array.isArray(history)) return [];
  return history
    .filter((item): item is HistoryEvent => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.id === "string" &&
        typeof record.type === "string" &&
        typeof record.label === "string" &&
        typeof record.detail === "string" &&
        typeof record.occurredAt === "string"
      );
    })
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

function mergeHistory(existingPayload: Prisma.JsonValue | null, event: HistoryEvent): Prisma.JsonObject {
  const existingHistory = parseHistory(existingPayload);
  const latest = [...existingHistory, event].map((item) => ({
    id: item.id,
    type: item.type,
    label: item.label,
    detail: item.detail,
    occurredAt: item.occurredAt,
    actor: item.actor,
  })) as Prisma.JsonArray;
  return { history: latest };
}

function parseExternalReference(payload: Prisma.JsonValue | null): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.externalReference === "string" && record.externalReference.length > 0) {
    return record.externalReference;
  }

  const payment = record.payment;
  if (payment && typeof payment === "object" && !Array.isArray(payment)) {
    const paymentRecord = payment as Record<string, unknown>;
    if (typeof paymentRecord.externalReference === "string" && paymentRecord.externalReference.length > 0) {
      return paymentRecord.externalReference;
    }
  }

  return null;
}

function toDetail(payment: {
  id: string;
  registration_id: string;
  amount_cents: number;
  status: PaymentStatus;
  efi_tx_id: string | null;
  qr_code_url: string | null;
  pix_key: string | null;
  expires_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
  webhook_payload: Prisma.JsonValue | null;
  registration: { status: RegistrationStatus; event: { name: string }; distance: { label: string } };
  user: { name: string; email: string };
}) {
  const txId = payment.efi_tx_id ?? buildTxId(payment.id);
  const now = new Date();
  const dueState =
    payment.status !== PaymentStatus.PENDING
      ? "CLOSED"
      : !payment.expires_at
        ? "NO_DUE_DATE"
        : payment.expires_at.getTime() < now.getTime()
          ? "OVERDUE"
          : "DUE_SOON";

  const reconciliation =
    payment.status === PaymentStatus.PAID
      ? { reconciliationStatus: "SETTLED", reconciliationNote: "Liquidacao confirmada e conciliada." }
      : payment.status === PaymentStatus.PENDING
        ? { reconciliationStatus: "OPEN", reconciliationNote: "Aguardando pagamento para conciliacao." }
        : { reconciliationStatus: "CLOSED", reconciliationNote: "Cobranca encerrada sem liquidacao." };

  const defaultHistory: HistoryEvent[] = [
    {
      id: `${payment.id}-created`,
      type: "CREATED",
      label: "Cobranca criada",
      detail: "Cobranca registrada no sistema.",
      occurredAt: payment.created_at.toISOString(),
      actor: null,
    },
  ];

  const history = [...defaultHistory, ...parseHistory(payment.webhook_payload)]
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  return {
    id: payment.id,
    registrationId: payment.registration_id,
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
    daysUntilDue: payment.expires_at ? Math.ceil((payment.expires_at.getTime() - now.getTime()) / 86400000) : null,
    updatedAt: (payment.paid_at ?? payment.created_at).toISOString(),
    history,
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Financeiro.", 403);

  const payment = await prisma.payment.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
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

  if (!payment) return apiError("USER_NOT_FOUND", "Cobranca nao encontrada.", 404);
  return NextResponse.json({ data: toDetail(payment) });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Financeiro.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = patchPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const current = await prisma.payment.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
    },
    select: {
      id: true,
      status: true,
      registration_id: true,
      webhook_payload: true,
    },
  });

  if (!current) return apiError("USER_NOT_FOUND", "Cobranca nao encontrada.", 404);

  const action = parsed.data.action;
  const canEditPending = current.status === PaymentStatus.PENDING;
  const canReopen = current.status === PaymentStatus.CANCELLED || current.status === PaymentStatus.EXPIRED;

  if ((action === "MARK_PAID" || action === "CANCEL" || action === "MARK_EXPIRED") && !canEditPending) {
    return apiError("FORBIDDEN", "Apenas cobrancas pendentes podem usar esta acao.", 403);
  }
  if (action === "REOPEN_PENDING" && !canReopen) {
    return apiError("FORBIDDEN", "Somente cobrancas canceladas ou expiradas podem ser reabertas.", 403);
  }

  const actionConfig =
    action === "MARK_PAID"
      ? {
          paymentStatus: PaymentStatus.PAID,
          registrationStatus: RegistrationStatus.CONFIRMED,
          paidAt: new Date(),
          expiresAt: undefined as Date | null | undefined,
          history: { type: "PAID" as const, label: "Pagamento confirmado", detail: "Baixa manual realizada no financeiro." },
        }
      : action === "CANCEL"
        ? {
            paymentStatus: PaymentStatus.CANCELLED,
            registrationStatus: RegistrationStatus.CANCELLED,
            paidAt: null,
            expiresAt: undefined as Date | null | undefined,
            history: { type: "CANCELLED" as const, label: "Cobranca cancelada", detail: "Cancelamento manual realizado no financeiro." },
          }
        : action === "MARK_EXPIRED"
          ? {
              paymentStatus: PaymentStatus.EXPIRED,
              registrationStatus: RegistrationStatus.CANCELLED,
              paidAt: null,
              expiresAt: new Date(),
              history: { type: "EXPIRED" as const, label: "Cobranca expirada", detail: "Encerrada por expiracao operacional." },
            }
          : {
              paymentStatus: PaymentStatus.PENDING,
              registrationStatus: RegistrationStatus.PENDING_PAYMENT,
              paidAt: null,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              history: { type: "REOPENED" as const, label: "Cobranca reaberta", detail: "Fluxo de cobranca retomado manualmente." },
            };

  await prisma.$transaction(async (tx) => {
    const nowIso = new Date().toISOString();
    const historyEvent: HistoryEvent = {
      id: `${current.id}-${Date.now()}`,
      type: actionConfig.history.type,
      label: actionConfig.history.label,
      detail: actionConfig.history.detail,
      occurredAt: nowIso,
      actor: auth.userId,
    };

    await tx.payment.update({
      where: { id: current.id },
      data: {
        status: actionConfig.paymentStatus,
        paid_at: actionConfig.paidAt,
        ...(actionConfig.expiresAt !== undefined ? { expires_at: actionConfig.expiresAt } : {}),
        webhook_payload: mergeHistory(current.webhook_payload, historyEvent),
      },
    });

    await tx.registration.update({
      where: { id: current.registration_id },
      data: {
        status: actionConfig.registrationStatus,
      },
    });
  });

  if (action === "MARK_PAID") {
    const externalReference = parseExternalReference(current.webhook_payload);
    if (externalReference) {
      try {
        await approveRedemptionAfterPayment(externalReference, current.id);
      } catch (error) {
        if (!(error instanceof RedemptionServiceError)) {
          throw error;
        }
      }
    }
  }

  const updated = await prisma.payment.findFirst({
    where: {
      id: current.id,
      organization_id: auth.organizationId,
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

  if (!updated) return apiError("USER_NOT_FOUND", "Cobranca nao encontrada.", 404);

  if (action === "MARK_PAID") {
    await notifyRegistrationConfirmed(prisma, {
      organizationId: auth.organizationId,
      userId: updated.user_id,
      registrationId: updated.registration_id,
      eventName: updated.registration.event.name,
    });
  }

  const detail = toDetail(updated);
  return NextResponse.json({
    data: {
      id: detail.id,
      registrationId: detail.registrationId,
      amountCents: detail.amountCents,
      status: detail.status,
      txId: detail.txId,
      qrCodeUrl: detail.qrCodeUrl,
      pixCopyPaste: detail.pixCopyPaste,
      expiresAt: detail.expiresAt,
      paidAt: detail.paidAt,
      athleteName: detail.athleteName,
      athleteEmail: detail.athleteEmail,
      eventName: detail.eventName,
      distanceLabel: detail.distanceLabel,
      createdAt: detail.createdAt,
      registrationStatus: detail.registrationStatus,
      dueState: detail.dueState,
      reconciliationStatus: detail.reconciliationStatus,
      reconciliationNote: detail.reconciliationNote,
      daysUntilDue: detail.daysUntilDue,
      updatedAt: detail.updatedAt,
    },
  });
}
