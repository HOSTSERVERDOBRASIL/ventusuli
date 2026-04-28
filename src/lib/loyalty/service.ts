import { Prisma } from "@prisma/client";
import { formatISO, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getUserPointsBalance } from "@/lib/points/pointsService";

type LoyaltyLevelKey = "STARTER" | "MEMBER" | "PLUS" | "PRIME" | "BLACK";
type MissionStatus = "IN_PROGRESS" | "COMPLETED" | "CLAIMED" | "EXPIRED";

interface LoyaltyLevelRow {
  id: string;
  key: LoyaltyLevelKey;
  name: string;
  minLifetimePoints: number | bigint;
  multiplier: Prisma.Decimal | number | string;
  benefits: unknown;
  active: boolean;
  sortOrder: number;
}

interface LoyaltyMissionRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  targetValue: number;
  rewardPoints: number;
  rewardBadgeId: string | null;
  startAt: Date | null;
  endAt: Date | null;
  repeatable: boolean;
  status: string;
  levelRequirement: LoyaltyLevelKey | null;
  metadata: unknown;
}

interface UserMissionRow {
  missionId: string;
  cycleKey: string;
  progressValue: number;
  status: MissionStatus;
  claimedAt: Date | null;
}

interface LoyaltyBadgeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
}

interface UserBadgeRow {
  badgeId: string;
  awardedAt: Date;
}

interface AggregateRow {
  lifetimePoints: number | bigint | null;
  lastActivityAt: Date | null;
}

interface DateRow {
  createdAt: Date;
}

interface PurchaseAggregateRow {
  paidCount: number | bigint | null;
}

interface ReferralAggregateRow {
  referralCount: number | bigint | null;
}

function toNumber(value: number | bigint | string | Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value.toString());
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readBenefits(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function resolveSegment(params: {
  createdAt: Date;
  lastActivityAt: Date | null;
  lifetimePoints: number;
  availablePoints: number;
  currentStreak: number;
}): string {
  const now = Date.now();
  const accountAgeDays = Math.floor((now - params.createdAt.getTime()) / (24 * 60 * 60 * 1000));
  const inactivityDays = params.lastActivityAt
    ? Math.floor((now - params.lastActivityAt.getTime()) / (24 * 60 * 60 * 1000))
    : Number.POSITIVE_INFINITY;

  if (accountAgeDays <= 7) return "novo";
  if (inactivityDays >= 60) return "inativo";
  if (inactivityDays >= 30) return "em risco";
  if (params.lifetimePoints >= 20000 || params.availablePoints >= 5000) return "alto valor";
  if (params.currentStreak >= 4 || inactivityDays <= 7) return "recorrente";
  return "ativo";
}

function computeWeeklyStreak(activityRows: DateRow[]): { current: number; best: number; lastWeekAt: Date | null } {
  const uniqueWeeks = Array.from(
    new Set(
      activityRows.map((row) =>
        startOfWeek(row.createdAt, { weekStartsOn: 1 }).toISOString().slice(0, 10),
      ),
    ),
  ).sort();

  if (uniqueWeeks.length === 0) return { current: 0, best: 0, lastWeekAt: null };

  let current = 1;
  let best = 1;
  for (let index = 1; index < uniqueWeeks.length; index += 1) {
    const previous = new Date(`${uniqueWeeks[index - 1]}T00:00:00.000Z`);
    const currentWeek = new Date(`${uniqueWeeks[index]}T00:00:00.000Z`);
    const diffDays = Math.round((currentWeek.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 7) current += 1;
    else current = 1;
    if (current > best) best = current;
  }

  let activeCurrent = 1;
  for (let index = uniqueWeeks.length - 1; index > 0; index -= 1) {
    const currentWeek = new Date(`${uniqueWeeks[index]}T00:00:00.000Z`);
    const previous = new Date(`${uniqueWeeks[index - 1]}T00:00:00.000Z`);
    const diffDays = Math.round((currentWeek.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 7) activeCurrent += 1;
    else break;
  }

  return {
    current: activeCurrent,
    best,
    lastWeekAt: new Date(`${uniqueWeeks[uniqueWeeks.length - 1]}T00:00:00.000Z`),
  };
}

function resolveCurrentLevel(levels: LoyaltyLevelRow[], lifetimePoints: number): LoyaltyLevelRow {
  return (
    [...levels]
      .sort((left, right) => toNumber(left.minLifetimePoints) - toNumber(right.minLifetimePoints))
      .filter((level) => lifetimePoints >= toNumber(level.minLifetimePoints))
      .at(-1) ?? levels[0]
  );
}

function resolveNextLevel(levels: LoyaltyLevelRow[], currentLevel: LoyaltyLevelRow): LoyaltyLevelRow | null {
  const ordered = [...levels].sort(
    (left, right) => toNumber(left.minLifetimePoints) - toNumber(right.minLifetimePoints),
  );
  const currentIndex = ordered.findIndex((level) => level.id === currentLevel.id);
  if (currentIndex < 0 || currentIndex === ordered.length - 1) return null;
  return ordered[currentIndex + 1];
}

async function loadDefaultLevels(): Promise<LoyaltyLevelRow[]> {
  const rows = await prisma.$queryRaw<LoyaltyLevelRow[]>`
    SELECT
      id,
      key,
      name,
      "minLifetimePoints",
      multiplier,
      benefits,
      active,
      "sortOrder"
    FROM public.loyalty_levels
    WHERE active = true
    ORDER BY "sortOrder" ASC, "minLifetimePoints" ASC
  `;

  if (rows.length > 0) return rows;

  return [
    {
      id: "starter",
      key: "STARTER",
      name: "Ventus Starter",
      minLifetimePoints: 0,
      multiplier: 1,
      benefits: ["pontos base", "missoes iniciais"],
      active: true,
      sortOrder: 1,
    },
    {
      id: "member",
      key: "MEMBER",
      name: "Ventus Member",
      minLifetimePoints: 1000,
      multiplier: 1.2,
      benefits: ["multiplicador 1.2x", "bonus de frequencia"],
      active: true,
      sortOrder: 2,
    },
    {
      id: "plus",
      key: "PLUS",
      name: "Ventus Plus",
      minLifetimePoints: 5000,
      multiplier: 1.5,
      benefits: ["multiplicador 1.5x", "cashback maior", "ofertas exclusivas"],
      active: true,
      sortOrder: 3,
    },
    {
      id: "prime",
      key: "PRIME",
      name: "Ventus Prime",
      minLifetimePoints: 20000,
      multiplier: 2,
      benefits: ["multiplicador 2.0x", "atendimento prioritario", "campanhas privadas"],
      active: true,
      sortOrder: 4,
    },
    {
      id: "black",
      key: "BLACK",
      name: "Ventus Black",
      minLifetimePoints: 75000,
      multiplier: 3,
      benefits: ["multiplicador 3.0x", "recompensas exclusivas", "status maximo"],
      active: true,
      sortOrder: 5,
    },
  ];
}

async function syncLoyaltyProfile(userId: string, organizationId: string) {
  const [balance, levels, userRows, aggregateRows, streakRows, purchaseRows, referralRows] = await Promise.all([
    getUserPointsBalance(userId, organizationId),
    loadDefaultLevels(),
    prisma.$queryRaw<Array<{ created_at: Date }>>`
      SELECT created_at
      FROM public.users
      WHERE id = ${userId}
      LIMIT 1
    `,
    prisma.$queryRaw<AggregateRow[]>`
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN points > 0 AND "sourceType" NOT IN ('REDEMPTION', 'EXPIRATION', 'REFUND')
              THEN points
              ELSE 0
            END
          ),
          0
        ) AS "lifetimePoints",
        MAX("createdAt") AS "lastActivityAt"
      FROM public."AthletePointLedger"
      WHERE "organizationId" = ${organizationId}
        AND "userId" = ${userId}
    `,
    prisma.$queryRaw<DateRow[]>`
      SELECT "createdAt"
      FROM public."AthletePointLedger"
      WHERE "organizationId" = ${organizationId}
        AND "userId" = ${userId}
        AND points > 0
        AND "sourceType" NOT IN ('REDEMPTION', 'EXPIRATION', 'REFUND')
      ORDER BY "createdAt" ASC
    `,
    prisma.$queryRaw<PurchaseAggregateRow[]>`
      SELECT COUNT(*)::bigint AS "paidCount"
      FROM public.payments
      WHERE organization_id = ${organizationId}
        AND user_id = ${userId}
        AND status = 'PAID'
    `,
    prisma.$queryRaw<ReferralAggregateRow[]>`
      SELECT COUNT(*)::bigint AS "referralCount"
      FROM public.organization_invites
      WHERE organization_id = ${organizationId}
        AND created_by = ${userId}
        AND accepted_at IS NOT NULL
    `,
  ]);

  const createdAt = userRows[0]?.created_at ?? new Date();
  const lifetimePoints = toNumber(aggregateRows[0]?.lifetimePoints);
  const lastActivityAt = aggregateRows[0]?.lastActivityAt ?? null;
  const streak = computeWeeklyStreak(streakRows);
  const currentLevel = resolveCurrentLevel(levels, lifetimePoints);
  const nextLevel = resolveNextLevel(levels, currentLevel);
  const segment = resolveSegment({
    createdAt,
    lastActivityAt,
    lifetimePoints,
    availablePoints: balance.balance,
    currentStreak: streak.current,
  });

  await prisma.$executeRaw`
    INSERT INTO public.users_loyalty (
      id,
      "userId",
      "organizationId",
      "currentLevelKey",
      "availablePoints",
      "lifetimePoints",
      "lastActivityAt",
      "streakCurrent",
      "streakBest",
      "lastStreakAt",
      segment,
      "updatedAt"
    )
    VALUES (
      ${`loyalty-${userId}`},
      ${userId},
      ${organizationId},
      ${currentLevel.key}::"public"."LoyaltyLevelKey",
      ${balance.balance},
      ${lifetimePoints},
      ${lastActivityAt},
      ${streak.current},
      ${streak.best},
      ${streak.lastWeekAt},
      ${segment},
      NOW()
    )
    ON CONFLICT ("userId") DO UPDATE
    SET
      "currentLevelKey" = EXCLUDED."currentLevelKey",
      "availablePoints" = EXCLUDED."availablePoints",
      "lifetimePoints" = EXCLUDED."lifetimePoints",
      "lastActivityAt" = EXCLUDED."lastActivityAt",
      "streakCurrent" = EXCLUDED."streakCurrent",
      "streakBest" = EXCLUDED."streakBest",
      "lastStreakAt" = EXCLUDED."lastStreakAt",
      segment = EXCLUDED.segment,
      "updatedAt" = NOW()
  `;

  return {
    balance,
    levels,
    currentLevel,
    nextLevel,
    lifetimePoints,
    lastActivityAt,
    streak,
    segment,
    paidCount: toNumber(purchaseRows[0]?.paidCount),
    referralCount: toNumber(referralRows[0]?.referralCount),
  };
}

async function syncUserMissions(params: {
  userId: string;
  organizationId: string;
  currentLevelKey: LoyaltyLevelKey;
  paidCount: number;
  referralCount: number;
}) {
  const [missions, existingRows, onboardingRows] = await Promise.all([
    prisma.$queryRaw<LoyaltyMissionRow[]>`
      SELECT
        id,
        code,
        name,
        description,
        type,
        "targetValue",
        "rewardPoints",
        "rewardBadgeId",
        "startAt",
        "endAt",
        repeatable,
        status,
        "levelRequirement",
        metadata
      FROM public.missions
      WHERE "organizationId" = ${params.organizationId}
        AND status = 'ACTIVE'
      ORDER BY "createdAt" ASC
    `,
    prisma.$queryRaw<UserMissionRow[]>`
      SELECT
        "missionId",
        "cycleKey",
        "progressValue",
        status,
        "claimedAt"
      FROM public.user_missions
      WHERE "organizationId" = ${params.organizationId}
        AND "userId" = ${params.userId}
    `,
    prisma.$queryRaw<Array<{ onboarding_completed_at: Date | null; email_verified: boolean }>>`
      SELECT
        ap.onboarding_completed_at,
        u.email_verified
      FROM public.users u
      LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
      WHERE u.id = ${params.userId}
      LIMIT 1
    `,
  ]);

  const existingByMissionId = new Map(existingRows.map((row) => [row.missionId, row]));
  const onboardingComplete = Boolean(
    onboardingRows[0]?.onboarding_completed_at || onboardingRows[0]?.email_verified,
  );

  const missionViews = [];
  for (const mission of missions) {
    const targetValue = Math.max(1, mission.targetValue);
    let progressValue = 0;

    if (mission.code === "complete-onboarding") progressValue = onboardingComplete ? 1 : 0;
    else if (mission.code === "first-purchase") progressValue = params.paidCount;
    else if (mission.code === "first-referral") progressValue = params.referralCount;

    const previous = existingByMissionId.get(mission.id);
    const eligible =
      !mission.levelRequirement ||
      ["STARTER", "MEMBER", "PLUS", "PRIME", "BLACK"].indexOf(params.currentLevelKey) >=
        ["STARTER", "MEMBER", "PLUS", "PRIME", "BLACK"].indexOf(mission.levelRequirement);
    const expired = Boolean(mission.endAt && mission.endAt.getTime() < Date.now());

    let status: MissionStatus = "IN_PROGRESS";
    if (previous?.claimedAt) status = "CLAIMED";
    else if (expired && progressValue < targetValue) status = "EXPIRED";
    else if (progressValue >= targetValue) status = "COMPLETED";

    await prisma.$executeRaw`
      INSERT INTO public.user_missions (
        id,
        "missionId",
        "userId",
        "organizationId",
        "cycleKey",
        "progressValue",
        status,
        "completedAt",
        "updatedAt"
      )
      VALUES (
        ${`user-mission-${mission.id}-${params.userId}-default`},
        ${mission.id},
        ${params.userId},
        ${params.organizationId},
        'default',
        ${progressValue},
        ${status}::"public"."UserMissionStatus",
        ${status === "COMPLETED" || status === "CLAIMED" ? new Date() : null},
        NOW()
      )
      ON CONFLICT ("missionId", "userId", "cycleKey") DO UPDATE
      SET
        "progressValue" = EXCLUDED."progressValue",
        status = CASE
          WHEN public.user_missions."claimedAt" IS NOT NULL THEN 'CLAIMED'::"public"."UserMissionStatus"
          ELSE EXCLUDED.status
        END,
        "completedAt" = CASE
          WHEN EXCLUDED.status IN ('COMPLETED'::"public"."UserMissionStatus", 'CLAIMED'::"public"."UserMissionStatus")
          THEN COALESCE(public.user_missions."completedAt", NOW())
          ELSE public.user_missions."completedAt"
        END,
        "updatedAt" = NOW()
    `;

    missionViews.push({
      id: mission.id,
      code: mission.code,
      name: mission.name,
      description: mission.description,
      type: mission.type,
      rewardPoints: mission.rewardPoints,
      progressValue,
      targetValue,
      progressPercent: Math.min(100, Math.round((progressValue / targetValue) * 100)),
      repeatable: mission.repeatable,
      status,
      eligible,
      levelRequirement: mission.levelRequirement,
    });
  }

  return missionViews;
}

async function syncUserBadges(params: {
  userId: string;
  organizationId: string;
  lifetimePoints: number;
  streakCurrent: number;
}) {
  const [badges, existing] = await Promise.all([
    prisma.$queryRaw<LoyaltyBadgeRow[]>`
      SELECT id, code, name, description, icon, category
      FROM public.badges
      WHERE "organizationId" = ${params.organizationId}
        AND active = true
      ORDER BY "createdAt" ASC
    `,
    prisma.$queryRaw<UserBadgeRow[]>`
      SELECT "badgeId", "awardedAt"
      FROM public.user_badges
      WHERE "organizationId" = ${params.organizationId}
        AND "userId" = ${params.userId}
    `,
  ]);

  const existingByBadgeId = new Map(existing.map((row) => [row.badgeId, row]));
  const views = [];

  for (const badge of badges) {
    const shouldAward =
      (badge.code === "first-action" && params.lifetimePoints > 0) ||
      (badge.code === "recurring-athlete" && params.streakCurrent >= 4);

    if (shouldAward && !existingByBadgeId.has(badge.id)) {
      await prisma.$executeRaw`
        INSERT INTO public.user_badges (
          id,
          "badgeId",
          "userId",
          "organizationId",
          "awardedAt",
          "createdAt"
        )
        VALUES (
          ${`user-badge-${badge.id}-${params.userId}`},
          ${badge.id},
          ${params.userId},
          ${params.organizationId},
          NOW(),
          NOW()
        )
        ON CONFLICT ("badgeId", "userId") DO NOTHING
      `;
    }

    const awarded = existingByBadgeId.get(badge.id) ?? (shouldAward ? { badgeId: badge.id, awardedAt: new Date() } : null);
    views.push({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      awardedAt: awarded?.awardedAt ? formatISO(awarded.awardedAt) : null,
      unlocked: Boolean(awarded),
    });
  }

  return views;
}

export async function getLoyaltySnapshot(userId: string, organizationId: string) {
  const profile = await syncLoyaltyProfile(userId, organizationId);
  const missions = await syncUserMissions({
    userId,
    organizationId,
    currentLevelKey: profile.currentLevel.key,
    paidCount: profile.paidCount,
    referralCount: profile.referralCount,
  });
  const badges = await syncUserBadges({
    userId,
    organizationId,
    lifetimePoints: profile.lifetimePoints,
    streakCurrent: profile.streak.current,
  });

  const currentThreshold = toNumber(profile.currentLevel.minLifetimePoints);
  const nextThreshold = profile.nextLevel ? toNumber(profile.nextLevel.minLifetimePoints) : currentThreshold;
  const progressInLevel = profile.nextLevel
    ? Math.max(0, profile.lifetimePoints - currentThreshold)
    : profile.lifetimePoints;
  const progressRange = profile.nextLevel
    ? Math.max(1, nextThreshold - currentThreshold)
    : Math.max(1, profile.lifetimePoints);

  return {
    availablePoints: profile.balance.balance,
    lifetimePoints: profile.lifetimePoints,
    pointsExpiringIn30Days: profile.balance.pointsExpiringIn30Days,
    segment: profile.segment,
    streak: {
      current: profile.streak.current,
      best: profile.streak.best,
      lastWeekAt: profile.streak.lastWeekAt ? formatISO(profile.streak.lastWeekAt) : null,
    },
    level: {
      key: profile.currentLevel.key,
      name: profile.currentLevel.name,
      multiplier: toNumber(profile.currentLevel.multiplier),
      benefits: readBenefits(readObject(profile.currentLevel.benefits).benefits ?? profile.currentLevel.benefits),
      progressPercent: profile.nextLevel
        ? Math.min(100, Math.round((progressInLevel / progressRange) * 100))
        : 100,
      progressInLevel,
      nextLevelPoints: profile.nextLevel ? Math.max(0, nextThreshold - profile.lifetimePoints) : 0,
      nextLevel: profile.nextLevel
        ? {
            key: profile.nextLevel.key,
            name: profile.nextLevel.name,
            multiplier: toNumber(profile.nextLevel.multiplier),
            minLifetimePoints: toNumber(profile.nextLevel.minLifetimePoints),
          }
        : null,
    },
    levels: profile.levels.map((level) => ({
      key: level.key,
      name: level.name,
      minLifetimePoints: toNumber(level.minLifetimePoints),
      multiplier: toNumber(level.multiplier),
      benefits: readBenefits(readObject(level.benefits).benefits ?? level.benefits),
    })),
    missions,
    badges,
  };
}
