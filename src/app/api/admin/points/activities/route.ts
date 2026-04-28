import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { createPointActivity, listPointActivities } from "@/lib/points/activityService";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  suggestedPoints: z.number().int().min(0).default(0),
  activityDate: z.string().datetime(),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const activeParam = req.nextUrl.searchParams.get("active");
  const active =
    activeParam === "true" ? true : activeParam === "false" ? false : undefined;

  const data = await listPointActivities({ organizationId: auth.organizationId, active });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const data = await createPointActivity({
    organizationId: auth.organizationId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    suggestedPoints: parsed.data.suggestedPoints,
    activityDate: new Date(parsed.data.activityDate),
    createdBy: auth.userId,
  });

  return NextResponse.json({ data }, { status: 201 });
}
