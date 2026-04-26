import { Prisma } from "@prisma/client";
import { calculateRedemption } from "@/lib/points/redemptionCalculator";
import { creditPointsInTransaction, debitPointsInTransaction } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";

interface RewardItemRow {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  pointsCost: number;
  cashPriceCents: number;
  allowPoints: boolean;
  allowCash: boolean;
  allowMixed: boolean;
  maxPointsDiscountPercent: number;
  minimumCashCents: number;
  stockQuantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface RewardRedemptionRow {
  id: string;
  organizationId: string;
  userId: string;
  rewardItemId: string;
  quantity: number;
  pointsUsed: number;
  cashPaidCents: number;
  paymentId: string | null;
  idempotencyKey: string;
  status:
    | "REQUESTED"
    | "PENDING_PAYMENT"
    | "APPROVED"
    | "SEPARATED"
    | "DELIVERED"
    | "CANCELLED"
    | "PAYMENT_FAILED";
  requestedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  notes: string | null;
}

export class RedemptionServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toCuidLike(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 16);
  return `c${ts}${rand}`;
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  return value;
}

async function getCurrentBalanceInTransaction(
  tx: Prisma.TransactionClient,
  orgId: string,
  userId: string,
): Promise<number> {
  const latest = await tx.$queryRaw<Array<{ balanceAfter: number | bigint | null }>>`
    SELECT "balanceAfter"
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${orgId}
      AND "userId" = ${userId}
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 1
  `;

  return toNumber(latest[0]?.balanceAfter);
}

export async function createRedemption(params: {
  userId: string;
  orgId: string;
  rewardItemId: string;
  requestedPoints?: number;
  idempotencyKey: string;
  createdBy: string;
}): Promise<{ redemption: RewardRedemptionRow; paymentRequired: boolean; cashCents: number }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<RewardRedemptionRow[]>`
      SELECT *
      FROM public."RewardRedemption"
      WHERE "idempotencyKey" = ${params.idempotencyKey}
      LIMIT 1
    `;

    if (existing[0]) {
      return {
        redemption: existing[0],
        paymentRequired: existing[0].status === "PENDING_PAYMENT",
        cashCents: toNumber(existing[0].cashPaidCents),
      };
    }

    const rewardRows = await tx.$queryRaw<RewardItemRow[]>`
      SELECT *
      FROM public."RewardItem"
      WHERE id = ${params.rewardItemId}
        AND "organizationId" = ${params.orgId}
        AND active = true
        AND "stockQuantity" > 0
      LIMIT 1
      FOR UPDATE
    `;

    const rewardItem = rewardRows[0];
    if (!rewardItem) {
      throw new RedemptionServiceError("Item de recompensa nao encontrado.", 404);
    }

    const userBalance = await getCurrentBalanceInTransaction(tx, params.orgId, params.userId);
    const calculation = calculateRedemption(
      {
        cashPriceCents: rewardItem.cashPriceCents,
        pointsCost: rewardItem.pointsCost,
        maxPointsDiscountPercent: rewardItem.maxPointsDiscountPercent,
        minimumCashCents: rewardItem.minimumCashCents,
        allowMixed: rewardItem.allowMixed,
        allowPoints: rewardItem.allowPoints,
        active: rewardItem.active,
        stockQuantity: rewardItem.stockQuantity,
      },
      userBalance,
      params.requestedPoints,
    );

    if (!calculation.isValid) {
      throw new RedemptionServiceError(calculation.validationError ?? "Resgate invalido.", 400);
    }

    if (userBalance < calculation.pointsUsed) {
      throw new RedemptionServiceError("Saldo insuficiente para resgate.", 400);
    }

    const redemptionId = toCuidLike();

    if (calculation.cashCents > 0) {
      const createdRows = await tx.$queryRaw<RewardRedemptionRow[]>`
        INSERT INTO public."RewardRedemption" (
          id,
          "organizationId",
          "userId",
          "rewardItemId",
          quantity,
          "pointsUsed",
          "cashPaidCents",
          "paymentId",
          "idempotencyKey",
          status,
          "requestedAt",
          "deliveredAt",
          "cancelledAt",
          notes
        )
        VALUES (
          ${redemptionId},
          ${params.orgId},
          ${params.userId},
          ${params.rewardItemId},
          1,
          ${calculation.pointsUsed},
          ${calculation.cashCents},
          NULL,
          ${params.idempotencyKey},
          'PENDING_PAYMENT',
          NOW(),
          NULL,
          NULL,
          NULL
        )
        RETURNING *
      `;

      return {
        redemption: createdRows[0],
        paymentRequired: true,
        cashCents: calculation.cashCents,
      };
    }

    const approvedRows = await tx.$queryRaw<RewardRedemptionRow[]>`
      INSERT INTO public."RewardRedemption" (
        id,
        "organizationId",
        "userId",
        "rewardItemId",
        quantity,
        "pointsUsed",
        "cashPaidCents",
        "paymentId",
        "idempotencyKey",
        status,
        "requestedAt",
        "deliveredAt",
        "cancelledAt",
        notes
      )
      VALUES (
        ${redemptionId},
        ${params.orgId},
        ${params.userId},
        ${params.rewardItemId},
        1,
        ${calculation.pointsUsed},
        0,
        NULL,
        ${params.idempotencyKey},
        'APPROVED',
        NOW(),
        NULL,
        NULL,
        NULL
      )
      RETURNING *
    `;

    await debitPointsInTransaction(tx, {
      orgId: params.orgId,
      userId: params.userId,
      points: -Math.abs(calculation.pointsUsed),
      sourceType: "REDEMPTION",
      description: `Resgate aprovado automaticamente: ${rewardItem.name}`,
      referenceCode: `RDM-${redemptionId}`,
      createdBy: params.createdBy,
    });

    const stockUpdated = await tx.$executeRaw`
      UPDATE public."RewardItem"
      SET "stockQuantity" = "stockQuantity" - 1,
          "updatedAt" = NOW()
      WHERE id = ${rewardItem.id}
        AND "organizationId" = ${params.orgId}
        AND "stockQuantity" > 0
    `;

    if (stockUpdated !== 1) {
      throw new RedemptionServiceError("Item sem estoque para aprovacao do resgate.", 409);
    }

    return {
      redemption: approvedRows[0],
      paymentRequired: false,
      cashCents: 0,
    };
  });
}

export async function approveRedemptionAfterPayment(
  redemptionId: string,
  paymentId: string,
): Promise<RewardRedemptionRow> {
  return prisma.$transaction(async (tx) => {
    const redemptionRows = await tx.$queryRaw<RewardRedemptionRow[]>`
      SELECT *
      FROM public."RewardRedemption"
      WHERE id = ${redemptionId}
        AND status = 'PENDING_PAYMENT'
      LIMIT 1
      FOR UPDATE
    `;

    const redemption = redemptionRows[0];
    if (!redemption) {
      throw new RedemptionServiceError("Resgate pendente de pagamento nao encontrado.", 404);
    }

    const rewardRows = await tx.$queryRaw<RewardItemRow[]>`
      SELECT *
      FROM public."RewardItem"
      WHERE id = ${redemption.rewardItemId}
        AND "organizationId" = ${redemption.organizationId}
      LIMIT 1
      FOR UPDATE
    `;

    const rewardItem = rewardRows[0];
    if (!rewardItem || rewardItem.stockQuantity <= 0) {
      throw new RedemptionServiceError("Item sem estoque para aprovacao do resgate.", 409);
    }

    await debitPointsInTransaction(tx, {
      orgId: redemption.organizationId,
      userId: redemption.userId,
      points: -Math.abs(redemption.pointsUsed),
      sourceType: "REDEMPTION",
      description: `Debito de pontos por pagamento confirmado do resgate ${redemption.id}`,
      referenceCode: `RDM-${redemption.id}`,
      createdBy: redemption.userId,
    });

    const stockUpdated = await tx.$executeRaw`
      UPDATE public."RewardItem"
      SET "stockQuantity" = "stockQuantity" - 1,
          "updatedAt" = NOW()
      WHERE id = ${redemption.rewardItemId}
        AND "organizationId" = ${redemption.organizationId}
        AND "stockQuantity" > 0
    `;

    if (stockUpdated !== 1) {
      throw new RedemptionServiceError("Item sem estoque para aprovacao do resgate.", 409);
    }

    const updatedRows = await tx.$queryRaw<RewardRedemptionRow[]>`
      UPDATE public."RewardRedemption"
      SET status = 'APPROVED',
          "paymentId" = ${paymentId},
          "notes" = COALESCE("notes", 'Pagamento confirmado automaticamente'),
          "requestedAt" = "requestedAt"
      WHERE id = ${redemption.id}
      RETURNING *
    `;

    return updatedRows[0];
  });
}

export async function cancelRedemption(
  redemptionId: string,
  cancelledBy: string,
  notes?: string,
): Promise<RewardRedemptionRow> {
  const redemptionRows = await prisma.$queryRaw<RewardRedemptionRow[]>`
    SELECT *
    FROM public."RewardRedemption"
    WHERE id = ${redemptionId}
    LIMIT 1
  `;

  const redemption = redemptionRows[0];
  if (!redemption) {
    throw new RedemptionServiceError("Resgate nao encontrado.", 404);
  }

  if (redemption.status === "DELIVERED" || redemption.status === "CANCELLED") {
    throw new RedemptionServiceError(
      "Nao e possivel cancelar resgate entregue ou ja cancelado.",
      409,
    );
  }

  return prisma.$transaction(async (tx) => {
    if (redemption.status === "APPROVED" || redemption.status === "SEPARATED") {
      await creditPointsInTransaction(tx, {
        orgId: redemption.organizationId,
        userId: redemption.userId,
        points: Math.abs(redemption.pointsUsed),
        sourceType: "REFUND",
        description: `Estorno de pontos por cancelamento de resgate ${redemption.id}`,
        referenceCode: `RFD-${redemption.id}`,
        createdBy: cancelledBy,
      });

      await tx.$executeRaw`
        UPDATE public."RewardItem"
        SET "stockQuantity" = "stockQuantity" + 1,
            "updatedAt" = NOW()
        WHERE id = ${redemption.rewardItemId}
          AND "organizationId" = ${redemption.organizationId}
      `;
    }

    const updatedRows = await tx.$queryRaw<RewardRedemptionRow[]>`
      UPDATE public."RewardRedemption"
      SET status = 'CANCELLED',
          "cancelledAt" = NOW(),
          notes = ${notes ?? null}
      WHERE id = ${redemption.id}
      RETURNING *
    `;

    return updatedRows[0];
  });
}
