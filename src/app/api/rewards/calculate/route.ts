import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { calculateRedemption, RewardItem } from "@/lib/points/redemptionCalculator";
import { getUserPointsBalance } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

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

const bodySchema = z.object({
  rewardItemId: z.string().min(1),
  pointsToUse: z.number().int().min(0).optional(),
});

function toCalculatorInput(item: RewardItemRow): RewardItem {
  return {
    cashPriceCents: item.cashPriceCents,
    pointsCost: item.pointsCost,
    maxPointsDiscountPercent: item.maxPointsDiscountPercent,
    minimumCashCents: item.minimumCashCents,
    allowMixed: item.allowMixed,
    allowPoints: item.allowPoints,
    active: item.active,
    stockQuantity: item.stockQuantity,
  };
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const itemRows = await prisma.$queryRaw<RewardItemRow[]>`
    SELECT *
    FROM public."RewardItem"
    WHERE id = ${parsed.data.rewardItemId}
      AND "organizationId" = ${auth.organizationId}
    LIMIT 1
  `;

  const item = itemRows[0];
  if (!item) {
    return apiError("USER_NOT_FOUND", "Item de recompensa nao encontrado.", 404);
  }

  const balance = await getUserPointsBalance(auth.userId, auth.organizationId);
  const calculation = calculateRedemption(toCalculatorInput(item), balance.balance, parsed.data.pointsToUse);

  return NextResponse.json({
    data: {
      ...calculation,
      item,
      currentBalance: balance.balance,
    },
  });
}
