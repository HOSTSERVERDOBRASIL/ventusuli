import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { cancelRedemption, RedemptionServiceError } from "@/lib/points/redemptionService";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const statusSchema = z.object({
  status: z.enum(["REQUESTED", "PENDING_PAYMENT", "APPROVED", "SEPARATED", "DELIVERED", "CANCELLED", "PAYMENT_FAILED"]),
  notes: z.string().trim().max(1000).optional(),
});

interface RouteParams {
  params: { id: string };
}

interface RedemptionRow {
  id: string;
  organizationId: string;
  status: "REQUESTED" | "PENDING_PAYMENT" | "APPROVED" | "SEPARATED" | "DELIVERED" | "CANCELLED" | "PAYMENT_FAILED";
}

function isTransitionAllowed(current: RedemptionRow["status"], next: RedemptionRow["status"]): boolean {
  if (next === "CANCELLED") return current !== "DELIVERED";
  if (current === "APPROVED" && next === "SEPARATED") return true;
  if (current === "SEPARATED" && next === "DELIVERED") return true;
  return false;
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

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const redemptionRows = await prisma.$queryRaw<RedemptionRow[]>`
    SELECT id, "organizationId", status
    FROM public."RewardRedemption"
    WHERE id = ${params.id}
      AND "organizationId" = ${auth.organizationId}
    LIMIT 1
  `;

  const current = redemptionRows[0];
  if (!current) return apiError("USER_NOT_FOUND", "Resgate nao encontrado.", 404);

  const nextStatus = parsed.data.status;
  if (!isTransitionAllowed(current.status, nextStatus)) {
    return apiError("VALIDATION_ERROR", "Transicao de status invalida.", 400);
  }

  if (nextStatus === "CANCELLED") {
    try {
      const cancelled = await cancelRedemption(current.id, auth.userId, parsed.data.notes);
      return NextResponse.json({ data: cancelled });
    } catch (error) {
      if (error instanceof RedemptionServiceError) {
        const statusCode = Number.isFinite(error.statusCode) ? error.statusCode : 400;
        if (statusCode === 404) return apiError("USER_NOT_FOUND", error.message, 404);
        return apiError("VALIDATION_ERROR", error.message, statusCode);
      }
      return apiError("INTERNAL_ERROR", "Nao foi possivel cancelar resgate.", 500);
    }
  }

  const updatedRows = await prisma.$queryRaw`
    UPDATE public."RewardRedemption"
    SET status = ${nextStatus},
        "deliveredAt" = ${nextStatus === "DELIVERED" ? new Date() : null},
        notes = ${parsed.data.notes ?? null}
    WHERE id = ${current.id}
      AND "organizationId" = ${auth.organizationId}
    RETURNING *
  `;

  return NextResponse.json({ data: Array.isArray(updatedRows) ? updatedRows[0] : updatedRows });
}
