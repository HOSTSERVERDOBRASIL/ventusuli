import assert from "node:assert/strict";
import test from "node:test";
import { BASE_URL, authedFetch, loginAs } from "./helpers/auth-test-helpers.mjs";

const ROLE_PAGE_MATRIX = [
  {
    role: "SUPER_ADMIN",
    allowed: "/super-admin",
    forbidden: [
      { path: "/admin", redirectTo: "/super-admin" },
      { path: "/coach", redirectTo: "/super-admin" },
      { path: "/", redirectTo: "/super-admin" },
      { path: "/configuracoes", redirectTo: "/super-admin" },
    ],
    dashboardRedirect: "/super-admin",
  },
  {
    role: "ADMIN",
    allowed: "/admin",
    forbidden: [
      { path: "/super-admin", redirectTo: "/admin" },
      { path: "/coach", redirectTo: "/admin" },
      { path: "/", redirectTo: "/admin" },
    ],
    dashboardRedirect: "/admin",
  },
  {
    role: "COACH",
    allowed: "/coach",
    forbidden: [
      { path: "/admin", redirectTo: "/coach" },
      { path: "/super-admin", redirectTo: "/coach" },
      { path: "/", redirectTo: "/coach" },
    ],
    dashboardRedirect: "/coach",
  },
  {
    role: "ATHLETE",
    allowed: "/",
    forbidden: [
      { path: "/admin", redirectTo: "/" },
      { path: "/super-admin", redirectTo: "/" },
      { path: "/coach", redirectTo: "/" },
    ],
    dashboardRedirect: "/",
  },
];

for (const scenario of ROLE_PAGE_MATRIX) {
  test(`route access matrix for role ${scenario.role}`, async () => {
    const login = await loginAs(
      scenario.role,
      `test-role-login-${scenario.role.toLowerCase()}-001`,
      100 + ROLE_PAGE_MATRIX.indexOf(scenario),
    );

    assert.equal(login.response.status, 200, JSON.stringify(login.payload));

    const allowedResponse = await authedFetch(scenario.allowed, login.cookies, {
      headers: { "x-request-id": `test-role-allowed-${scenario.role.toLowerCase()}-001` },
    });
    assert.equal(
      allowedResponse.status,
      200,
      `Expected 200 for ${scenario.role} on ${scenario.allowed}, got ${allowedResponse.status}`,
    );

    for (const forbiddenCase of scenario.forbidden) {
      const forbiddenResponse = await authedFetch(forbiddenCase.path, login.cookies, {
        headers: {
          "x-request-id": `test-role-forbidden-${scenario.role.toLowerCase()}-${forbiddenCase.path.replace(/\//g, "_")}`,
        },
      });

      assert.equal(
        forbiddenResponse.status,
        307,
        `${scenario.role} should be redirected from ${forbiddenCase.path}`,
      );
      const location = forbiddenResponse.headers.get("location") ?? "";
      assert.ok(
        location.endsWith(forbiddenCase.redirectTo),
        `Expected redirect to ${forbiddenCase.redirectTo} for ${scenario.role}, got ${location}`,
      );
    }

    const dashboardResponse = await authedFetch("/dashboard", login.cookies, {
      headers: { "x-request-id": `test-dashboard-dispatch-${scenario.role.toLowerCase()}-001` },
    });

    assert.equal(
      dashboardResponse.status,
      307,
      `Expected /dashboard to redirect for ${scenario.role}, got ${dashboardResponse.status}`,
    );
    const dashboardLocation = dashboardResponse.headers.get("location") ?? "";
    assert.ok(
      dashboardLocation.endsWith(scenario.dashboardRedirect),
      `Expected /dashboard -> ${scenario.dashboardRedirect} for ${scenario.role}, got ${dashboardLocation}`,
    );
  });
}

test("legacy /atletas route redirects by role", async () => {
  const admin = await loginAs("ADMIN", "test-legacy-atletas-admin-001", 301);
  const coach = await loginAs("COACH", "test-legacy-atletas-coach-001", 302);
  const athlete = await loginAs("ATHLETE", "test-legacy-atletas-athlete-001", 303);

  const adminResponse = await authedFetch("/atletas", admin.cookies, {
    headers: { "x-request-id": "test-legacy-atletas-admin-fetch-001" },
  });
  assert.equal(adminResponse.status, 307);
  assert.ok((adminResponse.headers.get("location") ?? "").endsWith("/admin/atletas"));

  const coachResponse = await authedFetch("/atletas", coach.cookies, {
    headers: { "x-request-id": "test-legacy-atletas-coach-fetch-001" },
  });
  assert.equal(coachResponse.status, 307);
  assert.ok((coachResponse.headers.get("location") ?? "").endsWith("/coach/atletas"));

  const athleteResponse = await authedFetch("/atletas", athlete.cookies, {
    headers: { "x-request-id": "test-legacy-atletas-athlete-fetch-001" },
  });
  assert.equal(athleteResponse.status, 307);
  assert.ok((athleteResponse.headers.get("location") ?? "").endsWith("/"));
});

test("unauthenticated request to /dashboard redirects to login", async () => {
  const response = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
  assert.equal(response.status, 307);

  const location = response.headers.get("location") ?? "";
  assert.ok(location.includes("/login"), `Expected redirect to /login, got ${location}`);
  assert.ok(
    location.includes("next=%2Fdashboard"),
    `Expected next=/dashboard in redirect, got ${location}`,
  );
});
