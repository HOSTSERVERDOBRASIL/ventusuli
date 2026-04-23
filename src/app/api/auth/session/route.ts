import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { clearAccessCookie, clearRefreshCookie } from "@/lib/cookies";
import { sanitizeOrganizationSettings } from "@/lib/organization-settings";
import { getAccessTokenFromRequest } from "@/lib/request-auth";
import { logWarn, withRequestContext } from "@/lib/logger";

function sessionErrorResponse(
  code: "UNAUTHORIZED" | "TOKEN_INVALID" | "FORBIDDEN",
  message: string,
  status: 401 | 403,
): NextResponse {
  const response = apiError(code, message, status);
  response.headers.set("X-Session-Expired", "1");
  clearRefreshCookie(response);
  clearAccessCookie(response);
  return response;
}

export async function GET(req: NextRequest) {
  const token = getAccessTokenFromRequest(req, "bearer-first");

  if (!token) {
    logWarn("auth_session_missing_token", withRequestContext(req));
    return sessionErrorResponse("UNAUTHORIZED", "Sessao ausente.", 401);
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    logWarn("auth_session_invalid_token", withRequestContext(req));
    return sessionErrorResponse("TOKEN_INVALID", "Sessao invalida ou expirada.", 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatar_url: true,
        role: true,
        account_status: true,
        organization_id: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            status: true,
            setup_completed_at: true,
            logo_url: true,
            settings: true,
          },
        },
      },
    });

    if (!user || user.organization_id !== payload.org) {
      logWarn("auth_session_user_org_mismatch", withRequestContext(req, { userId: payload.sub }));
      return sessionErrorResponse("UNAUTHORIZED", "Sessao invalida.", 401);
    }

    if (user.account_status !== "ACTIVE") {
      return sessionErrorResponse("FORBIDDEN", "Conta pendente de ativacao ou aprovacao.", 403);
    }

    let hasCpf = true;
    let athleteStatus: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED" | null = null;
    if (user.role === "ATHLETE") {
      const athleteProfile = await prisma.athleteProfile.findUnique({
        where: { user_id: user.id },
        select: { cpf: true, athlete_status: true },
      });
      hasCpf = Boolean(athleteProfile?.cpf);
      athleteStatus = athleteProfile?.athlete_status ?? null;
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          role: user.role,
          organization_id: user.organization_id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          organization: user.organization
            ? {
                id: user.organization.id,
                name: user.organization.name,
                slug: user.organization.slug,
                plan: user.organization.plan,
                status: user.organization.status,
                setup_completed_at: user.organization.setup_completed_at,
                logo_url: user.organization.logo_url,
                settings: sanitizeOrganizationSettings(user.organization.settings),
              }
            : null,
          profile: { hasCpf, athleteStatus },
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return apiError("INTERNAL_ERROR", "Nao foi possivel validar sessao no momento.", 503);
  }
}
