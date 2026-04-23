import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface RouteParams {
  params: { id: string };
}

function buildPixCode(txId: string, amountCents: number): string {
  const amount = (amountCents / 100).toFixed(2).replace(".", "");
  return `00020126580014BR.GOV.BCB.PIX0136ventu-suli-${txId.toLowerCase()}52040000530398654${amount}5802BR5925VENTU SULI ASSESSORIA6009SAO PAULO62070503***6304ABCD`;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const registration = await prisma.registration.findFirst({
    where: {
      id: params.id,
      user_id: auth.userId,
      organization_id: auth.organizationId,
    },
    select: {
      id: true,
      payment: {
        select: {
          id: true,
          status: true,
          expires_at: true,
          paid_at: true,
          amount_cents: true,
          efi_tx_id: true,
          pix_key: true,
        },
      },
    },
  });

  if (!registration) {
    return apiError("USER_NOT_FOUND", "Inscricao nao encontrada.", 404);
  }

  const payment = registration.payment;
  if (!payment) {
    return NextResponse.json({
      data: {
        registrationId: registration.id,
        status: "PENDING",
        expiresAt: null,
        paidAt: null,
        amountCents: null,
        txId: null,
        pixCode: null,
      },
    });
  }

  const txId = payment.efi_tx_id ?? `VS-TX-${payment.id.replace(/-/g, "").slice(0, 20).toUpperCase()}`;
  const pixCode = payment.pix_key ?? buildPixCode(txId, payment.amount_cents);

  return NextResponse.json({
    data: {
      registrationId: registration.id,
      status: payment.status,
      expiresAt: payment.expires_at,
      paidAt: payment.paid_at,
      amountCents: payment.amount_cents,
      txId,
      pixCode,
    },
  });
}
