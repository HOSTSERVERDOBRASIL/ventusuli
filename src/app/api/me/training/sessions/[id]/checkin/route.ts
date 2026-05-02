import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const checkInSchema = z.object({
  action: z.enum(["START", "SAFE_PING", "CHECK_OUT"]),
  note: z.string().trim().max(600).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

function appendNote(
  current: string | null,
  action: "START" | "SAFE_PING" | "CHECK_OUT",
  note?: string | null,
  latitude?: number | null,
  longitude?: number | null,
): string {
  const timestamp = new Date().toLocaleString("pt-BR");
  const location =
    typeof latitude === "number" && typeof longitude === "number"
      ? ` | local ${latitude.toFixed(5)},${longitude.toFixed(5)}`
      : "";
  const label =
    action === "START"
      ? "check-in"
      : action === "CHECK_OUT"
        ? "check-out seguro"
        : "ponto seguro";
  const entry = `[${timestamp}] ${label}${location}${note ? ` | ${note}` : ""}`;
  return [current, entry].filter(Boolean).join("\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const session = await prisma.workoutSession.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      athlete_id: auth.userId,
      training_plan: { status: "ACTIVE" },
    },
    select: {
      id: true,
      status: true,
      started_at: true,
      completed_at: true,
      athlete_notes: true,
    },
  });

  if (!session) return apiError("USER_NOT_FOUND", "Sessao de treino nao encontrada.", 404);

  const data = parsed.data;
  const notes = appendNote(
    session.athlete_notes,
    data.action,
    data.note,
    data.latitude,
    data.longitude,
  );

  const updated = await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      athlete_notes: notes,
      ...(data.action === "START" && !session.started_at ? { started_at: new Date() } : {}),
      ...(data.action === "CHECK_OUT"
        ? {
            completed_at: session.completed_at ?? new Date(),
            status: session.status === "PENDING" ? "PARTIAL" : session.status,
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      started_at: true,
      completed_at: true,
      athlete_notes: true,
    },
  });

  return NextResponse.json({
    data: {
      sessionId: updated.id,
      status: updated.status,
      startedAt: updated.started_at?.toISOString() ?? null,
      completedAt: updated.completed_at?.toISOString() ?? null,
      saved: true,
    },
  });
}
