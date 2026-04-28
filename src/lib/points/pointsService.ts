import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { buildAvailableCreditBuckets } from "@/lib/points/expirationService";
import { getOrganizationPointPolicy } from "@/lib/points/policy";
import { prisma } from "@/lib/prisma";

export type LedgerType = "CREDIT" | "DEBIT" | "EXPIRATION" | "ADJUSTMENT" | "REFUND";

export type LedgerSource =
  | "EVENT_PARTICIPATION"
  | "EARLY_SIGNUP"
  | "EARLY_PAYMENT"
  | "CAMPAIGN_BONUS"
  | "ACTIVITY_APPROVAL"
  | "REFERRAL"
  | "RECURRENCE"
  | "MANUAL"
  | "REDEMPTION"
  | "REFUND"
  | "EXPIRATION";

export type EventTriggerSource = "PARTICIPATION" | "EARLY_SIGNUP" | "EARLY_PAYMENT" | "CAMPAIGN_BONUS";

interface LedgerRow {
  id: string;
  organizationId: string;
  userId: string;
  eventId: string | null;
  registrationId: string | null;
  type: LedgerType;
  sourceType: LedgerSource;
  points: number;
  balanceAfter: number;
  description: string;
  referenceCode: string;
  createdBy: string;
  createdAt: Date;
}

interface AggregateRow {
  totalCredited: number | bigint | null;
  totalDebited: number | bigint | null;
}

interface ExpiringLedgerRow {
  id: string;
  userId: string;
  points: number | bigint;
  type: string;
  createdAt: Date;
}

export interface PointsBalanceResult {
  balance: number;
  totalCredited: number;
  totalDebited: number;
  pointsExpiringIn30Days: number;
}

export interface LedgerMutationInput {
  orgId: string;
  userId: string;
  eventId?: string;
  registrationId?: string;
  sourceType: LedgerSource;
  points: number;
  description: string;
  referenceCode: string;
  createdBy: string;
}

export interface LedgerMutationResult {
  entry: LedgerRow;
  created: boolean;
}

interface EventPointRuleRow {
  basePoints: number;
  earlySignupBonus: number;
  earlyPaymentBonus: number;
  campaignBonus: number;
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

function mapLedgerRow(row: LedgerRow): LedgerRow {
  return {
    ...row,
    points: toNumber(row.points),
    balanceAfter: toNumber(row.balanceAfter),
  };
}

async function createLedgerEntryInTransaction(
  tx: Prisma.TransactionClient,
  input: LedgerMutationInput,
  ledgerType: LedgerType,
): Promise<LedgerMutationResult> {
  const existing = await tx.$queryRaw<LedgerRow[]>`
    SELECT *
    FROM public."AthletePointLedger"
    WHERE "referenceCode" = ${input.referenceCode}
    LIMIT 1
  `;

  if (existing[0]) {
    return { entry: mapLedgerRow(existing[0]), created: false };
  }

  const latest = await tx.$queryRaw<Array<{ balanceAfter: number | bigint | null }>>`
    SELECT "balanceAfter"
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${input.orgId}
      AND "userId" = ${input.userId}
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 1
  `;

  const previousBalance = toNumber(latest[0]?.balanceAfter);
  const balanceAfter = previousBalance + input.points;

  if (balanceAfter < 0) {
    throw new Error("points_balance_cannot_be_negative");
  }

  const created = await tx.$queryRaw<LedgerRow[]>`
    INSERT INTO public."AthletePointLedger" (
      id,
      "organizationId",
      "userId",
      "eventId",
      "registrationId",
      type,
      "sourceType",
      points,
      "balanceAfter",
      description,
      "referenceCode",
      "createdBy",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.orgId},
      ${input.userId},
      ${input.eventId ?? null},
      ${input.registrationId ?? null},
      ${ledgerType},
      ${input.sourceType},
      ${input.points},
      ${balanceAfter},
      ${input.description},
      ${input.referenceCode},
      ${input.createdBy},
      NOW()
    )
    RETURNING *
  `;

  return { entry: mapLedgerRow(created[0]), created: true };
}

export async function getUserPointsBalance(userId: string, orgId: string): Promise<PointsBalanceResult> {
  const [latest, aggregate, policy] = await Promise.all([
    prisma.$queryRaw<Array<{ balanceAfter: number | bigint | null }>>`
      SELECT "balanceAfter"
      FROM public."AthletePointLedger"
      WHERE "organizationId" = ${orgId}
        AND "userId" = ${userId}
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 1
    `,
    prisma.$queryRaw<AggregateRow[]>`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN points ELSE 0 END), 0) AS "totalCredited",
        COALESCE(
          SUM(
            CASE
              WHEN type IN ('DEBIT', 'EXPIRATION') OR "sourceType" = 'REDEMPTION' THEN ABS(points)
              ELSE 0
            END
          ),
          0
        ) AS "totalDebited"
      FROM public."AthletePointLedger"
      WHERE "organizationId" = ${orgId}
        AND "userId" = ${userId}
    `,
    getOrganizationPointPolicy(orgId),
  ]);

  const now = new Date();
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - policy.expirationMonths);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);

  const expiringLedgerRows = await prisma.$queryRaw<ExpiringLedgerRow[]>`
    SELECT
      id,
      "userId",
      points,
      type,
      "createdAt"
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${orgId}
      AND "userId" = ${userId}
    ORDER BY "createdAt" ASC, id ASC
  `;
  const pointsExpiringIn30Days = buildAvailableCreditBuckets(expiringLedgerRows)
    .filter((bucket) => bucket.createdAt >= start && bucket.createdAt < end)
    .reduce((total, bucket) => total + bucket.remaining, 0);

  return {
    balance: toNumber(latest[0]?.balanceAfter),
    totalCredited: toNumber(aggregate[0]?.totalCredited),
    totalDebited: toNumber(aggregate[0]?.totalDebited),
    pointsExpiringIn30Days,
  };
}

export async function creditPoints(input: LedgerMutationInput): Promise<LedgerMutationResult> {
  if (input.points <= 0) {
    throw new Error("credit_points_must_be_positive");
  }

  return prisma.$transaction((tx) => createLedgerEntryInTransaction(tx, input, "CREDIT"));
}

export async function creditPointsInTransaction(
  tx: Prisma.TransactionClient,
  input: LedgerMutationInput,
): Promise<LedgerMutationResult> {
  if (input.points <= 0) {
    throw new Error("credit_points_must_be_positive");
  }

  return createLedgerEntryInTransaction(tx, input, "CREDIT");
}

export async function debitPoints(input: LedgerMutationInput): Promise<LedgerMutationResult> {
  if (input.points >= 0) {
    throw new Error("debit_points_must_be_negative");
  }

  return prisma.$transaction((tx) => createLedgerEntryInTransaction(tx, input, "DEBIT"));
}

export async function debitPointsInTransaction(
  tx: Prisma.TransactionClient,
  input: LedgerMutationInput,
): Promise<LedgerMutationResult> {
  if (input.points >= 0) {
    throw new Error("debit_points_must_be_negative");
  }

  return createLedgerEntryInTransaction(tx, input, "DEBIT");
}

export async function creditEventPoints(p: {
  orgId: string;
  userId: string;
  eventId: string;
  registrationId: string;
  triggerSource: EventTriggerSource;
  createdBy: string;
}): Promise<LedgerMutationResult> {
  const ruleRows = await prisma.$queryRaw<EventPointRuleRow[]>`
    SELECT "basePoints", "earlySignupBonus", "earlyPaymentBonus", "campaignBonus"
    FROM public."EventPointRule"
    WHERE "organizationId" = ${p.orgId}
      AND active = true
      AND ("eventId" = ${p.eventId} OR "eventId" IS NULL)
    ORDER BY CASE WHEN "eventId" = ${p.eventId} THEN 0 ELSE 1 END, "updatedAt" DESC
    LIMIT 1
  `;

  const rule = ruleRows[0] ?? {
    basePoints: 10,
    earlySignupBonus: 5,
    earlyPaymentBonus: 3,
    campaignBonus: 0,
  };

  const sourceByTrigger: Record<EventTriggerSource, LedgerSource> = {
    PARTICIPATION: "EVENT_PARTICIPATION",
    EARLY_SIGNUP: "EARLY_SIGNUP",
    EARLY_PAYMENT: "EARLY_PAYMENT",
    CAMPAIGN_BONUS: "CAMPAIGN_BONUS",
  };

  const pointsByTrigger: Record<EventTriggerSource, number> = {
    PARTICIPATION: rule.basePoints,
    EARLY_SIGNUP: rule.earlySignupBonus,
    EARLY_PAYMENT: rule.earlyPaymentBonus,
    CAMPAIGN_BONUS: rule.campaignBonus,
  };

  const points = pointsByTrigger[p.triggerSource];
  const referenceCode = `EVT-${p.eventId}-${p.userId}-${p.triggerSource}`;

  return creditPoints({
    orgId: p.orgId,
    userId: p.userId,
    eventId: p.eventId,
    registrationId: p.registrationId,
    sourceType: sourceByTrigger[p.triggerSource],
    points,
    description: `Pontuacao automatica: ${p.triggerSource}`,
    referenceCode,
    createdBy: p.createdBy,
  });
}
