import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { setAccessCookie, setRefreshCookie } from "@/lib/cookies";
import { activateAdminSchema } from "@/lib/validations/auth";
import { activateAdminInvite } from "@/lib/admin-invite";
import { logError, logInfo, logWarn, withRequestContext } from "@/lib/logger";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logWarn("auth_accept_admin_invite_invalid_body", withRequestContext(req));
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = activateAdminSchema.safeParse(body);
  if (!parsed.success) {
    logWarn("auth_accept_admin_invite_validation_failed", withRequestContext(req));
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  let activated: Awaited<ReturnType<typeof activateAdminInvite>>;
  try {
    activated = await activateAdminInvite(parsed.data);
  } catch (error) {
    logError(
      "auth_accept_admin_invite_unexpected_error",
      withRequestContext(req, { error: error instanceof Error ? error.message : String(error) }),
    );
    return apiError("INTERNAL_ERROR", "Nao foi possivel ativar convite no momento.", 500);
  }

  if ("error" in activated) {
    logWarn("auth_accept_admin_invite_failed", withRequestContext(req, { code: activated.error.code }));
    return apiError(activated.error.code, activated.error.message, activated.error.status);
  }

  const response = NextResponse.json(
    {
      user: {
        id: activated.data.user.id,
        name: activated.data.user.name,
        email: activated.data.user.email,
        role: activated.data.user.role,
      },
      organization: activated.data.organization,
      accessToken: activated.data.accessToken,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );

  setAccessCookie(response, activated.data.accessToken);
  setRefreshCookie(response, activated.data.refreshToken);
  logInfo(
    "auth_accept_admin_invite_success",
    withRequestContext(req, {
      userId: activated.data.user.id,
      organizationId: activated.data.user.organization_id,
    }),
  );
  return response;
}
