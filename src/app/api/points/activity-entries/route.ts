import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { listPointActivities } from "@/lib/points/activityService";
import { getAuthContext } from "@/lib/request-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const data = await listPointActivities({
    organizationId: auth.organizationId,
    active: true,
  });

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  return apiError(
    "FORBIDDEN",
    "Pontos sao gerados automaticamente por eventos internos ou lancados pela administracao.",
    403,
  );
}
