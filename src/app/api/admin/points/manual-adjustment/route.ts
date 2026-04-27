import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { creditPoints, debitPoints } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const bodySchema = z.object({
  userId: z.string().min(1),
  points: z.number().int().refine((value) => value !== 0, "points deve ser diferente de zero"),
  reason: z.string().trim().min(3),
  type: z.enum(["CREDIT", "DEBIT", "ADJUSTMENT"]),
});

export async function POST(req: NextRequest) {
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

  const targetUser = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      organization_id: auth.organizationId,
    },
    select: { id: true },
  });

  if (!targetUser) {
    return apiError("USER_NOT_FOUND", "Atleta nao encontrado.", 404);
  }

  const referenceCode = `MANUAL-${Date.now()}-${parsed.data.userId}`;
  const description = `[${parsed.data.type}] ${parsed.data.reason}`;

  try {
    const result =
      parsed.data.points > 0
        ? await creditPoints({
            orgId: auth.organizationId,
            userId: parsed.data.userId,
            sourceType: "MANUAL",
            points: parsed.data.points,
            description,
            referenceCode,
            createdBy: auth.userId,
          })
        : await debitPoints({
            orgId: auth.organizationId,
            userId: parsed.data.userId,
            sourceType: "MANUAL",
            points: parsed.data.points,
            description,
            referenceCode,
            createdBy: auth.userId,
          });

    return NextResponse.json({ data: result.entry, created: result.created });
  } catch (error) {
    if (error instanceof Error && error.message === "points_balance_cannot_be_negative") {
      return apiError("VALIDATION_ERROR", "Ajuste nao permitido: o saldo do atleta nao pode ficar negativo.", 400);
    }
    return apiError("INTERNAL_ERROR", "Nao foi possivel processar ajuste manual.", 500);
  }
}
