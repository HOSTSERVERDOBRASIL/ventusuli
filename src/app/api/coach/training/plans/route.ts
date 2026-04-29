import { NextRequest, NextResponse } from "next/server";
import { Prisma, TrainingPlanStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { mapTrainingPlan } from "@/lib/training-serializers";
import { getAuthContext } from "@/lib/request-auth";

const itemSchema = z.object({
  exerciseId: z.string().cuid().optional().nullable(),
  exerciseName: z.string().trim().min(2).max(120),
  instructions: z.string().trim().max(1200).optional().nullable(),
  intensityLabel: z.string().trim().max(60).optional().nullable(),
  durationMinutes: z.number().int().min(0).max(600).optional().nullable(),
  series: z.number().int().min(0).max(20).optional().nullable(),
  repetitions: z.string().trim().max(60).optional().nullable(),
  loadDescription: z.string().trim().max(160).optional().nullable(),
  distanceMeters: z.number().int().min(0).max(200000).optional().nullable(),
  paceTarget: z.string().trim().max(60).optional().nullable(),
  heartRateTarget: z.string().trim().max(60).optional().nullable(),
  targetRpe: z.number().int().min(0).max(10).optional().nullable(),
  notes: z.string().trim().max(400).optional().nullable(),
});

const createPlanSchema = z.object({
  athleteId: z.string().uuid(),
  name: z.string().trim().min(3).max(120),
  cycleGoal: z.string().trim().min(3).max(160),
  objective: z.string().trim().max(240).optional().nullable(),
  focusModality: z.string().trim().max(80).optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().trim().max(1200).optional().nullable(),
  status: z.nativeEnum(TrainingPlanStatus).default(TrainingPlanStatus.DRAFT),
  weeks: z.array(
    z.object({
      weekNumber: z.number().int().min(1).max(52),
      focus: z.string().trim().max(160).optional().nullable(),
      notes: z.string().trim().max(600).optional().nullable(),
      days: z.array(
        z.object({
          scheduledDate: z.string().datetime(),
          title: z.string().trim().min(2).max(120),
          objective: z.string().trim().max(240).optional().nullable(),
          isRestDay: z.boolean().default(false),
          coachNotes: z.string().trim().max(600).optional().nullable(),
          items: z.array(itemSchema).default([]),
        }),
      ).min(1),
    }),
  ).min(1),
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
          sessions: {
            include: { feedback: true },
          },
        },
      },
    },
  },
  ai_recommendations: {
    orderBy: { created_at: "desc" as const },
    take: 6,
  },
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUseCoachArea(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao coach.", 403);

  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim();
  const status = req.nextUrl.searchParams.get("status");

  const plans = await prisma.trainingPlan.findMany({
    where: {
      organization_id: auth.organizationId,
      ...(auth.role === "COACH" ? { coach_id: auth.userId } : {}),
      ...(athleteId ? { athlete_id: athleteId } : {}),
      ...(status && status !== "ALL" ? { status: status as TrainingPlanStatus } : {}),
    },
    include: planInclude,
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
  });

  return NextResponse.json({ data: plans.map(mapTrainingPlan) });
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

  const parsed = createPlanSchema.safeParse(body);
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
      athlete_profile: { select: { id: true } },
    },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta nao encontrado.", 404);

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.trainingPlan.create({
      data: {
        organization_id: auth.organizationId,
        athlete_id: athlete.id,
        athlete_profile_id: athlete.athlete_profile?.id ?? null,
        coach_id: auth.userId,
        name: parsed.data.name,
        cycle_goal: parsed.data.cycleGoal,
        objective: parsed.data.objective ?? null,
        focus_modality: parsed.data.focusModality ?? null,
        start_date: new Date(parsed.data.startDate),
        end_date: new Date(parsed.data.endDate),
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
        weeks: {
          create: parsed.data.weeks.map((week) => ({
            week_number: week.weekNumber,
            focus: week.focus ?? null,
            notes: week.notes ?? null,
            days: {
              create: week.days.map((day) => ({
                scheduled_date: new Date(day.scheduledDate),
                title: day.title,
                objective: day.objective ?? null,
                is_rest_day: day.isRestDay,
                coach_notes: day.coachNotes ?? null,
                items: {
                  create: day.items.map((item, index) => ({
                    exercise_id: item.exerciseId ?? null,
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
