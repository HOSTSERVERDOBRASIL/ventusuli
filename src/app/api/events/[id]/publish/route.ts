import { NextRequest, NextResponse } from "next/server";
import { EventStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

function getAuthContext(req: NextRequest) {
  const role = req.headers.get("x-user-role") as UserRole | null;
  const organizationId = req.headers.get("x-org-id");

  if (!role || !organizationId) {
    return null;
  }

  return { role, organizationId };
}

function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

function prismaToApiError(error: unknown): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError("VALIDATION_ERROR", "Conflito de dados únicos.", 409);
    }
    if (error.code === "P2025") {
      return apiError("USER_NOT_FOUND", "Registro não encontrado.", 404);
    }
  }
  return apiError("INTERNAL_ERROR", "Erro interno ao publicar evento.", 500);
}

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) {
    return apiError("FORBIDDEN", "Apenas administradores podem publicar provas.", 403);
  }

  try {
    const event = await prisma.event.findFirst({
      where: {
        id: params.id,
        organization_id: auth.organizationId,
      },
      include: {
        distances: true,
      },
    });

    if (!event) {
      return apiError("USER_NOT_FOUND", "Prova não encontrada.", 404);
    }

    if (!event.name || event.name.trim().length < 3) {
      return apiError("VALIDATION_ERROR", "Nome da prova inválido para publicação.", 400);
    }
    if (!event.city || !event.state || !event.event_date) {
      return apiError("VALIDATION_ERROR", "Campos obrigatórios ausentes para publicação.", 400);
    }
    if (event.distances.length < 1) {
      return apiError("VALIDATION_ERROR", "Adicione ao menos uma distância para publicar.", 400);
    }

    const published = await prisma.event.update({
      where: { id: params.id },
      data: { status: EventStatus.PUBLISHED },
      include: { distances: { orderBy: { distance_km: "asc" } } },
    });

    return NextResponse.json({ data: published });
  } catch (error) {
    return prismaToApiError(error);
  }
}

