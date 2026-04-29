import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { mapAthleteTrainingProfile, mapTrainingPlan, mapTrainingSession } from "@/lib/training-serializers";
import { getAuthContext } from "@/lib/request-auth";
import {
  TRAINING_LOAD_METHODOLOGY,
  buildWeeklyTrainingLoad,
  getCurrentAndPreviousLoadWeeks,
} from "@/lib/training-load";

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const athlete = await prisma.user.findFirst({
    where: {
      id: auth.userId,
      organization_id: auth.organizationId,
      role: "ATHLETE",
    },
    select: {
      id: true,
      name: true,
      athlete_profile: {
        select: {
          primary_modality: true,
          sport_level: true,
          sport_goal: true,
          injury_history: true,
          weekly_availability: true,
          available_equipment: true,
          resting_heart_rate: true,
          threshold_pace: true,
          max_load_notes: true,
          next_competition_date: true,
          medical_restrictions: true,
          coach_notes: true,
        },
      },
    },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta nao encontrado.", 404);

  const currentPlan = await prisma.trainingPlan.findFirst({
    where: {
      organization_id: auth.organizationId,
      athlete_id: auth.userId,
      status: "ACTIVE",
    },
    include: {
      athlete: { select: { name: true } },
      coach: { select: { name: true } },
      weeks: {
        orderBy: { week_number: "asc" },
        include: {
          days: {
            orderBy: { scheduled_date: "asc" },
            include: {
              items: { orderBy: { sort_order: "asc" } },
              sessions: {
                where: { athlete_id: auth.userId },
                include: { feedback: true },
              },
            },
          },
        },
      },
      ai_recommendations: {
        orderBy: { created_at: "desc" },
        take: 5,
      },
    },
    orderBy: [{ status: "asc" }, { start_date: "desc" }],
  });

  const sessions = await prisma.workoutSession.findMany({
    where: {
      organization_id: auth.organizationId,
      athlete_id: auth.userId,
      training_plan: { status: "ACTIVE" },
    },
    include: {
      training_day: {
        include: {
          items: { orderBy: { sort_order: "asc" } },
        },
      },
      feedback: true,
    },
    orderBy: { training_day: { scheduled_date: "asc" } },
  });

  const now = new Date();
  const todaySession =
    sessions.find((session) => {
      const date = new Date(session.training_day.scheduled_date);
      return date.toDateString() === now.toDateString();
    }) ?? null;
  const nextSessions = sessions
    .filter((session) => new Date(session.training_day.scheduled_date) >= now)
    .slice(0, 6)
    .map(mapTrainingSession);

  const completedSessions = sessions.filter((session) => session.status === "COMPLETED");
  const averageEffort =
    completedSessions.length > 0
      ? Number(
          (
            completedSessions.reduce((sum, session) => sum + (session.perceived_effort ?? 0), 0) /
            completedSessions.length
          ).toFixed(1),
        )
      : null;
  const consistencyPercent =
    sessions.length > 0
      ? Math.round((completedSessions.length / sessions.length) * 100)
      : 0;
  const loadWeeks = buildWeeklyTrainingLoad(sessions);
  const loadControl = getCurrentAndPreviousLoadWeeks(loadWeeks);

  return NextResponse.json({
    data: {
      athleteId: athlete.id,
      athleteName: athlete.name,
      profile: mapAthleteTrainingProfile(athlete.athlete_profile),
      currentPlan: currentPlan ? mapTrainingPlan(currentPlan) : null,
      todaySession: todaySession ? mapTrainingSession(todaySession) : null,
      nextSessions,
      recentRecommendations:
        currentPlan?.ai_recommendations.map((item) => ({
          id: item.id,
          recommendationType: item.recommendation_type,
          summary: item.summary,
          rationale: item.rationale,
          status: item.status,
          createdAt: item.created_at.toISOString(),
          reviewedAt: item.reviewed_at?.toISOString() ?? null,
        })) ?? [],
      metrics: {
        completedSessions: completedSessions.length,
        pendingSessions: sessions.filter((session) => session.status === "PENDING").length,
        averageEffort,
        consistencyPercent,
      },
      loadControl: {
        ...loadControl,
        methodology: TRAINING_LOAD_METHODOLOGY,
      },
    },
  });
}
