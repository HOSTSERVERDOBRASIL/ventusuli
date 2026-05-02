import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import {
  getActivitySummary,
  getDistanceDistribution,
  getEvolutionSeries,
  getGroupRanking,
  getPersonalRecords,
  getRecentActivities,
  hasActivities,
  hasStravaConnection,
  type RankingPeriod,
} from "@/lib/dashboard/activity-analytics";
import {
  buildAchievements,
  buildYearWarning,
  formatDurationCompact,
  formatDistanceKm,
  formatPace,
  monthlyDeltaLabel,
} from "@/lib/dashboard/calculations";
import { buildUserGamificationSnapshot } from "@/lib/gamification/snapshot";
import { getAuthContext } from "@/lib/request-auth";
import type { DashboardData } from "@/services/types";

export const revalidate = 60;

export interface DashboardAthleteResponse {
  metrics: {
    provasConfirmadas: number;
    kmNoAno: number | null;
    provasConcluidas: number;
    rankingNoGrupo: number | null;
    consistencia: number | null;
  };
  proximasProvas: Array<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    event_date: Date;
    status: string;
    image_url: string | null;
    distances: Array<{
      id: string;
      label: string;
      distance_km: number;
      price_cents: number;
      max_slots: number | null;
      registered_count: number;
    }>;
    minhaInscricao: {
      status: "INTERESTED" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";
      distance_id: string;
    } | null;
  }>;
  minhasInscricoes: Array<{
    id: string;
    status: "INTERESTED" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";
    registered_at: Date;
    event: { name: string };
    distance: { label: string };
    payment: { status: PaymentStatus } | null;
  }>;
  financeiro: {
    totalGastoAno: number;
    pendente: number;
    proximaCobranca: {
      id: string;
      amount_cents: number;
      expires_at: Date | null;
    } | null;
  };
  calendario: Array<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    event_date: Date;
    status: string;
  }>;
  experience?: DashboardData["experience"];
  experienceSource?: DashboardData["experienceSource"];
  dataWarnings?: string[];
}

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CANCELLED";
type NumericLike = number | bigint | { toString(): string };
type RegistrationApiStatus = "INTERESTED" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";

function parseRankingPeriod(value: string | null): RankingPeriod {
  if (value === "30d" || value === "90d" || value === "year") return value;
  return "90d";
}

function getYearBounds(now: Date) {
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  return { start, end };
}

async function getTotalGastoAno(
  userId: string,
  orgId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ total_cents: NumericLike | null }>>`
    SELECT COALESCE(SUM(p.amount_cents), 0) AS total_cents
    FROM "public"."payments" p
    INNER JOIN "public"."registrations" r ON r.id = p.registration_id
    WHERE r.user_id = ${userId}
      AND p.organization_id = ${orgId}
      AND p.status = 'PAID'
      AND p.created_at >= ${start}
      AND p.created_at < ${end}
  `;
  const raw = rows[0]?.total_cents ?? 0;
  return typeof raw === "number" ? raw : Number(raw);
}

async function getPendente(userId: string, orgId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ total_cents: NumericLike | null }>>`
    SELECT COALESCE(SUM(p.amount_cents), 0) AS total_cents
    FROM "public"."payments" p
    INNER JOIN "public"."registrations" r ON r.id = p.registration_id
    WHERE r.user_id = ${userId}
      AND p.organization_id = ${orgId}
      AND p.status = 'PENDING'
  `;
  const raw = rows[0]?.total_cents ?? 0;
  return typeof raw === "number" ? raw : Number(raw);
}

async function getProximaCobranca(
  userId: string,
  orgId: string,
): Promise<DashboardAthleteResponse["financeiro"]["proximaCobranca"]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; amount_cents: number; expires_at: Date | null }>
  >`
    SELECT p.id, p.amount_cents, p.expires_at
    FROM "public"."payments" p
    INNER JOIN "public"."registrations" r ON r.id = p.registration_id
    WHERE r.user_id = ${userId}
      AND p.organization_id = ${orgId}
      AND p.status = 'PENDING'
    ORDER BY p.expires_at ASC NULLS LAST
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function buildEmptyExperience(
  athleteName: string,
  gamification: NonNullable<DashboardData["experience"]>["gamification"],
): NonNullable<DashboardData["experience"]> {
  return {
    greeting: {
      headline: `Bora correr, ${athleteName.split(" ")[0]}!`,
      subtitle: "Conecte o Strava ou lance um treino manual para liberar os indicadores reais.",
    },
    financeBreakdown: [],
    evolutionSeries: [],
    highlights: [],
    distanceDistribution: [],
    achievements: [],
    sportsMetrics: [],
    personalRecords: [],
    recentActivities: [],
    groupRanking: {
      updatedAt: new Date().toISOString(),
      totalAthletes: 0,
      user: {
        name: athleteName,
        position: 0,
        points: 0,
        change: 0,
      },
      leaderboard: [],
    },
    communityPreview: {
      tabs: ["Feed", "Treinos", "Eventos", "Resultados"],
      posts: [],
      source: "EMPTY",
      message: "Sem dados da comunidade no momento.",
    },
    gamification,
  };
}

function buildActivityExperience(params: {
  athleteName: string;
  activitySource: "STRAVA" | "MANUAL";
  totalGastoAno: number;
  pendente: number;
  summary: Awaited<ReturnType<typeof getActivitySummary>>;
  evolutionSeries: Awaited<ReturnType<typeof getEvolutionSeries>>;
  distanceDistribution: Awaited<ReturnType<typeof getDistanceDistribution>>;
  personalRecords: Awaited<ReturnType<typeof getPersonalRecords>>;
  recentActivities: Awaited<ReturnType<typeof getRecentActivities>>;
  ranking: Awaited<ReturnType<typeof getGroupRanking>>;
  gamification: NonNullable<DashboardData["experience"]>["gamification"];
}): NonNullable<DashboardData["experience"]> {
  const {
    athleteName,
    activitySource,
    totalGastoAno,
    pendente,
    summary,
    evolutionSeries,
    distanceDistribution,
    personalRecords,
    recentActivities,
    ranking,
    gamification,
  } = params;

  const totalFinanceiro = totalGastoAno + pendente;
  const paidShare = totalFinanceiro > 0 ? Math.round((totalGastoAno / totalFinanceiro) * 100) : 0;
  const pendingShare = Math.max(0, 100 - paidShare);

  const monthlyCurrent = summary.volume30dKm;
  const monthlyPrevious = summary.previous30dKm;
  const monthlyTrend = monthlyDeltaLabel(monthlyCurrent, monthlyPrevious);
  const trainingCountTrend = monthlyDeltaLabel(
    summary.activityCount30d,
    summary.previousActivityCount30d,
  );
  const durationTrend = monthlyDeltaLabel(
    summary.movingTime30dSeconds,
    summary.previousMovingTime30dSeconds,
  );
  const currentPace =
    summary.volume30dKm > 0 && summary.movingTime30dSeconds > 0
      ? summary.movingTime30dSeconds / summary.volume30dKm
      : null;
  const previousPace =
    summary.previous30dKm > 0 && summary.previousMovingTime30dSeconds > 0
      ? summary.previousMovingTime30dSeconds / summary.previous30dKm
      : null;
  const paceDelta =
    currentPace !== null && previousPace !== null && previousPace > 0
      ? ((currentPace - previousPace) / previousPace) * 100
      : 0;
  const paceTrend = Math.abs(paceDelta) < 0.5 ? "stable" : paceDelta < 0 ? "up" : "down";

  const consistencyTrend = monthlyDeltaLabel(summary.consistencyPercent, 50);

  const best5k = personalRecords.find((item) => item.id === "best5k");
  const paceTextToSeconds = (value: string): number | null => {
    const raw = value.replace("/km", "");
    const [minPart, secPart] = raw.split(":");
    if (!minPart || !secPart) return null;
    const minutes = Number(minPart);
    const seconds = Number(secPart);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return minutes * 60 + seconds;
  };

  const achievements = buildAchievements(summary, best5k ? paceTextToSeconds(best5k.value) : null);

  return {
    greeting: {
      headline: `Bora correr, ${athleteName.split(" ")[0]}!`,
      subtitle:
        activitySource === "STRAVA"
          ? "Indicadores baseados em atividades sincronizadas do Strava."
          : "Indicadores baseados nos treinos lançados manualmente.",
    },
    financeBreakdown: [
      { name: "Pago", value: paidShare, color: "#22d3ee" },
      { name: "Pendente", value: pendingShare, color: "#F5A623" },
    ],
    evolutionSeries,
    highlights: [
      { id: "distance", label: "KM no ano", value: formatDistanceKm(summary.kmNoAno) },
      {
        id: "consistency",
        label: "Consistência semanal",
        value: `${Math.round(summary.consistencyPercent)}%`,
      },
      { id: "best5k", label: "Melhor pace 5K", value: best5k?.value ?? "Sem dado" },
      {
        id: "podium",
        label: "Posição no grupo",
        value: ranking.currentUser ? `#${ranking.currentUser.position}` : "Sem ranking",
      },
    ],
    distanceDistribution,
    achievements,
    sportsMetrics: [
      {
        id: "training-30d",
        label: "Treinos 30 dias",
        value: String(summary.activityCount30d),
        delta: trainingCountTrend.delta,
        trend: trainingCountTrend.trend,
      },
      {
        id: "volume-30d",
        label: "Volume 30 dias",
        value: formatDistanceKm(summary.volume30dKm),
        delta: monthlyTrend.delta,
        trend: monthlyTrend.trend,
      },
      {
        id: "duration-30d",
        label: "Tempo em treino",
        value: formatDurationCompact(summary.movingTime30dSeconds),
        delta: durationTrend.delta,
        trend: durationTrend.trend,
      },
      {
        id: "pace-30d",
        label: "Pace médio",
        value: currentPace !== null ? formatPace(currentPace) : "Sem dado",
        delta:
          currentPace !== null && previousPace !== null
            ? `${paceDelta > 0 ? "+" : ""}${Math.round(paceDelta)}%`
            : "0%",
        trend: paceTrend,
      },
      {
        id: "km-year",
        label: "KM no ano",
        value: formatDistanceKm(summary.kmNoAno),
        delta: `${summary.activityCountInYear} atividades`,
        trend: "stable",
      },
      {
        id: "consistency",
        label: "Consistência semanal",
        value: `${Math.round(summary.consistencyPercent)}%`,
        delta: consistencyTrend.delta,
        trend: consistencyTrend.trend,
      },
      {
        id: "active-weeks",
        label: "Semanas ativas",
        value: String(summary.activeWeeksInYear),
        delta: `${ranking.totalAthletes} atletas no ranking`,
        trend: "stable",
      },
    ],
    personalRecords,
    recentActivities,
    groupRanking: {
      updatedAt: new Date().toISOString(),
      totalAthletes: ranking.totalAthletes,
      user: {
        name: athleteName,
        position: ranking.currentUser?.position ?? 0,
        points: ranking.currentUser?.points ?? 0,
        change: 0,
      },
      leaderboard: ranking.leaderboard.map((item) => ({
        id: `rk-${item.id}`,
        name: item.name,
        points: item.points,
        position: item.position,
      })),
    },
    communityPreview: {
      tabs: ["Feed", "Treinos", "Eventos", "Resultados"],
      posts: [],
      source: "EMPTY",
      message: "Comunidade sem publicações para sua organização no momento.",
    },
    gamification,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  const canAccessAthleteDashboard = auth.roles.some((role) => {
    const value = String(role);
    return value === "ATHLETE" || value === "PREMIUM_ATHLETE";
  });
  if (!canAccessAthleteDashboard) {
    return apiError("FORBIDDEN", "Apenas atletas podem acessar o dashboard de evolução.", 403);
  }

  try {
    const now = new Date();
    const rankingPeriod = parseRankingPeriod(req.nextUrl.searchParams.get("period"));
    const { start, end } = getYearBounds(now);
    const calendarEnd = new Date(now);
    calendarEnd.setMonth(calendarEnd.getMonth() + 3);

    const [
      athleteUser,
      provasConfirmadas,
      provasConcluidas,
      proximasProvasRaw,
      minhasInscricoes,
      totalGastoAno,
      pendente,
      proximaCobranca,
      calendario,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, name: true },
      }),
      prisma.registration.count({
        where: {
          user_id: auth.userId,
          organization_id: auth.orgId,
          status: "CONFIRMED",
        },
      }),
      prisma.registration.count({
        where: {
          user_id: auth.userId,
          organization_id: auth.orgId,
          status: "CONFIRMED",
          event: { event_date: { lt: now } },
        },
      }),
      prisma.event.findMany({
        where: {
          organization_id: auth.orgId,
          status: "PUBLISHED",
          event_date: { gt: now },
        },
        orderBy: { event_date: "asc" },
        take: 4,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          event_date: true,
          status: true,
          image_url: true,
          distances: {
            orderBy: { distance_km: "asc" },
            select: {
              id: true,
              label: true,
              distance_km: true,
              price_cents: true,
              max_slots: true,
              registered_count: true,
            },
          },
          registrations: {
            where: { user_id: auth.userId },
            take: 1,
            select: { status: true, distance_id: true },
          },
        },
      }),
      prisma.registration.findMany({
        where: {
          user_id: auth.userId,
          organization_id: auth.orgId,
        },
        orderBy: { registered_at: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          registered_at: true,
          event: { select: { name: true } },
          distance: { select: { label: true } },
          payment: { select: { status: true } },
        },
      }),
      getTotalGastoAno(auth.userId, auth.orgId, start, end),
      getPendente(auth.userId, auth.orgId),
      getProximaCobranca(auth.userId, auth.orgId),
      prisma.event.findMany({
        where: {
          organization_id: auth.orgId,
          event_date: { gte: now, lt: calendarEnd },
        },
        orderBy: { event_date: "asc" },
        take: 100,
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          event_date: true,
          status: true,
        },
      }),
    ]);

    const proximasProvasSource = proximasProvasRaw as Array<{
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      event_date: Date;
      status: string;
      image_url: string | null;
      distances: Array<{
        id: string;
        label: string;
        distance_km: NumericLike;
        price_cents: number;
        max_slots: number | null;
        registered_count: number;
      }>;
      registrations: Array<{ status: string; distance_id: string }>;
    }>;

    const proximasProvas: DashboardAthleteResponse["proximasProvas"] = proximasProvasSource.map(
      (event) => ({
        id: event.id,
        name: event.name,
        city: event.city,
        state: event.state,
        event_date: event.event_date,
        status: event.status,
        image_url: event.image_url,
        distances: event.distances.map((distance) => ({
          ...distance,
          distance_km:
            typeof distance.distance_km === "number"
              ? distance.distance_km
              : Number(distance.distance_km),
        })),
        minhaInscricao: event.registrations[0]
          ? {
              status: event.registrations[0].status as RegistrationApiStatus,
              distance_id: event.registrations[0].distance_id,
            }
          : null,
      }),
    );

    const minhasInscricoesSource = minhasInscricoes as Array<{
      id: string;
      status: string;
      registered_at: Date;
      event: { name: string };
      distance: { label: string };
      payment: { status: string } | null;
    }>;

    const minhasInscricoesNormalized: DashboardAthleteResponse["minhasInscricoes"] =
      minhasInscricoesSource.map((item) => ({
        id: item.id,
        status: item.status as RegistrationApiStatus,
        registered_at: item.registered_at,
        event: item.event,
        distance: item.distance,
        payment: item.payment ? { status: item.payment.status as PaymentStatus } : null,
      }));

    const athleteName = athleteUser?.name ?? "Atleta";
    const gamification = await buildUserGamificationSnapshot(prisma, auth.userId, auth.orgId, now);

    const [connectedToStrava, activitiesAvailable] = await Promise.all([
      hasStravaConnection(prisma, auth.userId, auth.orgId),
      hasActivities(prisma, auth.userId, auth.orgId),
    ]);

    let experience: NonNullable<DashboardData["experience"]>;
    let experienceSource: DashboardData["experienceSource"] = "EMPTY";
    const warnings: string[] = [];

    const mainWarning = buildYearWarning(connectedToStrava, activitiesAvailable);
    if (mainWarning) warnings.push(mainWarning);
    if (activitiesAvailable && !connectedToStrava) {
      warnings.push(
        "Você está usando lançamentos manuais. Eles alimentam sua evolução; ranking e pontos oficiais podem exigir validação da assessoria.",
      );
    }

    let metricsSnapshot: DashboardAthleteResponse["metrics"] = {
      provasConfirmadas,
      kmNoAno: null,
      provasConcluidas,
      rankingNoGrupo: null,
      consistencia: null,
    };

    if (activitiesAvailable) {
      const [
        summary,
        evolutionSeries,
        distanceDistribution,
        personalRecords,
        recentActivities,
        ranking,
      ] = await Promise.all([
        getActivitySummary(prisma, auth.userId, auth.orgId, now),
        getEvolutionSeries(prisma, auth.userId, auth.orgId, now),
        getDistanceDistribution(prisma, auth.userId, auth.orgId, now),
        getPersonalRecords(prisma, auth.userId, auth.orgId),
        getRecentActivities(prisma, auth.userId, auth.orgId),
        getGroupRanking(prisma, auth.orgId, auth.userId, now, rankingPeriod),
      ]);

      experience = buildActivityExperience({
        athleteName,
        activitySource: connectedToStrava ? "STRAVA" : "MANUAL",
        totalGastoAno,
        pendente,
        summary,
        evolutionSeries,
        distanceDistribution,
        personalRecords,
        recentActivities,
        ranking,
        gamification,
      });

      metricsSnapshot = {
        provasConfirmadas,
        kmNoAno: summary.kmNoAno,
        provasConcluidas,
        rankingNoGrupo: ranking.currentUser?.position ?? null,
        consistencia: summary.consistencyPercent,
      };

      experienceSource = "LIVE";
    } else {
      experience = buildEmptyExperience(athleteName, gamification);
    }

    const payload: DashboardAthleteResponse = {
      metrics: metricsSnapshot,
      proximasProvas,
      minhasInscricoes: minhasInscricoesNormalized,
      financeiro: {
        totalGastoAno,
        pendente,
        proximaCobranca: proximaCobranca ?? null,
      },
      calendario,
      experience,
      experienceSource,
      ...(warnings.length ? { dataWarnings: warnings } : {}),
    };

    return NextResponse.json(
      {
        data: payload,
        ...payload,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=60",
        },
      },
    );
  } catch {
    return apiError("INTERNAL_ERROR", "Não foi possível carregar o dashboard no momento.", 503);
  }
}
