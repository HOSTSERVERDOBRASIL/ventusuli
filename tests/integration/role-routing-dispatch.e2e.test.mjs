import assert from "node:assert/strict";
import test from "node:test";
import { BASE_URL, authedFetch, loginAs, readJson } from "./helpers/auth-test-helpers.mjs";

function toPathname(locationHeader) {
  if (!locationHeader) return null;
  return new URL(locationHeader, BASE_URL).pathname;
}

test("dispatcher: /dashboard redireciona por papel", async () => {
  const expected = {
    SUPER_ADMIN: "/super-admin",
    ADMIN: "/admin",
    COACH: "/coach",
    ATHLETE: "/",
  };

  for (const [role, path] of Object.entries(expected)) {
    const login = await loginAs(
      role,
      `test-dashboard-dispatch-${role.toLowerCase()}-001`,
      300 + path.length,
    );
    assert.equal(login.response.status, 200, `${role} should login`);

    const response = await authedFetch("/dashboard", login.cookies, {
      redirect: "manual",
      headers: { "x-request-id": `test-dashboard-dispatch-${role.toLowerCase()}-002` },
    });

    assert.ok([307, 308].includes(response.status), `${role} should be redirected from /dashboard`);
    assert.equal(toPathname(response.headers.get("location")), path);
  }
});

test("sem autenticacao em rota protegida redireciona para /login", async () => {
  const response = await fetch(`${BASE_URL}/dashboard`, {
    redirect: "manual",
    headers: { "x-request-id": "test-dashboard-unauth-001" },
  });

  assert.ok([307, 308].includes(response.status));
  assert.equal(toPathname(response.headers.get("location")), "/login");
});

test("guardas de pagina por papel impedem areas indevidas", async () => {
  const superAdmin = await loginAs("SUPER_ADMIN", "test-guard-super-admin-login-001", 331);
  const admin = await loginAs("ADMIN", "test-guard-admin-login-001", 332);
  const coach = await loginAs("COACH", "test-guard-coach-login-001", 333);
  const athlete = await loginAs("ATHLETE", "test-guard-athlete-login-001", 334);

  const scenarios = [
    { user: superAdmin, pathname: "/admin", expectedPath: "/super-admin" },
    { user: admin, pathname: "/super-admin", expectedPath: "/admin" },
    { user: coach, pathname: "/", expectedPath: "/coach" },
    { user: coach, pathname: "/admin", expectedPath: "/coach" },
    { user: athlete, pathname: "/admin", expectedPath: "/" },
    { user: athlete, pathname: "/coach", expectedPath: "/" },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    const response = await authedFetch(scenario.pathname, scenario.user.cookies, {
      redirect: "manual",
      headers: { "x-request-id": `test-guard-scenario-${index + 1}` },
    });

    assert.ok([307, 308].includes(response.status), `Unexpected status for ${scenario.pathname}`);
    assert.equal(toPathname(response.headers.get("location")), scenario.expectedPath);
  }
});

test("guardas de API por papel devolvem 403 quando necessario", async () => {
  const admin = await loginAs("ADMIN", "test-api-guard-admin-login-001", 351);
  const coach = await loginAs("COACH", "test-api-guard-coach-login-001", 352);
  const athlete = await loginAs("ATHLETE", "test-api-guard-athlete-login-001", 353);

  const coachDenied = await authedFetch("/api/admin/athletes", coach.cookies, {
    headers: { "x-request-id": "test-api-guard-coach-denied-001" },
  });
  const coachPayload = await readJson(coachDenied);
  assert.equal(coachDenied.status, 403, JSON.stringify(coachPayload));

  const athleteDenied = await authedFetch("/api/super-admin/organizations", athlete.cookies, {
    headers: { "x-request-id": "test-api-guard-athlete-denied-001" },
  });
  const athletePayload = await readJson(athleteDenied);
  assert.equal(athleteDenied.status, 403, JSON.stringify(athletePayload));

  const adminAllowed = await authedFetch("/api/admin/athletes", admin.cookies, {
    headers: { "x-request-id": "test-api-guard-admin-allowed-001" },
  });
  assert.equal(adminAllowed.status, 200);
});
