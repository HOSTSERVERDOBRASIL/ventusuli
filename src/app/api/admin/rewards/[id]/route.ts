import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";
import { isAllowedImageUrl } from "@/lib/storage/image-url";

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

const patchSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    category: z.string().trim().min(1).optional(),
    imageUrl: z
      .string()
      .trim()
      .min(1)
      .refine((value) => isAllowedImageUrl(value), {
        message: "Imagem da recompensa invalida. Use upload oficial ou URL http/https.",
      })
      .optional()
      .nullable(),
    pointsCost: z.number().int().min(0).optional(),
    cashPriceCents: z.number().int().min(0).optional(),
    allowPoints: z.boolean().optional(),
    allowCash: z.boolean().optional(),
    allowMixed: z.boolean().optional(),
    maxPointsDiscountPercent: z.number().int().min(0).max(100).optional(),
    minimumCashCents: z.number().int().min(0).optional(),
    stockQuantity: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nenhum campo enviado para atualizacao.");

function validateRewardPolicy(value: {
  allowPoints: boolean;
  allowCash: boolean;
  allowMixed: boolean;
  minimumCashCents: number;
  cashPriceCents: number;
}): string | null {
  if (!value.allowPoints && !value.allowCash) {
    return "Informe pelo menos uma forma de resgate: pontos ou PIX.";
  }
  if (value.allowMixed && (!value.allowPoints || !value.allowCash)) {
    return "Resgate misto exige pontos e PIX habilitados.";
  }
  if (value.minimumCashCents > value.cashPriceCents) {
    return "Valor minimo em PIX nao pode superar o preco do produto.";
  }
  return null;
}

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const existing = await prisma.$queryRaw<RewardItemRow[]>`
    SELECT *
    FROM public."RewardItem"
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
    LIMIT 1
  `;

  if (!existing[0]) {
    return apiError("USER_NOT_FOUND", "Item de recompensa nao encontrado.", 404);
  }

  const current = existing[0];
  const patch = parsed.data;
  const policyError = validateRewardPolicy({
    allowPoints: patch.allowPoints ?? current.allowPoints,
    allowCash: patch.allowCash ?? current.allowCash,
    allowMixed: patch.allowMixed ?? current.allowMixed,
    minimumCashCents: patch.minimumCashCents ?? current.minimumCashCents,
    cashPriceCents: patch.cashPriceCents ?? current.cashPriceCents,
  });

  if (policyError) {
    return apiError("VALIDATION_ERROR", policyError, 400);
  }

  const updatedRows = await prisma.$queryRaw<RewardItemRow[]>(Prisma.sql`
    UPDATE public."RewardItem"
    SET
      name = ${patch.name ?? current.name},
      description = ${patch.description !== undefined ? patch.description : current.description},
      category = ${patch.category ?? current.category},
      "imageUrl" = ${patch.imageUrl !== undefined ? patch.imageUrl : current.imageUrl},
      "pointsCost" = ${patch.pointsCost ?? current.pointsCost},
      "cashPriceCents" = ${patch.cashPriceCents ?? current.cashPriceCents},
      "allowPoints" = ${patch.allowPoints ?? current.allowPoints},
      "allowCash" = ${patch.allowCash ?? current.allowCash},
      "allowMixed" = ${patch.allowMixed ?? current.allowMixed},
      "maxPointsDiscountPercent" = ${patch.maxPointsDiscountPercent ?? current.maxPointsDiscountPercent},
      "minimumCashCents" = ${patch.minimumCashCents ?? current.minimumCashCents},
      "stockQuantity" = ${patch.stockQuantity ?? current.stockQuantity},
      active = ${patch.active ?? current.active},
      "updatedAt" = NOW()
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
    RETURNING *
  `);

  return NextResponse.json({ data: updatedRows[0] });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const updatedRows = await prisma.$queryRaw<RewardItemRow[]>`
    UPDATE public."RewardItem"
    SET active = false,
        "updatedAt" = NOW()
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
    RETURNING *
  `;

  if (!updatedRows[0]) {
    return apiError("USER_NOT_FOUND", "Item de recompensa nao encontrado.", 404);
  }

  return NextResponse.json({ data: updatedRows[0] });
}
