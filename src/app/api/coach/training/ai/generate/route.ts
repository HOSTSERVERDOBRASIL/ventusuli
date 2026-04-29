import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { generateAiTrainingPlan } from "@/lib/training-ai";
import { prisma } from "@/lib/prisma";
import { mapTrainingPlan } from "@/lib/training-serializers";
import { getAuthContext } from "@/lib/request-auth";

const generateSchema = z.object({
  athleteId: z.string().uuid(),
  planName: z.string().trim().min(3).max(120),
  cycleGoal: z.string().trim().min(3).max(160),
  objective: z.string().trim().max(240).optional().nullable(),
  focusModality: z.string().trim().max(80).optional().nullable(),
  startDate: z.string().datetime(),
  weeks: z.number().int().min(1).max(24).default(4),
  sessionsPerWeek: z.number().int().min(2).max(6).default(4),
  coachNotes: z.string().trim().max(1200).optional().nullable(),
});

function canUseCoachArea(role: string): boolean {
  return role === "COACH" || role === "ADMIN";
}

const planInclude = Prisma.validator<Prisma.TrainingPlanInclude>()({
  athlete: { select: { name: true } },
  coach: { select: { name: true } },
  weeks: {
    orderBy: { week_number: "asc" as const },
    include: {
      days: {
        orderBy: { scheduled_date: "asc" as const },
        include: {
          items: { orderBy: { sort_order: "asc" as const } },
          sessions: { include: { feedback: true } },
        },
      },
    },
  },
  ai_recommendations: {
    orderBy: { created_at: "desc" as const },
    take: 10,
  },
});

function toJsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const athlete = await prisma.user.findFirst({
    where: {
      id: parsed.data.athleteId,
      organization_id: auth.organizationId,
      role: "ATHLETE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      athlete_profile: {
        select: {
          id: true,
          primary_modality: true,
          sport_level: true,
          sport_goal: true,
          injury_history: true,
          available_equipment: true,
          weekly_availability: true,
          next_competition_date: true,
          medical_restrictions: true,
        },
      },
    },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta nao encontrado.", 404);

  const generated = generateAiTrainingPlan({
    athlete: {
      athleteId: athlete.id,
      athleteName: athlete.name,
      primaryModality: athlete.athlete_profile?.primary_modality ?? null,
      sportLevel: athlete.athlete_profile?.sport_level ?? null,
      sportGoal: athlete.athlete_profile?.sport_goal ?? null,
      injuryHistory: athlete.athlete_profile?.injury_history ?? null,
      availableEquipment: athlete.athlete_profile?.available_equipment ?? [],
      weeklyAvailability:
        athlete.athlete_profile?.weekly_availability &&
        typeof athlete.athlete_profile.weekly_availability === "object" &&
        !Array.isArray(athlete.athlete_profile.weekly_availability)
          ? (athlete.athlete_profile.weekly_availability as Record<string, unknown>)
          : null,
      nextCompetitionDate: athlete.athlete_profile?.next_competition_date ?? null,
      medicalRestrictions: athlete.athlete_profile?.medical_restrictions ?? null,
    },
    planName: parsed.data.planName,
    cycleGoal: parsed.data.cycleGoal,
    objective: parsed.data.objective ?? null,
    focusModality: parsed.data.focusModality ?? null,
    startDate: new Date(parsed.data.startDate),
    weeks: parsed.data.weeks,
    sessionsPerWeek: parsed.data.sessionsPerWeek,
    coachNotes: parsed.data.coachNotes ?? null,
  });

  const endDate = new Date(parsed.data.startDate);
  endDate.setDate(endDate.getDate() + parsed.data.weeks * 7 - 1);

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.trainingPlan.create({
      data: {
        organization_id: auth.organizationId,
        athlete_id: athlete.id,
        athlete_profile_id: athlete.athlete_profile?.id ?? null,
        coach_id: auth.userId,
        name: parsed.data.planName,
        cycle_goal: parsed.data.cycleGoal,
        objective: parsed.data.objective ?? athlete.athlete_profile?.sport_goal ?? null,
        focus_modality:
          parsed.data.focusModality ?? athlete.athlete_profile?.primary_modality ?? "Corrida",
        start_date: new Date(parsed.data.startDate),
        end_date: endDate,
        status: "DRAFT",
        ai_generated: true,
        notes: parsed.data.coachNotes ?? null,
        weeks: {
          create: generated.weeks.map((week) => ({
            week_number: week.weekNumber,
            focus: week.focus,
            days: {
              create: week.days.map((day) => ({
                scheduled_date: day.scheduledDate,
                title: day.title,
                objective: day.objective,
                is_rest_day: day.isRestDay,
                coach_notes: day.coachNotes ?? null,
                items: {
                  create: day.items.map((item, index) => ({
                    sort_order: index + 1,
                    exercise_name: item.exerciseName,
                    instructions: item.instructions ?? null,
                    intensity_label: item.intensityLabel ?? null,
                    duration_minutes: item.durationMinutes ?? null,
                    series: item.series ?? null,
                    repetitions: item.repetitions ?? null,
                    load_description: item.loadDescription ?? null,
                    distance_meters: item.distanceMeters ?? null,
                    pace_target: item.paceTarget ?? null,
                    heart_rate_target: item.heartRateTarget ?? null,
                    target_rpe: item.targetRpe ?? null,
                    notes: item.notes ?? null,
                  })),
                },
              })),
            },
          })),
        },
        ai_recommendations: {
          create: {
            organization_id: auth.organizationId,
            athlete_id: athlete.id,
            coach_id: auth.userId,
            recommendation_type: "INITIAL_PLAN",
            summary: generated.summary,
            rationale: generated.rationale,
            input_snapshot: toJsonSnapshot({
              athleteName: athlete.name,
              objective: parsed.data.objective,
              cycleGoal: parsed.data.cycleGoal,
              sessionsPerWeek: parsed.data.sessionsPerWeek,
              weeks: parsed.data.weeks,
            }),
            output_snapshot: toJsonSnapshot(generated),
            status: "PENDING",
          },
        },
      },
      include: {
        weeks: {
          include: {
            days: true,
          },
        },
      },
    });

    await tx.workoutSession.createMany({
      data: plan.weeks.flatMap((week) =>
        week.days.map((day) => ({
          organization_id: auth.organizationId,
          training_plan_id: plan.id,
          training_day_id: day.id,
          athlete_id: athlete.id,
          athlete_profile_id: athlete.athlete_profile?.id ?? null,
          coach_id: auth.userId,
          status: "PENDING" as const,
        })),
      ),
    });

    return tx.trainingPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: planInclude,
    });
  });

  return NextResponse.json({ data: mapTrainingPlan(created) }, { status: 201 });
}
