import assert from "node:assert/strict";
import test from "node:test";
import { BASE_URL, readJson } from "./helpers/auth-test-helpers.mjs";

const webhookSecret =
  process.env.TEST_PAYMENT_WEBHOOK_SECRET ?? process.env.PAYMENT_WEBHOOK_SECRET ?? null;

const validPayload = {
  payment: {
    id: "test-payment-id",
    status: "PAID",
    externalReference: "test-external-reference",
  },
};

test("payment webhook blocks unauthenticated requests when secret is configured", async () => {
  if (!webhookSecret) return;

  const response = await fetch(`${BASE_URL}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-payments-webhook-auth-missing-001",
    },
    body: JSON.stringify(validPayload),
  });

  const payload = await readJson(response);
  assert.equal(response.status, 401, JSON.stringify(payload));
  assert.equal(payload?.error?.code, "FORBIDDEN");
});

test("payment webhook accepts authorized requests", async () => {
  if (!webhookSecret) return;

  const response = await fetch(`${BASE_URL}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${webhookSecret}`,
      "x-request-id": "test-payments-webhook-auth-valid-001",
    },
    body: JSON.stringify(validPayload),
  });

  const payload = await readJson(response);
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload?.ok, true);
});

test("payment webhook fails closed when secret is not configured", async () => {
  if (webhookSecret) return;

  const response = await fetch(`${BASE_URL}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-payments-webhook-auth-unconfigured-001",
    },
    body: JSON.stringify(validPayload),
  });

  const payload = await readJson(response);
  assert.equal(response.status, 503, JSON.stringify(payload));
  assert.equal(payload?.error?.code, "INTERNAL_ERROR");
});
