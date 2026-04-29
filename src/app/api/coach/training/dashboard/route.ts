import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";
import {
  TRAINING_LOAD_METHODOLOGY,
  buildWeeklyTrainingLoad,
  getCurrentAndPreviousLoadWeeks,
} from "@/lib/training-load";

function canUseCoachArea(role: string): boolean {
  return role === "COACH" || role === "ADMIN";
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUseCoachArea(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao coach.", 403);

  const [athletes, plans, sessions, recommendations] = await Promise.all([
    prisma.user.findMany({
      where: {
        organization_id: auth.organizationId,
        role: "ATHLETE",
      },
      select: { id: true, name: true, email: true },
    }),
    prisma.trainingPlan.findMany({
      where: {
        organization_id: auth.organizationId,
        ...(auth.role === "COACH" ? { coach_id: auth.userId } : {}),
      },
      select: { id: true, status: true },
    }),
    prisma.workoutSession.findMany({
      where: {
        organization_id: auth.organizationId,
        ...(auth.role === "COACH" ? { coach_id: auth.userId } : {}),
      },
      select: {
        id: true,
        status: true,
        perceived_effort: true,
        actual_duration_minutes: true,
        actual_distance_m: true,
        athlete_id: true,
        training_day: {
          select: {
            scheduled_date: true,
            title: true,
            items: {
              select: {
                duration_minutes: true,
                distance_meters: true,
                target_rpe: true,
              },
            },
          },
        },
        feedback: {
          select: {
            pain_level: true,
            actual_duration_minutes: true,
            actual_distance_m: true,
            perceived_effort: true,
          },
        },
        athlete: { select: { name: true, email: true } },
      },
    }),
    prisma.aIRecommendation.findMany({
      where: {
        organization_id: auth.organizationId,
        ...(auth.role === "COACH" ? { coach_id: auth.userId } : {}),
      },
      orderBy: { created_at: "desc" },
      take: 6,
      select: {
        id: true,
        recommendation_type: true,
        summary: true,
        rationale: true,
        status: true,
        created_at: true,
        reviewed_at: true,
      },
    }),
  ]);

  const priorityAthletes = athletes
    .map((athlete) => {
      const athleteSessions = sessions.filter((session) => session.athlete_id === athlete.id);
      const loadWeeks = buildWeeklyTrainingLoad(athleteSessions);
      const { currentWeek, previousWeek } = getCurrentAndPreviousLoadWeeks(loadWeeks);
      const completed = athleteSessions.filter((session) => session.status === "COMPLETED");
      const recentPainAlerts = athleteSessions.filter(
        (session) => (session.feedback?.pain_level ?? 0) >= 6,
      ).length;
      const pendingSessions = athleteSessions.filter((session) => session.status === "PENDING").length;
      const averageEffort =
        completed.length > 0
          ? Number(
              (
                completed.reduce((sum, session) => sum + (session.perceived_effort ?? 0), 0) /
                completed.length
              ).toFixed(1),
            )
          : null;
      const nextSession = athleteSessions
        .filter((session) => new Date(session.training_day.scheduled_date) >= new Date())
        .sort(
          (a, b) =>
            new Date(a.training_day.scheduled_date).getTime() -
            new Date(b.training_day.scheduled_date).getTime(),
        )[0];

      return {
        athleteId: athlete.id,
        athleteName: athlete.name,
        athleteEmail: athlete.email,
        pendingSessions,
        recentPainAlerts,
        averageEffort,
        nextSessionDate: nextSession?.training_day.scheduled_date.toISOString() ?? null,
        currentWeekLoad: currentWeek.totalLoad,
        previousWeekLoad: previousWeek.totalLoad,
        loadChangePercent: currentWeek.loadChangePercent,
        loadAlertLevel: currentWeek.alertLevel,
        loadAlertReason: currentWeek.alertReason,
      };
    })
    .sort((a, b) => {
      const riskRank = { HIGH: 3, ATTENTION: 2, OK: 1 };
      if (riskRank[b.loadAlertLevel] !== riskRank[a.loadAlertLevel]) {
        return riskRank[b.loadAlertLevel] - riskRank[a.loadAlertLevel];
      }
      if (b.recentPainAlerts !== a.recentPainAlerts) return b.recentPainAlerts - a.recentPainAlerts;
      return b.pendingSessions - a.pendingSessions;
    })
    .slice(0, 8);

  const allLoadWeeks = buildWeeklyTrainingLoad(sessions);
  const loadControl = getCurrentAndPreviousLoadWeeks(allLoadWeeks);

  return NextResponse.json({
    data: {
      metrics: {
        activeAthletes: athletes.length,
        activePlans: plans.filter((plan) => plan.status === "ACTIVE").length,
        pendingSessions: sessions.filter((session) => session.status === "PENDING").length,
        completedSessions: sessions.filter((session) => session.status === "COMPLETED").length,
        overloadRiskAthletes: priorityAthletes.filter(
          (athlete) =>
            athlete.recentPainAlerts > 0 ||
            (athlete.averageEffort ?? 0) >= 8 ||
            athlete.loadAlertLevel !== "OK",
        ).length,
        pendingRecommendations: recommendations.filter((item) => item.status === "PENDING").length,
        currentWeekLoad: loadControl.currentWeek.totalLoad,
      },
      priorityAthletes,
      recentRecommendations: recommendations.map((item) => ({
        id: item.id,
        recommendationType: item.recommendation_type,
        summary: item.summary,
        rationale: item.rationale,
        status: item.status,
        createdAt: item.created_at.toISOString(),
        reviewedAt: item.reviewed_at?.toISOString() ?? null,
      })),
      loadControl: {
        ...loadControl,
        methodology: TRAINING_LOAD_METHODOLOGY,
      },
    },
  });
}
