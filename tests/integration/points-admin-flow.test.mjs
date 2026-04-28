import assert from "node:assert/strict";
import test from "node:test";
import { authedFetch, loginAs, readJson } from "./helpers/auth-test-helpers.mjs";

async function getCurrentUser(cookies) {
  const response = await authedFetch("/api/auth/session", cookies);
  const payload = await readJson(response);
  assert.equal(response.status, 200, JSON.stringify(payload));
  return payload.user;
}

test("points admin flow: report, activity approval, athlete ledger, automations", async () => {
  const adminLogin = await loginAs("ADMIN", "test-points-admin-login", 101);
  assert.equal(adminLogin.response.status, 200, JSON.stringify(adminLogin.payload));

  const athleteLogin = await loginAs("ATHLETE", "test-points-athlete-login", 102);
  assert.equal(athleteLogin.response.status, 200, JSON.stringify(athleteLogin.payload));

  const athleteUser = await getCurrentUser(athleteLogin.cookies);
  const athleteId = athleteUser?.id;
  assert.ok(athleteId, "athlete user id is required");

  const reportResponse = await authedFetch("/api/admin/points/report", adminLogin.cookies);
  const reportPayload = await readJson(reportResponse);
  assert.equal(reportResponse.status, 200, JSON.stringify(reportPayload));
  assert.ok(typeof reportPayload.totalPointsIssued === "number");
  assert.ok(Array.isArray(reportPayload.pointsBySource));

  const now = Date.now();
  const activityResponse = await authedFetch("/api/admin/points/activities", adminLogin.cookies, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Teste atividade ${now}`,
      description: "Criada por teste automatizado",
      suggestedPoints: 17,
      activityDate: new Date(now).toISOString(),
    }),
  });
  const activityPayload = await readJson(activityResponse);
  assert.equal(activityResponse.status, 201, JSON.stringify(activityPayload));
  assert.ok(activityPayload?.data?.id);

  const activityId = activityPayload.data.id;
  const entryResponse = await authedFetch("/api/admin/points/entries", adminLogin.cookies, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activityId,
      userId: athleteId,
      points: 17,
      note: "Lancamento de teste",
    }),
  });
  const entryPayload = await readJson(entryResponse);
  assert.equal(entryResponse.status, 201, JSON.stringify(entryPayload));
  assert.equal(entryPayload?.data?.status, "PENDING");

  const entryId = entryPayload.data.id;
  const reviewResponse = await authedFetch(`/api/admin/points/entries/${entryId}`, adminLogin.cookies, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "APPROVE",
      points: 17,
    }),
  });
  const reviewPayload = await readJson(reviewResponse);
  assert.equal(reviewResponse.status, 200, JSON.stringify(reviewPayload));
  assert.equal(reviewPayload?.data?.status, "APPROVED");

  const ledgerResponse = await authedFetch("/api/points/me/ledger?page=1&limit=50", athleteLogin.cookies);
  const ledgerPayload = await readJson(ledgerResponse);
  assert.equal(ledgerResponse.status, 200, JSON.stringify(ledgerPayload));
  assert.ok(Array.isArray(ledgerPayload.data));

  const expectedReferenceCode = `ACTIVITY-${activityId}-${athleteId}`;
  const activityLedgerRow = ledgerPayload.data.find((row) => row.referenceCode === expectedReferenceCode);
  assert.ok(activityLedgerRow, `expected ledger entry ${expectedReferenceCode}`);
  assert.equal(activityLedgerRow.sourceType, "ACTIVITY_APPROVAL");
  assert.equal(activityLedgerRow.points, 17);

  const recurrenceResponse = await authedFetch("/api/admin/points/process-recurrence", adminLogin.cookies, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    }),
  });
  const recurrencePayload = await readJson(recurrenceResponse);
  assert.equal(recurrenceResponse.status, 200, JSON.stringify(recurrencePayload));
  assert.ok(typeof recurrencePayload.monthly?.credited === "number");
  assert.ok(typeof recurrencePayload.quarterly?.credited === "number");

  const expirationResponse = await authedFetch("/api/admin/points/process-expiration", adminLogin.cookies, {
    method: "POST",
  });
  const expirationPayload = await readJson(expirationResponse);
  assert.equal(expirationResponse.status, 200, JSON.stringify(expirationPayload));
  assert.ok(typeof expirationPayload.usersAffected === "number");
  assert.ok(typeof expirationPayload.pointsExpired === "number");
});
