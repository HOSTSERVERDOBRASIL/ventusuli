import { PrismaClient } from "@prisma/client";
import {
  ActivitySummary,
  DistributionSlice,
  EvolutionPoint,
  PersonalRecordItem,
  RankingEntry,
  RankingSnapshot,
} from "@/lib/dashboard/types";
import { formatPace, roundTwo } from "@/lib/dashboard/calculations";

interface SummaryRow {
  km_year: number | null;
  km_30d: number | null;
  km_prev_30d: number | null;
  active_weeks_year: number | bigint | null;
  activity_count_year: number | bigint | null;
}

interface MonthlyRow {
  month_start: Date;
  km: number | null;
}

interface DistRow {
  bucket: string;
  count: number | bigint;
}

interface PrRow {
  label: string;
  id: "best5k" | "best21k" | "best42k";
  threshold: number;
}

interface PrResult {
  pace_sec_km: number | null;
  activity_name: string | null;
  activity_date: Date | null;
}

interface RankingRow {
  user_id: string;
  user_name: string;
  total_distance_m: number | null;
  sessions: number | bigint;
}

const DISTANCE_COLORS: Record<string, string> = {
  short: "#38bdf8",
  medium: "#34d399",
  long: "#F5A623",
  very_long: "#8b5cf6",
};

const PR_CONFIG: PrRow[] = [
  { id: "best5k", label: "RP 5K", threshold: 5000 },
  { id: "best21k", label: "RP 21K", threshold: 21097 },
  { id: "best42k", label: "RP 42K", threshold: 42195 },
];

function monthsBetween(base: Date, count: number): Date[] {
  const result: Date[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    result.push(d);
  }
  return result;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();
}

function currentYearBounds(now: Date): { start: Date; end: Date; weeksElapsed: number } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  const elapsedDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  const weeksElapsed = Math.max(1, Math.ceil(elapsedDays / 7));
  return { start, end, weeksElapsed };
}

export async function hasStravaConnection(prisma: PrismaClient, userId: string, organizationId: string): Promise<boolean> {
  const count = await prisma.stravaConnection.count({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
  });
  return count > 0;
}

export async function hasActivities(prisma: PrismaClient, userId: string, organizationId: string): Promise<boolean> {
  const count = await prisma.activity.count({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
  });
  return count > 0;
}

export async function getActivitySummary(prisma: PrismaClient, userId: string, organizationId: string, now: Date): Promise<ActivitySummary> {
  const { start, end, weeksElapsed } = currentYearBounds(now);
  const last30Start = new Date(now.getTime() - 30 * 86_400_000);
  const prev30Start = new Date(now.getTime() - 60 * 86_400_000);

  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COALESCE(SUM(a.distance_m) FILTER (WHERE a.activity_date >= ${start} AND a.activity_date < ${end}), 0) / 1000.0 AS km_year,
      COALESCE(SUM(a.distance_m) FILTER (WHERE a.activity_date >= ${last30Start} AND a.activity_date <= ${now}), 0) / 1000.0 AS km_30d,
      COALESCE(SUM(a.distance_m) FILTER (WHERE a.activity_date >= ${prev30Start} AND a.activity_date < ${last30Start}), 0) / 1000.0 AS km_prev_30d,
      COUNT(DISTINCT DATE_TRUNC('week', a.activity_date)) FILTER (WHERE a.activity_date >= ${start} AND a.activity_date < ${end}) AS active_weeks_year,
      COUNT(*) FILTER (WHERE a.activity_date >= ${start} AND a.activity_date < ${end}) AS activity_count_year
    FROM "public"."activities" a
    WHERE a.organization_id = ${organizationId}
      AND a.user_id = ${userId}
  `;

  const row = rows[0] ?? {
    km_year: 0,
    km_30d: 0,
    km_prev_30d: 0,
    active_weeks_year: 0,
    activity_count_year: 0,
  };

  const activeWeeks = Number(row.active_weeks_year ?? 0);
  const consistencyPercent = roundTwo((activeWeeks / weeksElapsed) * 100);

  return {
    kmNoAno: roundTwo(Number(row.km_year ?? 0)),
    volume30dKm: roundTwo(Number(row.km_30d ?? 0)),
    previous30dKm: roundTwo(Number(row.km_prev_30d ?? 0)),
    consistencyPercent,
    activeWeeksInYear: activeWeeks,
    activityCountInYear: Number(row.activity_count_year ?? 0),
  };
}

export async function getEvolutionSeries(prisma: PrismaClient, userId: string, organizationId: string, now: Date): Promise<EvolutionPoint[]> {
  const months = monthsBetween(now, 6);
  const start = months[0];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const rows = await prisma.$queryRaw<MonthlyRow[]>`
    SELECT DATE_TRUNC('month', a.activity_date) AS month_start,
           COALESCE(SUM(a.distance_m), 0) / 1000.0 AS km
    FROM "public"."activities" a
    WHERE a.organization_id = ${organizationId}
      AND a.user_id = ${userId}
      AND a.activity_date >= ${new Date(Date.UTC(start.getUTCFullYear() - 1, start.getUTCMonth(), 1))}
      AND a.activity_date < ${end}
    GROUP BY DATE_TRUNC('month', a.activity_date)
  `;

  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = `${row.month_start.getUTCFullYear()}-${String(row.month_start.getUTCMonth() + 1).padStart(2, "0")}`;
    map.set(key, Number(row.km ?? 0));
  });

  return months.map((month) => {
    const monthKey = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    const prevKey = `${month.getUTCFullYear() - 1}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      month: monthLabel(month),
      current: roundTwo(map.get(monthKey) ?? 0),
      previous: roundTwo(map.get(prevKey) ?? 0),
    };
  });
}

export async function getDistanceDistribution(prisma: PrismaClient, userId: string, organizationId: string, now: Date): Promise<DistributionSlice[]> {
  const { start, end } = currentYearBounds(now);

  const rows = await prisma.$queryRaw<DistRow[]>`
    SELECT
      CASE
        WHEN a.distance_m < 5000 THEN 'short'
        WHEN a.distance_m < 10000 THEN 'medium'
        WHEN a.distance_m < 21097 THEN 'long'
        ELSE 'very_long'
      END AS bucket,
      COUNT(*) AS count
    FROM "public"."activities" a
    WHERE a.organization_id = ${organizationId}
      AND a.user_id = ${userId}
      AND a.activity_date >= ${start}
      AND a.activity_date < ${end}
    GROUP BY bucket
  `;

  const byBucket = new Map(rows.map((row) => [row.bucket, Number(row.count)]));

  return [
    { name: "<5K", value: byBucket.get("short") ?? 0, color: DISTANCE_COLORS.short },
    { name: "5K-10K", value: byBucket.get("medium") ?? 0, color: DISTANCE_COLORS.medium },
    { name: "10K-21K", value: byBucket.get("long") ?? 0, color: DISTANCE_COLORS.long },
    { name: "21K+", value: byBucket.get("very_long") ?? 0, color: DISTANCE_COLORS.very_long },
  ].filter((item) => item.value > 0);
}

export async function getPersonalRecords(prisma: PrismaClient, userId: string, organizationId: string): Promise<PersonalRecordItem[]> {
  const items = await Promise.all(
    PR_CONFIG.map(async (config) => {
      const row = await prisma.$queryRaw<PrResult[]>`
        SELECT
          COALESCE(a.average_pace_sec_km, (a.moving_time_s / NULLIF((a.distance_m / 1000.0), 0))) AS pace_sec_km,
          a.name AS activity_name,
          a.activity_date
        FROM "public"."activities" a
        WHERE a.organization_id = ${organizationId}
          AND a.user_id = ${userId}
          AND a.distance_m >= ${config.threshold}
          AND a.moving_time_s IS NOT NULL
          AND (a.type ILIKE 'run%' OR a.type ILIKE 'virtual_run%')
        ORDER BY pace_sec_km ASC
        LIMIT 1
      `;

      const best = row[0];
      if (!best?.pace_sec_km || !best.activity_date) return null;

      const record: PersonalRecordItem = {
        id: config.id,
        label: config.label,
        value: formatPace(Number(best.pace_sec_km)),
        event: best.activity_name ?? "Atividade Strava",
        achievedAt: best.activity_date.toISOString(),
      };

      return record;
    }),
  );

  return items.filter((item): item is PersonalRecordItem => Boolean(item));
}

export async function getGroupRanking(prisma: PrismaClient, organizationId: string, userId: string, now: Date): Promise<RankingSnapshot> {
  const periodStart = new Date(now.getTime() - 90 * 86_400_000);

  const rows = await prisma.$queryRaw<RankingRow[]>`
    SELECT
      a.user_id,
      u.name AS user_name,
      COALESCE(SUM(a.distance_m), 0) AS total_distance_m,
      COUNT(*) AS sessions
    FROM "public"."activities" a
    INNER JOIN "public"."users" u ON u.id = a.user_id
    INNER JOIN "public"."athlete_profiles" ap ON ap.user_id = u.id AND ap.organization_id = a.organization_id
    WHERE a.organization_id = ${organizationId}
      AND a.activity_date >= ${periodStart}
      AND u.role = 'ATHLETE'
      AND ap.athlete_status = 'ACTIVE'
    GROUP BY a.user_id, u.name
    ORDER BY COALESCE(SUM(a.distance_m), 0) DESC, COUNT(*) DESC, u.name ASC
    LIMIT 30
  `;

  if (!rows.length) {
    return {
      leaderboard: [],
      currentUser: null,
      totalAthletes: 0,
    };
  }

  const ranked: RankingEntry[] = rows.map((row, index) => {
    const km = Number(row.total_distance_m ?? 0) / 1000;
    const sessions = Number(row.sessions ?? 0);
    const points = Math.max(0, Math.round(km * 10 + sessions * 2));
    return {
      id: row.user_id,
      name: row.user_name,
      points,
      position: index + 1,
    };
  });

  const current = ranked.find((item) => item.id === userId) ?? null;
  const top = ranked.slice(0, 5);
  const inTop = current ? top.some((item) => item.id === current.id) : false;
  const leaderboard = current && !inTop ? [...top.slice(0, 4), current] : top;

  return {
    leaderboard,
    currentUser: current,
    totalAthletes: ranked.length,
  };
}
