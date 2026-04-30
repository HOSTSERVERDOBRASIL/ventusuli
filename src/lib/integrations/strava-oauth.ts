import crypto from "crypto";
import jwt from "jsonwebtoken";

export const STRAVA_STATE_COOKIE = "vs_strava_oauth_state";

interface StravaOAuthStatePayload {
  sub: string;
  org: string;
  nonce: string;
  iat: number;
  exp: number;
}

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not configured for Strava OAuth state.");
  }
  return secret;
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function stravaRedirectUri(): string {
  return process.env.STRAVA_REDIRECT_URI ?? `${appBaseUrl()}/api/integrations/strava/callback`;
}

export function getStravaOAuthConfigStatus(): { configured: boolean; missing: string[] } {
  const missing = ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"].filter(
    (key) => !process.env[key],
  );

  return {
    configured: missing.length === 0,
    missing,
  };
}

export function createStravaOAuthState(userId: string, organizationId: string): string {
  const secret = requireJwtSecret();
  const nonce = crypto.randomUUID();
  return jwt.sign(
    {
      sub: userId,
      org: organizationId,
      nonce,
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "10m",
    },
  );
}

export function verifyStravaOAuthState(state: string): StravaOAuthStatePayload | null {
  try {
    const secret = requireJwtSecret();
    return jwt.verify(state, secret, { algorithms: ["HS256"] }) as StravaOAuthStatePayload;
  } catch {
    return null;
  }
}

export function buildStravaAuthorizeUrl(state: string): string {
  const config = getStravaOAuthConfigStatus();
  if (!config.configured) {
    throw new Error(`Strava OAuth not configured: ${config.missing.join(", ")}.`);
  }

  const query = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID as string,
    redirect_uri: stravaRedirectUri(),
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state,
  });

  return `https://www.strava.com/oauth/authorize?${query.toString()}`;
}
