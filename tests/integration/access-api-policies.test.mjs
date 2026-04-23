import assert from "node:assert/strict";
import test from "node:test";
import { BASE_URL, authedFetch, loginAs, readJson } from "./helpers/auth-test-helpers.mjs";

test("protected admin API without token returns 401", async () => {
  const response = await fetch(`${BASE_URL}/api/admin/athletes`, {
    headers: { "x-request-id": "test-api-unauth-admin-001" },
  });

  const payload = await readJson(response);
  assert.equal(response.status, 401, JSON.stringify(payload));
  assert.equal(payload?.error?.code, "UNAUTHORIZED");
});

test("super admin API policy: SUPER_ADMIN allowed, ADMIN denied", async () => {
  const superAdmin = await loginAs("SUPER_ADMIN", "test-api-super-admin-login-001", 201);
  assert.equal(superAdmin.response.status, 200, JSON.stringify(superAdmin.payload));

  const superAdminAllowed = await authedFetch(
    "/api/super-admin/organizations",
    superAdmin.cookies,
    {
      headers: { "x-request-id": "test-api-super-admin-allowed-001" },
    },
  );
  const superAdminPayload = await readJson(superAdminAllowed);
  assert.equal(superAdminAllowed.status, 200, JSON.stringify(superAdminPayload));
  assert.ok(Array.isArray(superAdminPayload?.data));

  const admin = await loginAs("ADMIN", "test-api-admin-login-for-super-check-001", 202);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));

  const adminDenied = await authedFetch("/api/super-admin/organizations", admin.cookies, {
    headers: { "x-request-id": "test-api-super-admin-denied-admin-001" },
  });
  const adminDeniedPayload = await readJson(adminDenied);
  assert.equal(adminDenied.status, 403, JSON.stringify(adminDeniedPayload));
  assert.equal(adminDeniedPayload?.error?.code, "FORBIDDEN");
});

test("admin API policy: ADMIN allowed, COACH/ATHLETE/SUPER_ADMIN denied", async () => {
  const admin = await loginAs("ADMIN", "test-api-admin-login-001", 203);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));

  const adminAllowed = await authedFetch("/api/admin/athletes", admin.cookies, {
    headers: { "x-request-id": "test-api-admin-allowed-001" },
  });
  const adminPayload = await readJson(adminAllowed);
  assert.equal(adminAllowed.status, 200, JSON.stringify(adminPayload));
  assert.ok(Array.isArray(adminPayload?.data));

  for (const role of ["COACH", "ATHLETE", "SUPER_ADMIN"]) {
    const login = await loginAs(
      role,
      `test-api-admin-denied-login-${role.toLowerCase()}-001`,
      204 + role.length,
    );
    assert.equal(login.response.status, 200, JSON.stringify(login.payload));

    const denied = await authedFetch("/api/admin/athletes", login.cookies, {
      headers: { "x-request-id": `test-api-admin-denied-${role.toLowerCase()}-001` },
    });
    const deniedPayload = await readJson(denied);

    assert.equal(denied.status, 403, `${role} should not access /api/admin/athletes`);
    assert.equal(deniedPayload?.error?.code, "FORBIDDEN");
  }
});

test("athlete profile API policy: ATHLETE allowed, ADMIN denied", async () => {
  const athlete = await loginAs("ATHLETE", "test-api-athlete-login-001", 211);
  assert.equal(athlete.response.status, 200, JSON.stringify(athlete.payload));

  const athleteAllowed = await authedFetch("/api/me/profile", athlete.cookies, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-api-athlete-profile-allowed-001",
    },
    body: JSON.stringify({ city: "Florianopolis", state: "SC" }),
  });
  const athletePayload = await readJson(athleteAllowed);
  assert.equal(athleteAllowed.status, 200, JSON.stringify(athletePayload));

  const admin = await loginAs("ADMIN", "test-api-admin-login-for-profile-deny-001", 212);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));

  const adminDenied = await authedFetch("/api/me/profile", admin.cookies, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-api-athlete-profile-denied-admin-001",
    },
    body: JSON.stringify({ city: "Florianopolis", state: "SC" }),
  });

  const adminDeniedPayload = await readJson(adminDenied);
  assert.equal(adminDenied.status, 403, JSON.stringify(adminDeniedPayload));
  assert.equal(adminDeniedPayload?.error?.code, "FORBIDDEN");
});

test("notices API policy: SUPER_ADMIN denied, ADMIN allowed", async () => {
  const superAdmin = await loginAs("SUPER_ADMIN", "test-api-notices-super-admin-login-001", 221);
  assert.equal(superAdmin.response.status, 200, JSON.stringify(superAdmin.payload));

  const superAdminDenied = await authedFetch("/api/notices", superAdmin.cookies, {
    method: "GET",
    headers: { "x-request-id": "test-api-notices-super-admin-denied-001" },
  });
  const superAdminDeniedPayload = await readJson(superAdminDenied);
  assert.equal(superAdminDenied.status, 403, JSON.stringify(superAdminDeniedPayload));
  assert.equal(superAdminDeniedPayload?.error?.code, "FORBIDDEN");

  const admin = await loginAs("ADMIN", "test-api-notices-admin-login-001", 222);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));

  const adminAllowed = await authedFetch("/api/notices", admin.cookies, {
    method: "GET",
    headers: { "x-request-id": "test-api-notices-admin-allowed-001" },
  });

  const adminAllowedPayload = await readJson(adminAllowed);
  assert.equal(adminAllowed.status, 200, JSON.stringify(adminAllowedPayload));
  assert.ok(Array.isArray(adminAllowedPayload?.data));
});
