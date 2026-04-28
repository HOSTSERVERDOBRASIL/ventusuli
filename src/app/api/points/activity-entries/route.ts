import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  createPointActivityEntry,
  listPointActivities,
} from "@/lib/points/activityService";
import { getAuthContext } from "@/lib/request-auth";

const createSchema = z.object({
  activityId: z.string().min(1),
  points: z.number().int().positive(),
  note: z.string().trim().max(500).optional().nullable(),
  proofUrl: z.string().trim().url().optional().nullable(),
});

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

  try {
    const data = await createPointActivityEntry({
      organizationId: auth.organizationId,
      activityId: parsed.data.activityId,
      userId: auth.userId,
      points: parsed.data.points,
      source: "USER",
      note: parsed.data.note ?? null,
      proofUrl: parsed.data.proofUrl ?? null,
      createdBy: auth.userId,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel solicitar pontos.";
    return apiError("VALIDATION_ERROR", message, 400);
  }
}
