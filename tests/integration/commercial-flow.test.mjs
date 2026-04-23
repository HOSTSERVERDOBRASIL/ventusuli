import assert from "node:assert/strict";
import test from "node:test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const SUPER_ADMIN_EMAIL = process.env.TEST_SUPER_ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL ?? "superadmin@ventu.demo";
const SUPER_ADMIN_PASSWORD =
  process.env.TEST_SUPER_ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin@1234";
const RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
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

function testIp(suffix) {
  return `198.51.100.${(Number(suffix) + Number(RUN_ID.split("-")[1])) % 250 + 1}`;
}

async function login(email, password, requestId, ipSuffix) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-forwarded-for": testIp(ipSuffix),
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await readJson(response);
  const cookies = mergeCookies(new Map(), response.headers.get("set-cookie"));
  return { response, payload, cookies };
}

test("commercial flow: invite org admin -> register athlete pending -> approve -> onboarding", async () => {
  const superAdminLogin = await login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, "test-super-admin-login-001", 31);
  assert.equal(superAdminLogin.response.status, 200, JSON.stringify(superAdminLogin.payload));
  assert.ok(superAdminLogin.cookies.has("vs_access_token"));
  assert.ok(superAdminLogin.cookies.has("vs_refresh_token"));

  const suffix = uniqueSuffix();
  const orgSlug = `flow-${suffix}`;
  const orgName = `Assessoria Flow ${suffix}`;
  const invitedAdminEmail = `admin.flow.${suffix}@ventu.demo`;
  const invitedAdminPassword = "AdminFlow@1234";
  const athleteEmail = `athlete.flow.${suffix}@ventu.demo`;
  const athletePassword = "AthleteFlow@1234";

  const createOrganization = await fetch(`${BASE_URL}/api/super-admin/organizations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(superAdminLogin.cookies),
      "x-request-id": "test-super-admin-create-org-001",
      "x-forwarded-for": testIp(32),
    },
    body: JSON.stringify({
      orgName,
      orgSlug,
      adminEmail: invitedAdminEmail,
      plan: "STARTER",
      inviteExpiresInDays: 14,
    }),
  });

  const createOrganizationPayload = await readJson(createOrganization);
  assert.equal(createOrganization.status, 201, JSON.stringify(createOrganizationPayload));
  const inviteToken = createOrganizationPayload?.data?.adminInvite?.token;
  assert.ok(inviteToken);

  const checkInvite = await fetch(`${BASE_URL}/api/auth/admin-invite/${encodeURIComponent(inviteToken)}`, {
    headers: { "x-request-id": "test-admin-invite-check-001", "x-forwarded-for": testIp(33) },
  });
  const checkInvitePayload = await readJson(checkInvite);
  assert.equal(checkInvite.status, 200, JSON.stringify(checkInvitePayload));
  assert.equal(checkInvitePayload?.data?.email, invitedAdminEmail);

  const acceptInvite = await fetch(`${BASE_URL}/api/auth/accept-admin-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-admin-invite-accept-001",
      "x-forwarded-for": testIp(34),
    },
    body: JSON.stringify({
      token: inviteToken,
      name: "Admin Flow",
      password: invitedAdminPassword,
    }),
  });

  const acceptInvitePayload = await readJson(acceptInvite);
  assert.equal(acceptInvite.status, 201, JSON.stringify(acceptInvitePayload));

  const adminCookies = mergeCookies(new Map(), acceptInvite.headers.get("set-cookie"));
  assert.ok(adminCookies.has("vs_access_token"));
  assert.ok(adminCookies.has("vs_refresh_token"));

  const createAthleteInvite = await fetch(`${BASE_URL}/api/admin/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(adminCookies),
      "x-request-id": "test-admin-create-athlete-invite-001",
      "x-forwarded-for": testIp(35),
    },
    body: JSON.stringify({
      reusable: false,
      maxUses: 1,
      label: "Invite de teste de fluxo",
    }),
  });

  const createAthleteInvitePayload = await readJson(createAthleteInvite);
  assert.equal(createAthleteInvite.status, 201, JSON.stringify(createAthleteInvitePayload));
  const athleteInviteToken = createAthleteInvitePayload?.data?.token;
  assert.ok(athleteInviteToken);

  const registerAthlete = await fetch(`${BASE_URL}/api/auth/register-athlete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "test-register-athlete-pending-001",
      "x-forwarded-for": testIp(36),
    },
    body: JSON.stringify({
      name: "Atleta Flow",
      email: athleteEmail,
      password: athletePassword,
      inviteToken: athleteInviteToken,
    }),
  });

  const registerAthletePayload = await readJson(registerAthlete);
  assert.equal(registerAthlete.status, 202, JSON.stringify(registerAthletePayload));
  assert.equal(registerAthletePayload?.requiresApproval, true);
  const athleteId = registerAthletePayload?.user?.id;
  assert.ok(athleteId);

  const pendingAthleteLogin = await login(athleteEmail, athletePassword, "test-athlete-login-pending-001", 37);
  assert.equal(pendingAthleteLogin.response.status, 403, JSON.stringify(pendingAthleteLogin.payload));

  const approveAthlete = await fetch(`${BASE_URL}/api/athletes/${encodeURIComponent(athleteId)}/approve`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(adminCookies),
      "x-request-id": "test-approve-athlete-001",
      "x-forwarded-for": testIp(38),
    },
  });

  const approveAthletePayload = await readJson(approveAthlete);
  assert.equal(approveAthlete.status, 200, JSON.stringify(approveAthletePayload));
  assert.equal(approveAthletePayload?.data?.athleteStatus, "ACTIVE");

  const activeAthleteLogin = await login(athleteEmail, athletePassword, "test-athlete-login-active-001", 39);
  assert.equal(activeAthleteLogin.response.status, 200, JSON.stringify(activeAthleteLogin.payload));
  const athleteCookies = activeAthleteLogin.cookies;
  assert.ok(athleteCookies.has("vs_access_token"));
  assert.ok(athleteCookies.has("vs_refresh_token"));

  const onboardingPatch = await fetch(`${BASE_URL}/api/me/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(athleteCookies),
      "x-request-id": "test-athlete-onboarding-001",
      "x-forwarded-for": testIp(40),
    },
    body: JSON.stringify({
      cpf: "52998224725",
      phone: "48999990000",
      city: "Florianopolis",
      state: "SC",
      gender: "M",
    }),
  });

  const onboardingPatchPayload = await readJson(onboardingPatch);
  assert.equal(onboardingPatch.status, 200, JSON.stringify(onboardingPatchPayload));
  assert.equal(onboardingPatchPayload?.data?.athlete_status, "ACTIVE");
  assert.ok(onboardingPatchPayload?.data?.onboarding_completed_at);

  const athleteSession = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      Cookie: cookieHeader(athleteCookies),
      "x-request-id": "test-athlete-session-after-onboarding-001",
      "x-forwarded-for": testIp(41),
    },
  });

  const athleteSessionPayload = await readJson(athleteSession);
  assert.equal(athleteSession.status, 200, JSON.stringify(athleteSessionPayload));
  assert.equal(athleteSessionPayload?.user?.profile?.hasCpf, true);
  assert.equal(athleteSessionPayload?.user?.profile?.athleteStatus, "ACTIVE");
});
