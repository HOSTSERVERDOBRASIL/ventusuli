import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";
import {
  buildStravaAuthorizeUrl,
  createStravaOAuthState,
  STRAVA_STATE_COOKIE,
} from "@/lib/integrations/strava-oauth";
import {
  disconnectStrava,
  getStravaConnectionStatus,
  StravaIntegrationError,
} from "@/lib/integrations/strava-service";
import { handleApiException } from "@/lib/api-error";
import { logError, withRequestContext } from "@/lib/logger";

function canConnect(role: UserRole): boolean {
  return role === UserRole.ATHLETE;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canConnect(auth.role)) {
    return apiError("FORBIDDEN", "Apenas atletas podem conectar o Strava.", 403);
  }

  try {
    const status = await getStravaConnectionStatus(auth.userId, auth.organizationId);
    const state = createStravaOAuthState(auth.userId, auth.organizationId);
    const authorizeUrl = buildStravaAuthorizeUrl(state);

    const shouldRedirect = req.nextUrl.searchParams.get("redirect") === "1";
    const response = shouldRedirect
      ? NextResponse.redirect(authorizeUrl)
      : NextResponse.json({
          data: {
            ...status,
            authorizeUrl,
          },
        });

    response.cookies.set(STRAVA_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/integrations/strava",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error) {
    if (error instanceof StravaIntegrationError) {
      logError("strava_connect_status_failed", withRequestContext(req, { message: error.message }));
      return apiError("INTERNAL_ERROR", error.message, error.statusCode);
    }
    logError(
      "strava_connect_status_failed",
      withRequestContext(req, { message: "unexpected_error" }),
    );
    return handleApiException(error, "Nao foi possivel iniciar a conexao OAuth do Strava.");
  }
}

export async function DELETE(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canConnect(auth.role)) {
    return apiError("FORBIDDEN", "Apenas atletas podem desconectar o Strava.", 403);
  }

  try {
    await disconnectStrava(auth.userId, auth.organizationId);
    return NextResponse.json({ data: { disconnected: true } });
  } catch (error) {
    if (error instanceof StravaIntegrationError) {
      logError("strava_disconnect_failed", withRequestContext(req, { message: error.message }));
      return apiError("INTERNAL_ERROR", error.message, error.statusCode);
    }
    logError("strava_disconnect_failed", withRequestContext(req, { message: "unexpected_error" }));
    return handleApiException(error, "Nao foi possivel desconectar o Strava.");
  }
}
