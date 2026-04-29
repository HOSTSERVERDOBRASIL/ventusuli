import { NextRequest, NextResponse } from "next/server";
import { SportLevel } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const createExerciseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  modality: z.string().trim().min(2).max(80),
  stimulusType: z.string().trim().max(80).optional(),
  intensityLabel: z.string().trim().max(60).optional(),
  durationMinutes: z.number().int().min(0).max(600).optional(),
  series: z.number().int().min(0).max(20).optional(),
  repetitions: z.string().trim().max(60).optional(),
  loadDescription: z.string().trim().max(160).optional(),
  distanceMeters: z.number().int().min(0).max(200000).optional(),
  instructions: z.string().trim().max(1200).optional(),
  contraindications: z.string().trim().max(600).optional(),
  levelRecommended: z.nativeEnum(SportLevel).optional().nullable(),
});

function canUseCoachArea(role: string): boolean {
  return role === "COACH" || role === "ADMIN";
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUseCoachArea(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao coach.", 403);

  const modality = req.nextUrl.searchParams.get("modality")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const exercises = await prisma.exercise.findMany({
    where: {
      organization_id: auth.organizationId,
      active: true,
      ...(modality ? { modality: { contains: modality, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { modality: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ modality: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    data: exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      modality: exercise.modality,
      stimulusType: exercise.stimulus_type,
      intensityLabel: exercise.intensity_label,
      durationMinutes: exercise.duration_minutes,
      series: exercise.series,
      repetitions: exercise.repetitions,
      loadDescription: exercise.load_description,
      distanceMeters: exercise.distance_meters,
      instructions: exercise.instructions,
      contraindications: exercise.contraindications,
      levelRecommended: exercise.level_recommended,
      active: exercise.active,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUseCoachArea(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao coach.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createExerciseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const created = await prisma.exercise.create({
    data: {
      organization_id: auth.organizationId,
      created_by: auth.userId,
      name: parsed.data.name,
      modality: parsed.data.modality,
      stimulus_type: parsed.data.stimulusType ?? null,
      intensity_label: parsed.data.intensityLabel ?? null,
      duration_minutes: parsed.data.durationMinutes ?? null,
      series: parsed.data.series ?? null,
      repetitions: parsed.data.repetitions ?? null,
      load_description: parsed.data.loadDescription ?? null,
      distance_meters: parsed.data.distanceMeters ?? null,
      instructions: parsed.data.instructions ?? null,
      contraindications: parsed.data.contraindications ?? null,
      level_recommended: parsed.data.levelRecommended ?? null,
    },
  });

  return NextResponse.json({ data: { id: created.id, name: created.name } }, { status: 201 });
}
