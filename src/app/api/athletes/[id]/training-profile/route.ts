import { NextRequest, NextResponse } from "next/server";
import { Prisma, SportLevel, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { mapAthleteTrainingProfile } from "@/lib/training-serializers";
import { getAuthContext } from "@/lib/request-auth";

const trainingProfileSchema = z.object({
  primaryModality: z.string().trim().max(80).optional().nullable(),
  sportLevel: z.nativeEnum(SportLevel).optional().nullable(),
  sportGoal: z.string().trim().max(160).optional().nullable(),
  injuryHistory: z.string().trim().max(1200).optional().nullable(),
  weeklyAvailability: z.record(z.any()).optional().nullable(),
  availableEquipment: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  restingHeartRate: z.number().int().min(0).max(260).optional().nullable(),
  thresholdPace: z.string().trim().max(60).optional().nullable(),
  maxLoadNotes: z.string().trim().max(240).optional().nullable(),
  nextCompetitionDate: z.string().datetime().optional().nullable(),
  medicalRestrictions: z.string().trim().max(1200).optional().nullable(),
  coachNotes: z.string().trim().max(1200).optional().nullable(),
});

function canManageAthletes(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.COACH;
}

function nullableJson(value: Record<string, unknown> | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonObject;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) {
    return apiError("FORBIDDEN", "Acesso restrito a equipe tecnica.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = trainingProfileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const athlete = await prisma.user.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      role: "ATHLETE",
    },
    select: { id: true },
  });
  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta nao encontrado.", 404);

  const updated = await prisma.athleteProfile.upsert({
    where: { user_id: athlete.id },
    update: {
      ...(parsed.data.primaryModality !== undefined
        ? { primary_modality: parsed.data.primaryModality }
        : {}),
      ...(parsed.data.sportLevel !== undefined ? { sport_level: parsed.data.sportLevel } : {}),
      ...(parsed.data.sportGoal !== undefined ? { sport_goal: parsed.data.sportGoal } : {}),
      ...(parsed.data.injuryHistory !== undefined
        ? { injury_history: parsed.data.injuryHistory }
        : {}),
      ...(parsed.data.weeklyAvailability !== undefined
        ? { weekly_availability: nullableJson(parsed.data.weeklyAvailability) }
        : {}),
      ...(parsed.data.availableEquipment !== undefined
        ? { available_equipment: parsed.data.availableEquipment }
        : {}),
      ...(parsed.data.restingHeartRate !== undefined
        ? { resting_heart_rate: parsed.data.restingHeartRate }
        : {}),
      ...(parsed.data.thresholdPace !== undefined
        ? { threshold_pace: parsed.data.thresholdPace }
        : {}),
      ...(parsed.data.maxLoadNotes !== undefined
        ? { max_load_notes: parsed.data.maxLoadNotes }
        : {}),
      ...(parsed.data.nextCompetitionDate !== undefined
        ? {
            next_competition_date: parsed.data.nextCompetitionDate
              ? new Date(parsed.data.nextCompetitionDate)
              : null,
          }
        : {}),
      ...(parsed.data.medicalRestrictions !== undefined
        ? { medical_restrictions: parsed.data.medicalRestrictions }
        : {}),
      ...(parsed.data.coachNotes !== undefined ? { coach_notes: parsed.data.coachNotes } : {}),
    },
    create: {
      user_id: athlete.id,
      organization_id: auth.organizationId,
      primary_modality: parsed.data.primaryModality ?? null,
      sport_level: parsed.data.sportLevel ?? null,
      sport_goal: parsed.data.sportGoal ?? null,
      injury_history: parsed.data.injuryHistory ?? null,
      weekly_availability: nullableJson(parsed.data.weeklyAvailability ?? null),
      available_equipment: parsed.data.availableEquipment ?? [],
      resting_heart_rate: parsed.data.restingHeartRate ?? null,
      threshold_pace: parsed.data.thresholdPace ?? null,
      max_load_notes: parsed.data.maxLoadNotes ?? null,
      next_competition_date: parsed.data.nextCompetitionDate
        ? new Date(parsed.data.nextCompetitionDate)
        : null,
      medical_restrictions: parsed.data.medicalRestrictions ?? null,
      coach_notes: parsed.data.coachNotes ?? null,
    },
  });

  return NextResponse.json({ data: mapAthleteTrainingProfile(updated) });
}
