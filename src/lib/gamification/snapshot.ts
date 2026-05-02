import type { PrismaClient } from "@prisma/client";
import { achievements, getUnlockedAchievementIds } from "@/lib/gamification/achievements";
import { getLevelProgress } from "@/lib/gamification/levels";
import type { GamificationBreakdownItem, GamificationSnapshot } from "@/lib/gamification/types";
import { calculateSummaryXp } from "@/lib/gamification/xp";

type NumericLike = number | bigint | null;

interface ActivityRow {
  activityDate: Date;
  distanceM: number | null;
  elevationGainM: number | null;
}

interface TrainingRow {
  completedAt: Date | null;
}

interface CountRow {
  count: NumericLike;
}

function toNumber(value: NumericLike | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function computeStreaks(dates: Date[], now: Date): { best: number; current: number } {
  const days = Array.from(new Set(dates.map(dayKey))).sort();
  if (!days.length) return { best: 0, current: 0 };

  let best = 1;
  let run = 1;

  for (let index = 1; index < days.length; index += 1) {
    const previous = keyToDate(days[index - 1]);
    const current = keyToDate(days[index]);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
    run = diffDays === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const daySet = new Set(days);
  const today = keyToDate(dayKey(now));
  const latest = keyToDate(days[days.length - 1]);
  const latestIsActive = latest >= addUtcDays(today, -1);
  if (!latestIsActive) return { best, current: 0 };

  let cursor = latest;
  let current = 0;
  while (daySet.has(dayKey(cursor))) {
    current += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return { best, current };
}

function countPersonalRecords(maxDistanceKm: number): number {
  return [5, 10, 21, 42].filter((threshold) => maxDistanceKm >= threshold).length;
}

function buildBreakdownItems(breakdown: ReturnType<typeof calculateSummaryXp>): GamificationBreakdownItem[] {
  return [
    {
      id: "distance",
      label: "Distancia",
      value: breakdown.distanceXp,
      helper: "10 XP por km sincronizado",
    },
    {
      id: "completion",
      label: "Treinos concluidos",
      value: breakdown.completionXp,
      helper: "20 XP por atividade ou sessao finalizada",
    },
    {
      id: "race",
      label: "Provas",
      value: breakdown.raceXp,
      helper: "100 XP por prova concluida",
    },
    {
      id: "personal-record",
      label: "Recordes",
      value: breakdown.personalRecordXp,
      helper: "150 XP por marco de distancia",
    },
    {
      id: "group",
      label: "Treinos do grupo",
      value: breakdown.groupXp,
      helper: "30 XP por sessao acompanhada",
    },
    {
      id: "streak",
      label: "Sequencia",
      value: breakdown.streakXp,
      helper: "5 XP por dia, limitado a 150 XP",
    },
    {
      id: "elevation",
      label: "Elevacao",
      value: breakdown.elevationXp,
      helper: "1 XP a cada 20 metros",
    },
  ];
}

function toSnapshot(input: {
  totalKm: number;
  completedRuns: number;
  completedRaces: number;
  personalRecords: number;
  groupTrainings: number;
  bestStreakDays: number;
  currentStreakDays: number;
  elevationGainMeters: number;
  maxDistanceKm: number;
  lastActivityAt: Date | null;
}): GamificationSnapshot {
  const breakdown = calculateSummaryXp(input);
  const progress = getLevelProgress(breakdown.totalXp);
  const unlockedIds = new Set(
    getUnlockedAchievementIds({
      completedRuns: input.completedRuns,
      completedRaces: input.completedRaces,
      maxDistanceKm: input.maxDistanceKm,
      personalRecords: input.personalRecords,
      groupTrainings: input.groupTrainings,
      bestStreakDays: input.bestStreakDays,
    }),
  );

  return {
    totalXp: breakdown.totalXp,
    level: {
      id: progress.current.id,
      name: progress.current.name,
      tier: progress.current.tier,
      color: progress.current.color,
      description: progress.current.description,
      minXp: progress.current.minXp,
      maxXp: progress.current.maxXp,
      nextLevelName: progress.next?.name ?? null,
      progressPercent: progress.percent,
      xpIntoLevel: progress.xpIntoLevel,
      xpForNext: progress.xpForNext,
      remainingXp: progress.remainingXp,
      unlocks: progress.current.unlocks,
    },
    breakdown: buildBreakdownItems(breakdown),
    achievements: achievements.map((achievement) => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
    })),
    stats: {
      totalKm: roundTwo(input.totalKm),
      completedRuns: input.completedRuns,
      completedRaces: input.completedRaces,
      personalRecords: input.personalRecords,
      groupTrainings: input.groupTrainings,
      bestStreakDays: input.bestStreakDays,
      currentStreakDays: input.currentStreakDays,
      elevationGainMeters: input.elevationGainMeters,
      lastActivityAt: input.lastActivityAt?.toISOString() ?? null,
    },
  };
}

export function buildEmptyGamificationSnapshot(): GamificationSnapshot {
  return toSnapshot({
    totalKm: 0,
    completedRuns: 0,
    completedRaces: 0,
    personalRecords: 0,
    groupTrainings: 0,
    bestStreakDays: 0,
    currentStreakDays: 0,
    elevationGainMeters: 0,
    maxDistanceKm: 0,
    lastActivityAt: null,
  });
}

export async function buildUserGamificationSnapshot(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
  now: Date,
): Promise<GamificationSnapshot> {
  const [activityRows, raceRows, trainingRows] = await Promise.all([
    prisma.$queryRaw<ActivityRow[]>`
      SELECT
        a.activity_date AS "activityDate",
        a.distance_m AS "distanceM",
        a.elevation_gain_m AS "elevationGainM"
      FROM public.activities a
      WHERE a.organization_id = ${organizationId}
        AND a.user_id = ${userId}
      ORDER BY a.activity_date ASC
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM public.registrations r
      INNER JOIN public.events e ON e.id = r.event_id
      WHERE r.organization_id = ${organizationId}
        AND r.user_id = ${userId}
        AND r.status = 'CONFIRMED'
        AND (
          r.attendance_status = 'PRESENT'
          OR r.check_in_at IS NOT NULL
          OR e.event_date < ${now}
        )
    `,
    prisma.$queryRaw<TrainingRow[]>`
      SELECT ws.completed_at AS "completedAt"
      FROM public.workout_sessions ws
      WHERE ws.organization_id = ${organizationId}
        AND ws.athlete_id = ${userId}
        AND ws.status = 'COMPLETED'
        AND ws.completed_at IS NOT NULL
      ORDER BY ws.completed_at ASC
    `,
  ]);

  const totalDistanceM = activityRows.reduce((sum, row) => sum + (row.distanceM ?? 0), 0);
  const totalKm = totalDistanceM / 1000;
  const maxDistanceKm =
    activityRows.reduce((max, row) => Math.max(max, (row.distanceM ?? 0) / 1000), 0) ?? 0;
  const elevationGainMeters = activityRows.reduce((sum, row) => sum + (row.elevationGainM ?? 0), 0);
  const completedRuns = activityRows.length + trainingRows.length;
  const completedRaces = toNumber(raceRows[0]?.count);
  const groupTrainings = trainingRows.length;
  const personalRecords = countPersonalRecords(maxDistanceKm);
  const activityDates = [
    ...activityRows.map((row) => row.activityDate),
    ...trainingRows.map((row) => row.completedAt).filter((value): value is Date => Boolean(value)),
  ];
  const streaks = computeStreaks(activityDates, now);
  const lastActivityAt = activityDates.length
    ? [...activityDates].sort((left, right) => right.getTime() - left.getTime())[0]
    : null;

  return toSnapshot({
    totalKm,
    completedRuns,
    completedRaces,
    personalRecords,
    groupTrainings,
    bestStreakDays: streaks.best,
    currentStreakDays: streaks.current,
    elevationGainMeters,
    maxDistanceKm,
    lastActivityAt,
  });
}
