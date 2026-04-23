import assert from "node:assert/strict";
import test from "node:test";
import { BASE_URL, authedFetch, loginAs, readJson } from "./helpers/auth-test-helpers.mjs";

async function getPublishedEventForAthlete(cookies) {
  const eventsResponse = await authedFetch("/api/events?limit=50", cookies, {
    headers: { "x-request-id": "test-athlete-events-list-001" },
  });
  const eventsPayload = await readJson(eventsResponse);
  assert.equal(eventsResponse.status, 200, JSON.stringify(eventsPayload));
  assert.ok(Array.isArray(eventsPayload?.data));

  const eventWithDistance = eventsPayload.data.find(
    (item) =>
      item?.status === "PUBLISHED" && Array.isArray(item?.distances) && item.distances.length > 0,
  );
  assert.ok(eventWithDistance, "Expected at least one published event with distance in seed");
  return eventWithDistance;
}

test("fluxo atleta: provas -> inscricao -> minhas inscricoes -> financeiro -> recompensas/resgates", async () => {
  const athlete = await loginAs("ATHLETE", "test-athlete-flow-login-001", 401);
  assert.equal(athlete.response.status, 200, JSON.stringify(athlete.payload));

  const event = await getPublishedEventForAthlete(athlete.cookies);
  const distance = event.distances[0];

  const registrationResponse = await authedFetch("/api/registrations", athlete.cookies, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-athlete-registration-create-001",
    },
    body: JSON.stringify({
      eventId: event.id,
      distanceId: distance.id,
    }),
  });
  const registrationPayload = await readJson(registrationResponse);
  assert.ok([200, 201].includes(registrationResponse.status), JSON.stringify(registrationPayload));
  assert.ok(registrationPayload?.data?.id);
  assert.equal(registrationPayload?.data?.eventId, event.id);

  const myRegistrationsResponse = await authedFetch("/api/registrations", athlete.cookies, {
    headers: { "x-request-id": "test-athlete-registrations-list-001" },
  });
  const myRegistrationsPayload = await readJson(myRegistrationsResponse);
  assert.equal(myRegistrationsResponse.status, 200, JSON.stringify(myRegistrationsPayload));
  assert.ok(Array.isArray(myRegistrationsPayload?.data));
  assert.ok(
    myRegistrationsPayload.data.some((item) => item.id === registrationPayload.data.id),
    "Expected created registration in athlete list",
  );

  const paymentDetailResponse = await authedFetch(
    `/api/registrations/${registrationPayload.data.id}/payment`,
    athlete.cookies,
    {
      headers: { "x-request-id": "test-athlete-registration-payment-001" },
    },
  );
  const paymentDetailPayload = await readJson(paymentDetailResponse);
  assert.equal(paymentDetailResponse.status, 200, JSON.stringify(paymentDetailPayload));
  assert.ok(paymentDetailPayload?.data?.status);
  assert.ok(paymentDetailPayload?.data?.amountCents >= 0);

  const dashboardResponse = await authedFetch("/api/dashboard/athlete", athlete.cookies, {
    headers: { "x-request-id": "test-athlete-dashboard-api-001" },
  });
  const dashboardPayload = await readJson(dashboardResponse);
  assert.equal(dashboardResponse.status, 200, JSON.stringify(dashboardPayload));
  assert.ok(dashboardPayload?.data?.metrics);

  const rewardsResponse = await authedFetch("/api/rewards?page=1&limit=12", athlete.cookies, {
    headers: { "x-request-id": "test-athlete-rewards-list-001" },
  });
  const rewardsPayload = await readJson(rewardsResponse);
  assert.equal(rewardsResponse.status, 200, JSON.stringify(rewardsPayload));
  assert.ok(Array.isArray(rewardsPayload?.data));
  assert.ok(
    typeof rewardsPayload?.currentBalance === "number" || rewardsPayload?.currentBalance === null,
  );

  if (rewardsPayload.data.length > 0) {
    const reward = rewardsPayload.data[0];

    const calcResponse = await authedFetch("/api/rewards/calculate", athlete.cookies, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "test-athlete-reward-calc-001",
      },
      body: JSON.stringify({
        rewardItemId: reward.id,
        pointsToUse: 0,
      }),
    });
    const calcPayload = await readJson(calcResponse);
    assert.equal(calcResponse.status, 200, JSON.stringify(calcPayload));
    assert.ok(calcPayload?.data?.item?.id === reward.id);
  }

  const redemptionsResponse = await authedFetch("/api/rewards/redemptions/me", athlete.cookies, {
    headers: { "x-request-id": "test-athlete-redemptions-list-001" },
  });
  const redemptionsPayload = await readJson(redemptionsResponse);
  assert.equal(redemptionsResponse.status, 200, JSON.stringify(redemptionsPayload));
  assert.ok(Array.isArray(redemptionsPayload?.data));
});

test("fluxo admin: atletas, eventos, pagamentos, avisos e recompensas", async () => {
  const admin = await loginAs("ADMIN", "test-admin-flow-login-001", 451);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));

  const athletesResponse = await authedFetch("/api/admin/athletes", admin.cookies, {
    headers: { "x-request-id": "test-admin-athletes-list-001" },
  });
  const athletesPayload = await readJson(athletesResponse);
  assert.equal(athletesResponse.status, 200, JSON.stringify(athletesPayload));
  assert.ok(Array.isArray(athletesPayload?.data));

  const eventsResponse = await authedFetch("/api/events?status=PUBLISHED&limit=10", admin.cookies, {
    headers: { "x-request-id": "test-admin-events-list-001" },
  });
  const eventsPayload = await readJson(eventsResponse);
  assert.equal(eventsResponse.status, 200, JSON.stringify(eventsPayload));
  assert.ok(Array.isArray(eventsPayload?.data));

  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 30);
  const paymentsResponse = await authedFetch(
    `/api/payments?startDate=${encodeURIComponent(past.toISOString())}&endDate=${encodeURIComponent(now.toISOString())}`,
    admin.cookies,
    { headers: { "x-request-id": "test-admin-payments-list-001" } },
  );
  const paymentsPayload = await readJson(paymentsResponse);
  assert.equal(paymentsResponse.status, 200, JSON.stringify(paymentsPayload));
  assert.ok(Array.isArray(paymentsPayload?.data));

  const noticeCreateResponse = await authedFetch("/api/notices", admin.cookies, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-admin-notice-create-001",
    },
    body: JSON.stringify({
      title: `QA Sprint 8 ${Date.now()}`,
      body: "Aviso automatizado para validar fluxo de publicacao e entregas.",
      audience: "ALL",
      telegram_enabled: true,
      pinned: false,
    }),
  });
  const noticeCreatePayload = await readJson(noticeCreateResponse);
  assert.equal(noticeCreateResponse.status, 201, JSON.stringify(noticeCreatePayload));
  const noticeId = noticeCreatePayload?.data?.id;
  assert.ok(noticeId);

  const publishResponse = await authedFetch(`/api/notices/${noticeId}/publish`, admin.cookies, {
    method: "POST",
    headers: { "x-request-id": "test-admin-notice-publish-001" },
  });
  const publishPayload = await readJson(publishResponse);
  assert.equal(publishResponse.status, 200, JSON.stringify(publishPayload));
  assert.equal(publishPayload?.data?.status, "PUBLISHED");

  const resendResponse = await authedFetch(
    `/api/notices/${noticeId}/resend-telegram`,
    admin.cookies,
    {
      method: "POST",
      headers: { "x-request-id": "test-admin-notice-resend-001" },
    },
  );
  const resendPayload = await readJson(resendResponse);
  assert.ok([200, 503].includes(resendResponse.status), JSON.stringify(resendPayload));

  const rewardsResponse = await authedFetch("/api/admin/rewards?page=1&limit=10", admin.cookies, {
    headers: { "x-request-id": "test-admin-rewards-list-001" },
  });
  const rewardsPayload = await readJson(rewardsResponse);
  assert.equal(rewardsResponse.status, 200, JSON.stringify(rewardsPayload));
  assert.ok(Array.isArray(rewardsPayload?.data));
});

test("fluxo coach: landing, atletas e avisos de leitura", async () => {
  const coach = await loginAs("COACH", "test-coach-flow-login-001", 481);
  assert.equal(coach.response.status, 200, JSON.stringify(coach.payload));

  const coachLanding = await authedFetch("/coach", coach.cookies, {
    headers: { "x-request-id": "test-coach-landing-001" },
  });
  assert.equal(coachLanding.status, 200);

  const athletesResponse = await authedFetch("/api/athletes?page=1&limit=10", coach.cookies, {
    headers: { "x-request-id": "test-coach-athletes-api-001" },
  });
  const athletesPayload = await readJson(athletesResponse);
  assert.equal(athletesResponse.status, 200, JSON.stringify(athletesPayload));
  assert.ok(Array.isArray(athletesPayload?.data));

  const noticesResponse = await authedFetch("/api/notices", coach.cookies, {
    headers: { "x-request-id": "test-coach-notices-read-001" },
  });
  const noticesPayload = await readJson(noticesResponse);
  assert.equal(noticesResponse.status, 200, JSON.stringify(noticesPayload));
  assert.ok(Array.isArray(noticesPayload?.data));
});

test("fluxo super-admin: organizacoes e convites de administradores", async () => {
  const superAdmin = await loginAs("SUPER_ADMIN", "test-super-admin-flow-login-001", 501);
  assert.equal(superAdmin.response.status, 200, JSON.stringify(superAdmin.payload));

  const orgsResponse = await authedFetch("/api/super-admin/organizations", superAdmin.cookies, {
    headers: { "x-request-id": "test-super-admin-orgs-list-001" },
  });
  const orgsPayload = await readJson(orgsResponse);
  assert.equal(orgsResponse.status, 200, JSON.stringify(orgsPayload));
  assert.ok(Array.isArray(orgsPayload?.data));

  const invitesResponse = await authedFetch(
    "/api/super-admin/organization-invites",
    superAdmin.cookies,
    {
      headers: { "x-request-id": "test-super-admin-org-invites-list-001" },
    },
  );
  const invitesPayload = await readJson(invitesResponse);
  assert.equal(invitesResponse.status, 200, JSON.stringify(invitesPayload));
  assert.ok(Array.isArray(invitesPayload?.data));
});

test("integracoes principais: Strava (athlete) e restricao por papel", async () => {
  const athlete = await loginAs("ATHLETE", "test-integration-athlete-login-001", 531);
  assert.equal(athlete.response.status, 200, JSON.stringify(athlete.payload));

  const stravaConnectResponse = await authedFetch(
    "/api/integrations/strava/connect",
    athlete.cookies,
    {
      headers: { "x-request-id": "test-strava-connect-athlete-001" },
    },
  );
  const stravaConnectPayload = await readJson(stravaConnectResponse);
  assert.equal(stravaConnectResponse.status, 200, JSON.stringify(stravaConnectPayload));
  assert.ok(typeof stravaConnectPayload?.data?.connected === "boolean");
  assert.ok(typeof stravaConnectPayload?.data?.authorizeUrl === "string");

  const stravaSyncStatusResponse = await authedFetch(
    "/api/integrations/strava/sync",
    athlete.cookies,
    {
      headers: { "x-request-id": "test-strava-sync-status-athlete-001" },
    },
  );
  const stravaSyncStatusPayload = await readJson(stravaSyncStatusResponse);
  assert.equal(stravaSyncStatusResponse.status, 200, JSON.stringify(stravaSyncStatusPayload));
  assert.ok(typeof stravaSyncStatusPayload?.data?.connected === "boolean");

  const admin = await loginAs("ADMIN", "test-integration-admin-login-001", 532);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));

  const adminDeniedStrava = await authedFetch("/api/integrations/strava/connect", admin.cookies, {
    headers: { "x-request-id": "test-strava-connect-admin-denied-001" },
  });
  const adminDeniedPayload = await readJson(adminDeniedStrava);
  assert.equal(adminDeniedStrava.status, 403, JSON.stringify(adminDeniedPayload));
});
