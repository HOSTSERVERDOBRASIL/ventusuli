import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

function canManageAthletes(role: UserRole): boolean {
  const value = String(role);
  return value === "ADMIN" || value === "MANAGER";
}

interface RouteParams {
  params: { id: string };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) {
    return apiError("FORBIDDEN", "Somente time administrativo pode excluir atletas.", 403);
  }

  const athlete = await prisma.user.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      role: "ATHLETE",
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          payments: true,
          financial_entries_subject: true,
          financial_entries_created: true,
        },
      },
    },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta não encontrado.", 404);

  if (
    athlete._count.payments > 0 ||
    athlete._count.financial_entries_subject > 0 ||
    athlete._count.financial_entries_created > 0
  ) {
    return apiError(
      "FORBIDDEN",
      "Este atleta possui histórico financeiro. Bloqueie o atleta para preservar auditoria e relatórios.",
      403,
    );
  }

  try {
    const affectedDistanceIds = await prisma.registration.findMany({
      where: {
        user_id: athlete.id,
        organization_id: auth.organizationId,
      },
      distinct: ["distance_id"],
      select: { distance_id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.organizationInvite.updateMany({
        where: {
          organization_id: auth.organizationId,
          accepted_user_id: athlete.id,
        },
        data: {
          accepted_user_id: null,
          accepted_at: null,
        },
      });

      await tx.organizationInvite.updateMany({
        where: {
          organization_id: auth.organizationId,
          created_by: athlete.id,
        },
        data: { created_by: null },
      });

      await tx.user.delete({
        where: { id: athlete.id },
      });

      for (const { distance_id: distanceId } of affectedDistanceIds) {
        const registeredCount = await tx.registration.count({
          where: { distance_id: distanceId },
        });

        await tx.eventDistance.update({
          where: { id: distanceId },
          data: { registered_count: registeredCount },
        });
      }
    });

    return NextResponse.json({
      data: {
        id: athlete.id,
        name: athlete.name,
        deleted: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return apiError("USER_NOT_FOUND", "Atleta não encontrado.", 404);
    }

    return apiError("INTERNAL_ERROR", "Não foi possível excluir atleta.", 500);
  }
}
