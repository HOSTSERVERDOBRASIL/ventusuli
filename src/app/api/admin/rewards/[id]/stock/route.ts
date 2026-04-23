import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

interface RewardItemRow {
  id: string;
  organizationId: string;
  stockQuantity: number;
  updatedAt: Date;
}

const bodySchema = z.object({
  adjustment: z.number().int(),
  reason: z.string().trim().min(3),
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const itemRows = await prisma.$queryRaw<RewardItemRow[]>`
    SELECT id, "organizationId", "stockQuantity", "updatedAt"
    FROM public."RewardItem"
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
    LIMIT 1
  `;

  const item = itemRows[0];
  if (!item) {
    return apiError("USER_NOT_FOUND", "Item de recompensa nao encontrado.", 404);
  }

  const nextStock = item.stockQuantity + parsed.data.adjustment;
  if (nextStock < 0) {
    return apiError("VALIDATION_ERROR", "Ajuste invalido: estoque nao pode ficar negativo.", 400);
  }

  const updatedRows = await prisma.$queryRaw`
    UPDATE public."RewardItem"
    SET "stockQuantity" = ${nextStock},
        "updatedAt" = NOW()
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
    RETURNING *
  `;

  return NextResponse.json({
    data: Array.isArray(updatedRows) ? updatedRows[0] : updatedRows,
    adjustmentReason: parsed.data.reason,
  });
}
