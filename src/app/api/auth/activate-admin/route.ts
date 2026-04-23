import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { setAccessCookie, setRefreshCookie } from "@/lib/cookies";
import { activateAdminSchema } from "@/lib/validations/auth";
import { activateAdminInvite } from "@/lib/admin-invite";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = activateAdminSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const activated = await activateAdminInvite(parsed.data);
  if ("error" in activated) {
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

  return response;
}
