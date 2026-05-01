import crypto from "crypto";
import jwt from "jsonwebtoken";

export const STRAVA_STATE_COOKIE = "vs_strava_oauth_state";
export const STRAVA_REQUIRED_SCOPES = ["read", "activity:read"] as const;
export const STRAVA_CLIENT_NOT_CONFIGURED = "strava_client_not_configured";

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

export function isStravaOAuthConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export function getStravaOAuthConfigurationIssue(): typeof STRAVA_CLIENT_NOT_CONFIGURED | null {
  return isStravaOAuthConfigured() ? null : STRAVA_CLIENT_NOT_CONFIGURED;
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
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId || !process.env.STRAVA_CLIENT_SECRET) {
    throw new Error("Strava OAuth client is not configured.");
  }

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: stravaRedirectUri(),
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_REQUIRED_SCOPES.join(","),
    state,
  });

  return `https://www.strava.com/oauth/authorize?${query.toString()}`;
}
