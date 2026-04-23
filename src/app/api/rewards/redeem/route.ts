import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { createRedemption, RedemptionServiceError } from "@/lib/points/redemptionService";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const bodySchema = z.object({
  rewardItemId: z.string().min(1),
  pointsToUse: z.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8),
});

interface GatewayPaymentResult {
  id: string;
  paymentUrl: string;
}

function buildGatewayPaymentUrl(paymentId: string): string {
  return `/financeiro?payment=${paymentId}`;
}

async function createGatewayPayment(params: {
  orgId: string;
  userId: string;
  redemptionId: string;
  amountCents: number;
}): Promise<GatewayPaymentResult> {
  const paymentId = `rw_pay_${randomUUID()}`;

  await prisma.$executeRaw`
    UPDATE public."RewardRedemption"
    SET notes = ${`gateway_payment_id:${paymentId};external_reference:${params.redemptionId};amount:${params.amountCents}`}
    WHERE id = ${params.redemptionId}
      AND "organizationId" = ${params.orgId}
      AND "userId" = ${params.userId}
  `;

  return {
    id: paymentId,
    paymentUrl: buildGatewayPaymentUrl(paymentId),
  };
}

export async function POST(req: NextRequest) {
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

  try {
    const result = await createRedemption({
      userId: auth.userId,
      orgId: auth.organizationId,
      rewardItemId: parsed.data.rewardItemId,
      requestedPoints: parsed.data.pointsToUse,
      idempotencyKey: parsed.data.idempotencyKey,
      createdBy: auth.userId,
    });

    if (result.paymentRequired) {
      const payment = await createGatewayPayment({
        orgId: auth.organizationId,
        userId: auth.userId,
        redemptionId: result.redemption.id,
        amountCents: result.cashCents,
      });

      return NextResponse.json({
        redemption: result.redemption,
        paymentUrl: payment.paymentUrl,
      });
    }

    return NextResponse.json({ redemption: result.redemption });
  } catch (error) {
    if (error instanceof RedemptionServiceError) {
      const statusCode = Number.isFinite(error.statusCode) ? error.statusCode : 400;
      if (statusCode === 404) {
        return apiError("USER_NOT_FOUND", error.message, 404);
      }
      return apiError("VALIDATION_ERROR", error.message, statusCode);
    }

    return apiError("INTERNAL_ERROR", "Nao foi possivel criar resgate.", 500);
  }
}
