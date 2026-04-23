import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  approveRedemptionAfterPayment,
  RedemptionServiceError,
} from "@/lib/points/redemptionService";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface RouteParams {
  params: { id: string };
}

const bodySchema = z.object({
  action: z.enum(["MARK_PAID"]),
});

function buildPixCode(txId: string, amountCents: number): string {
  const amount = (amountCents / 100).toFixed(2).replace(".", "");
  return `00020126580014BR.GOV.BCB.PIX0136ventu-suli-${txId.toLowerCase()}52040000530398654${amount}5802BR5925VENTU SULI ASSESSORIA6009SAO PAULO62070503***6304ABCD`;
}

function parseGatewayPaymentId(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/gateway_payment_id:([^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

function resolvePaymentRef(redemption: {
  id: string;
  notes: string | null;
  paymentId: string | null;
}): string {
  if (redemption.paymentId?.trim()) return redemption.paymentId.trim();
  const fromNotes = parseGatewayPaymentId(redemption.notes);
  if (fromNotes) return fromNotes;
  return `RW-PAY-${redemption.id.slice(-12).toUpperCase()}`;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const redemption = await prisma.rewardRedemption.findFirst({
    where: {
      id: params.id,
      organizationId: auth.organizationId,
      userId: auth.userId,
    },
    select: {
      id: true,
      status: true,
      cashPaidCents: true,
      requestedAt: true,
      notes: true,
      paymentId: true,
      rewardItem: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!redemption) {
    return apiError("USER_NOT_FOUND", "Resgate nao encontrado.", 404);
  }

  const paymentRef = resolvePaymentRef(redemption);
  const expiresAt = new Date(redemption.requestedAt.getTime() + 30 * 60 * 1000);
  const pixCode = buildPixCode(paymentRef, redemption.cashPaidCents);

  return NextResponse.json({
    data: {
      redemptionId: redemption.id,
      rewardItemName: redemption.rewardItem.name,
      status: redemption.status,
      amountCents: redemption.cashPaidCents,
      paymentId: paymentRef,
      expiresAt: expiresAt.toISOString(),
      pixCode,
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const redemption = await prisma.rewardRedemption.findFirst({
    where: {
      id: params.id,
      organizationId: auth.organizationId,
      userId: auth.userId,
    },
    select: {
      id: true,
      status: true,
      cashPaidCents: true,
      notes: true,
      paymentId: true,
    },
  });

  if (!redemption) {
    return apiError("USER_NOT_FOUND", "Resgate nao encontrado.", 404);
  }

  if (redemption.status !== "PENDING_PAYMENT") {
    return apiError("VALIDATION_ERROR", "Este resgate nao possui pagamento pendente.", 409);
  }

  if (redemption.cashPaidCents <= 0) {
    return apiError("VALIDATION_ERROR", "Nao ha valor pendente para este resgate.", 409);
  }

  const paymentRef = resolvePaymentRef(redemption);

  try {
    const updated = await approveRedemptionAfterPayment(redemption.id, paymentRef);
    return NextResponse.json({
      data: {
        id: updated.id,
        status: updated.status,
        paymentId: updated.paymentId,
      },
    });
  } catch (error) {
    if (error instanceof RedemptionServiceError) {
      return apiError("VALIDATION_ERROR", error.message, error.statusCode || 409);
    }
    return apiError("INTERNAL_ERROR", "Nao foi possivel confirmar o pagamento do resgate.", 500);
  }
}
