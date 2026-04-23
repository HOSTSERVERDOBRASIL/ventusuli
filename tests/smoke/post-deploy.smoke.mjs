import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

async function readJson(response) {
  return response.json().catch(() => null);
}

test("smoke: liveness responde rapidamente", async () => {
  const response = await fetch(`${BASE_URL}/api/health`);
  const payload = await readJson(response);

  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload?.scope, "liveness");
  assert.equal(payload?.checks?.process, "ok");
});

test("smoke: readiness valida banco/env/rate-limiter/dependencias", async () => {
  const response = await fetch(`${BASE_URL}/api/health?scope=readiness`);
  const payload = await readJson(response);

  assert.ok([200, 503].includes(response.status), JSON.stringify(payload));
  assert.equal(payload?.scope, "readiness");
  assert.ok(payload?.checks && typeof payload.checks === "object");
  assert.ok(typeof payload.checks.env === "string");
  assert.ok(typeof payload.checks.db === "string");
  assert.ok(typeof payload.checks.rateLimiter === "string");
  assert.ok(typeof payload.checks.dependencies === "string");
});

test("smoke: rota protegida redireciona para login sem cookie", async () => {
  const response = await fetch(`${BASE_URL}/admin`, {
    redirect: "manual",
  });

  assert.ok([307, 308].includes(response.status));
  const location = response.headers.get("location");
  assert.ok(location);
  assert.equal(new URL(location, BASE_URL).pathname, "/login");
});
