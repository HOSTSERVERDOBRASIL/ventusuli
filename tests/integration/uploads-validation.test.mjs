import assert from "node:assert/strict";
import test from "node:test";
import { BASE_URL, cookieHeader, loginAs, readJson } from "./helpers/auth-test-helpers.mjs";

const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0WQAAAAASUVORK5CYII=";

async function uploadAsAdmin(file, scope = "branding") {
  const admin = await loginAs("ADMIN", `test-upload-login-${scope}-001`, 241);
  assert.equal(admin.response.status, 200, JSON.stringify(admin.payload));

  const formData = new FormData();
  formData.append("scope", scope);
  formData.append("file", file);

  return fetch(`${BASE_URL}/api/uploads`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(admin.cookies),
      "x-request-id": `test-upload-request-${scope}-001`,
    },
    body: formData,
  });
}

test("upload rejects svg files", async () => {
  const file = new File(
    ['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'],
    "bad.svg",
    { type: "image/svg+xml" },
  );

  const response = await uploadAsAdmin(file);
  const payload = await readJson(response);

  assert.equal(response.status, 400, JSON.stringify(payload));
  assert.equal(payload?.error?.code, "VALIDATION_ERROR");
});

test("upload rejects files whose signature does not match declared png type", async () => {
  const file = new File(["not-a-real-png"], "fake.png", { type: "image/png" });

  const response = await uploadAsAdmin(file);
  const payload = await readJson(response);

  assert.equal(response.status, 400, JSON.stringify(payload));
  assert.equal(payload?.error?.code, "VALIDATION_ERROR");
});

test("upload accepts a valid png image", async () => {
  const file = new File([Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64")], "ok.png", {
    type: "image/png",
  });

  const response = await uploadAsAdmin(file);
  const payload = await readJson(response);

  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload?.data?.mimeType, "image/png");
  assert.equal(payload?.data?.scope, "branding");
});
