import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";
import {
  getStravaConnectionStatus,
  StravaIntegrationError,
  syncStravaActivities,
} from "@/lib/integrations/strava-service";

function canUse(role: UserRole): boolean {
  return role === UserRole.ATHLETE;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUse(auth.role))
    return apiError("FORBIDDEN", "Apenas atletas podem acessar esta integracao.", 403);

  try {
    const status = await getStravaConnectionStatus(auth.userId, auth.organizationId);
    return NextResponse.json({ data: status });
  } catch (error) {
    if (error instanceof StravaIntegrationError) {
      return apiError("INTERNAL_ERROR", error.message, error.statusCode);
    }
    const message =
      error instanceof Error ? error.message : "Nao foi possivel carregar o status do Strava.";
    return apiError("INTERNAL_ERROR", message, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUse(auth.role))
    return apiError("FORBIDDEN", "Apenas atletas podem sincronizar Strava.", 403);

  try {
    const result = await syncStravaActivities(auth.userId, auth.organizationId, false);
    return NextResponse.json({ data: result });
  } catch (syncError) {
    if (syncError instanceof StravaIntegrationError) {
      return apiError("INTERNAL_ERROR", syncError.message, syncError.statusCode);
    }
    const message =
      syncError instanceof Error
        ? syncError.message
        : "Nao foi possivel sincronizar atividades do Strava.";
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
