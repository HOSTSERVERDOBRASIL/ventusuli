import crypto from "crypto";
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

function readWebhookSecret(): string | null {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hasValidSharedSecret(req: NextRequest, secret: string): boolean {
  const headerSecret =
    req.headers.get("x-webhook-secret")?.trim() ??
    req.headers.get("x-payment-webhook-secret")?.trim() ??
    null;

  if (headerSecret && safeCompare(headerSecret, secret)) {
    return true;
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const bearer = authorization.slice("Bearer ".length).trim();
  return bearer.length > 0 && safeCompare(bearer, secret);
}

function hasValidHmacSignature(req: NextRequest, rawBody: string, secret: string): boolean {
  const signatureHeader =
    req.headers.get("x-webhook-signature")?.trim() ??
    req.headers.get("x-signature")?.trim() ??
    null;
  const timestampHeader = req.headers.get("x-webhook-timestamp")?.trim() ?? null;

  if (!signatureHeader || !timestampHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;

  const ageMs = Math.abs(Date.now() - timestamp * 1000);
  if (ageMs > 5 * 60 * 1000) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex");
  const received = signatureHeader.replace(/^sha256=/i, "");

  return safeCompare(received, expected);
}

function isAuthorizedWebhookRequest(req: NextRequest, rawBody: string, secret: string): boolean {
  return hasValidSharedSecret(req, secret) || hasValidHmacSignature(req, rawBody, secret);
}

export async function POST(req: NextRequest) {
  const webhookSecret = readWebhookSecret();
  if (!webhookSecret) {
    return apiError(
      "INTERNAL_ERROR",
      "Webhook de pagamento indisponivel. Configure PAYMENT_WEBHOOK_SECRET.",
      503,
    );
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  if (!isAuthorizedWebhookRequest(req, rawBody, webhookSecret)) {
    return apiError("FORBIDDEN", "Webhook de pagamento nao autorizado.", 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
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
