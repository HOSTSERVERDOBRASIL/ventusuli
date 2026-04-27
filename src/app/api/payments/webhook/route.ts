import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { approveRedemptionAfterPayment, RedemptionServiceError } from "@/lib/points/redemptionService";

const webhookSchema = z.object({
  payment: z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    externalReference: z.string().optional(),
  }),
});

function isPaidStatus(status: string): boolean {
  const normalized = status.toUpperCase();
  return normalized === "PAID" || normalized === "CONFIRMED" || normalized === "COMPLETED";
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return apiError("INTERNAL_ERROR", "Webhook de pagamento nao configurado.", 503);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const providedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (providedSecret !== webhookSecret) {
    return apiError("FORBIDDEN", "Webhook de pagamento nao autorizado.", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Payload invalido.", 400);
  }

  const { payment } = parsed.data;

  if (!payment.externalReference || !isPaidStatus(payment.status)) {
    return NextResponse.json({ ok: true, processed: false });
  }

  try {
    await approveRedemptionAfterPayment(payment.externalReference, payment.id);
    return NextResponse.json({ ok: true, processed: true });
  } catch (error) {
    if (error instanceof RedemptionServiceError) {
      return NextResponse.json({ ok: true, processed: false, reason: error.message });
    }

    return apiError("INTERNAL_ERROR", "Falha ao processar webhook de pagamento.", 500);
  }
}
