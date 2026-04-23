import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

function testIp(suffix) {
  return `203.0.113.${(Number(suffix) + Number(RUN_ID.split("-")[1])) % 250 + 1}`;
}

function readJson(response) {
  return response.json().catch(() => null);
}

function mergeCookies(previous, setCookieHeader) {
  const jar = new Map(previous);
  if (!setCookieHeader) return jar;

  const cookies = setCookieHeader
    .split(/,(?=\s*[^;]+=)/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const [name, value] = pair.split("=");
    if (!name || typeof value === "undefined") continue;
    jar.set(name.trim(), value.trim());
  }

  return jar;
}

function cookieHeader(cookies) {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

test("health liveness endpoint responds", async () => {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.ok([200, 206, 503].includes(response.status));

  const payload = await readJson(response);
  assert.ok(payload && typeof payload === "object");
  assert.ok(typeof payload.timestamp === "string");
  assert.ok(payload.checks && typeof payload.checks === "object");
});

test("health readiness endpoint responds with expected shape", async () => {
  const response = await fetch(`${BASE_URL}/api/health?scope=readiness`);
  assert.ok([200, 503].includes(response.status));

  const payload = await readJson(response);
  assert.ok(payload && typeof payload === "object");
  assert.equal(payload.scope, "readiness");
  assert.ok(payload.checks && typeof payload.checks === "object");
  assert.ok(typeof payload.checks.db === "string");
});

test("auth flow: login -> session -> refresh", async () => {
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-login-001",
      "x-forwarded-for": testIp(11),
    },
    body: JSON.stringify({
      email: process.env.TEST_LOGIN_EMAIL ?? "admin@ventu.demo",
      password: process.env.TEST_LOGIN_PASSWORD ?? "Demo@1234",
    }),
  });

  const loginPayload = await readJson(loginResponse);
  assert.equal(loginResponse.status, 200, JSON.stringify(loginPayload));
  assert.ok(loginPayload?.accessToken);
  assert.ok(loginPayload?.user?.id);

  let cookies = mergeCookies(new Map(), loginResponse.headers.get("set-cookie"));
  assert.ok(cookies.has("vs_access_token"));
  assert.ok(cookies.has("vs_refresh_token"));

  const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      Cookie: cookieHeader(cookies),
      "x-request-id": "test-session-001",
      "x-forwarded-for": testIp(12),
    },
  });

  const sessionPayload = await readJson(sessionResponse);
  assert.equal(sessionResponse.status, 200, JSON.stringify(sessionPayload));
  assert.ok(sessionPayload?.user?.id);
  assert.ok(sessionPayload?.user?.organization_id);

  const refreshResponse = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(cookies),
      "x-request-id": "test-refresh-001",
      "x-forwarded-for": testIp(13),
    },
  });

  const refreshPayload = await readJson(refreshResponse);
  assert.equal(refreshResponse.status, 200, JSON.stringify(refreshPayload));
  assert.ok(refreshPayload?.accessToken);

  cookies = mergeCookies(cookies, refreshResponse.headers.get("set-cookie"));
  assert.ok(cookies.has("vs_access_token"));
  assert.ok(cookies.has("vs_refresh_token"));
});

test("auth flow: logout invalidates session cookies", async () => {
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-login-logout-001",
      "x-forwarded-for": testIp(21),
    },
    body: JSON.stringify({
      email: process.env.TEST_LOGIN_EMAIL ?? "admin@ventu.demo",
      password: process.env.TEST_LOGIN_PASSWORD ?? "Demo@1234",
    }),
  });

  const loginPayload = await readJson(loginResponse);
  assert.equal(loginResponse.status, 200, JSON.stringify(loginPayload));

  let cookies = mergeCookies(new Map(), loginResponse.headers.get("set-cookie"));
  assert.ok(cookies.has("vs_access_token"));
  assert.ok(cookies.has("vs_refresh_token"));

  const logoutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(cookies),
      "x-request-id": "test-logout-001",
      "x-forwarded-for": testIp(22),
    },
  });

  assert.equal(logoutResponse.status, 200);
  cookies = mergeCookies(cookies, logoutResponse.headers.get("set-cookie"));

  const sessionAfterLogout = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      Cookie: cookieHeader(cookies),
      "x-request-id": "test-session-after-logout-001",
      "x-forwarded-for": testIp(23),
    },
  });

  const sessionPayload = await readJson(sessionAfterLogout);
  assert.equal(sessionAfterLogout.status, 401, JSON.stringify(sessionPayload));
});
