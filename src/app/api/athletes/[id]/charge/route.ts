import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, RegistrationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const chargeSchema = z.object({
  registrationId: z.string().uuid(),
});

function canManageAthletes(role: UserRole): boolean {
  const value = String(role);
  return value === "ADMIN" || value === "MANAGER";
}

interface RouteParams {
  params: { id: string };
}

function buildTxId(registrationId: string): string {
  return `VS-${registrationId.replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = chargeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const registration = await prisma.registration.findFirst({
    where: {
      id: parsed.data.registrationId,
      user_id: params.id,
      organization_id: auth.organizationId,
    },
    include: {
      distance: {
        select: { price_cents: true },
      },
      payment: true,
    },
  });

  if (!registration)
    return apiError("USER_NOT_FOUND", "Inscrição não encontrada para este atleta.", 404);

  if (registration.payment?.status === PaymentStatus.PAID) {
    return apiError("FORBIDDEN", "Inscrição já está com pagamento confirmado.", 403);
  }

  const payment = await prisma.$transaction(async (tx) => {
    await tx.registration.update({
      where: { id: registration.id },
      data: { status: RegistrationStatus.PENDING_PAYMENT },
    });

    if (registration.payment) {
      return tx.payment.update({
        where: { id: registration.payment.id },
        data: {
          status: PaymentStatus.PENDING,
          paid_at: null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return tx.payment.create({
      data: {
        registration_id: registration.id,
        user_id: params.id,
        organization_id: auth.organizationId,
        amount_cents: registration.distance.price_cents,
        fee_cents: 0,
        net_cents: registration.distance.price_cents,
        status: PaymentStatus.PENDING,
        efi_tx_id: buildTxId(registration.id),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  return NextResponse.json({
    data: {
      paymentId: payment.id,
      status: payment.status,
      amountCents: payment.amount_cents,
    },
  });
}
