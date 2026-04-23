import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { exchangeStravaCode } from "@/lib/integrations/strava-client";
import { STRAVA_STATE_COOKIE, verifyStravaOAuthState } from "@/lib/integrations/strava-oauth";
import {
  syncStravaActivities,
  upsertStravaConnectionFromToken,
} from "@/lib/integrations/strava-service";
import { logWarn, withRequestContext } from "@/lib/logger";

function settingsUrl(req: NextRequest, params: Record<string, string>) {
  const target = new URL("/configuracoes/conta", req.nextUrl.origin);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return target;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(settingsUrl(req, { strava: "oauth_error" }));
  }

  if (!code || !state) {
    return NextResponse.redirect(settingsUrl(req, { strava: "invalid_callback" }));
  }

  const stateFromCookie = req.cookies.get(STRAVA_STATE_COOKIE)?.value;
  if (!stateFromCookie || stateFromCookie !== state) {
    return NextResponse.redirect(settingsUrl(req, { strava: "state_mismatch" }));
  }

  const payload = verifyStravaOAuthState(state);
  if (!payload) {
    return NextResponse.redirect(settingsUrl(req, { strava: "state_invalid" }));
  }

  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set(STRAVA_STATE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/strava",
      maxAge: 0,
    });
    return response;
  };

  try {
    const token = await exchangeStravaCode(code);
    await upsertStravaConnectionFromToken(payload.sub, payload.org, token);
    const syncResult = await syncStravaActivities(payload.sub, payload.org, true);

    return clearStateCookie(
      NextResponse.redirect(
        settingsUrl(req, {
          strava: "connected",
          synced: String(syncResult.syncedCount),
        }),
      ),
    );
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "unknown";
    logWarn(
      "strava_callback_failed",
      withRequestContext(req, {
        reason: message,
        userId: payload.sub,
        organizationId: payload.org,
      }),
    );
    return clearStateCookie(NextResponse.redirect(settingsUrl(req, { strava: "connect_failed" })));
  }
}

export function POST() {
  return apiError("FORBIDDEN", "Metodo nao permitido.", 405);
}
