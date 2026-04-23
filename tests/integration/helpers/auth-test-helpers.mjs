const BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const ROLE_CREDENTIALS = {
  SUPER_ADMIN: {
    email:
      process.env.TEST_SUPER_ADMIN_EMAIL ??
      process.env.SUPER_ADMIN_EMAIL ??
      "superadmin@ventu.demo",
    password:
      process.env.TEST_SUPER_ADMIN_PASSWORD ??
      process.env.SUPER_ADMIN_PASSWORD ??
      "SuperAdmin@1234",
  },
  ADMIN: {
    email: process.env.TEST_ADMIN_EMAIL ?? process.env.TEST_LOGIN_EMAIL ?? "admin@ventu.demo",
    password: process.env.TEST_ADMIN_PASSWORD ?? process.env.TEST_LOGIN_PASSWORD ?? "Demo@1234",
  },
  COACH: {
    email: process.env.TEST_COACH_EMAIL ?? "coach@ventu.demo",
    password: process.env.TEST_COACH_PASSWORD ?? "Demo@1234",
  },
  ATHLETE: {
    email: process.env.TEST_ATHLETE_EMAIL ?? "atleta@ventu.demo",
    password: process.env.TEST_ATHLETE_PASSWORD ?? "Atleta@1234",
  },
};

export function testIp(suffix) {
  return `203.0.113.${((Number(suffix) + Number(RUN_ID.split("-")[1])) % 250) + 1}`;
}

export function readJson(response) {
  return response.json().catch(() => null);
}

export function mergeCookies(previous, setCookieHeader) {
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

export function cookieHeader(cookies) {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export async function loginAs(role, requestId, ipSuffix) {
  const credentials = ROLE_CREDENTIALS[role];
  if (!credentials) {
    throw new Error(`Unsupported role for tests: ${role}`);
  }

  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-forwarded-for": testIp(ipSuffix),
    },
    body: JSON.stringify(credentials),
  });

  const payload = await readJson(response);
  const cookies = mergeCookies(new Map(), response.headers.get("set-cookie"));

  return { response, payload, cookies };
}

export async function authedFetch(pathname, cookies, options = {}) {
  const { headers: incomingHeaders, redirect, ...rest } = options;
  const headers = {
    ...(incomingHeaders ?? {}),
    Cookie: cookieHeader(cookies),
  };

  return fetch(`${BASE_URL}${pathname}`, {
    redirect: redirect ?? "manual",
    ...rest,
    headers,
  });
}

export { BASE_URL };
