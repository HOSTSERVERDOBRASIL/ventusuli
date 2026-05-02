import { NextRequest, NextResponse } from "next/server";
import { EventStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";

function isAdminRole(role: UserRole): boolean {
  const value = String(role);
  return (
    value === "ADMIN" ||
    value === "SUPER_ADMIN" ||
    value === "MANAGER" ||
    value === "ORGANIZER"
  );
}

function prismaToApiError(error: unknown): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return apiError("USER_NOT_FOUND", "Prova não encontrada.", 404);
  }
  return apiError("INTERNAL_ERROR", "Erro interno ao duplicar prova.", 500);
}

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role))
    return apiError("FORBIDDEN", "Apenas administradores podem duplicar provas.", 403);

  try {
    const source = await prisma.event.findFirst({
      where: {
        id: params.id,
        organization_id: auth.organizationId,
      },
      include: {
        distances: {
          orderBy: { distance_km: "asc" },
        },
      },
    });

    if (!source) {
      return apiError("USER_NOT_FOUND", "Prova não encontrada.", 404);
    }

    const duplicatedId = await prisma.$transaction(async (tx) => {
      const duplicated = await tx.event.create({
        data: {
          organization_id: auth.organizationId,
          created_by: auth.userId,
          name: `${source.name} - Copia`,
          city: source.city,
          state: source.state,
          address: source.address,
          latitude: source.latitude,
          longitude: source.longitude,
          check_in_radius_m: source.check_in_radius_m,
          proximity_radius_m: source.proximity_radius_m,
          event_date: source.event_date,
          registration_deadline: source.registration_deadline,
          description: source.description,
          image_url: source.image_url,
          external_url: source.external_url,
          status: EventStatus.DRAFT,
        },
        select: { id: true },
      });

      if (source.distances.length > 0) {
        await tx.eventDistance.createMany({
          data: source.distances.map((distance) => ({
            event_id: duplicated.id,
            label: distance.label,
            distance_km: distance.distance_km,
            price_cents: distance.price_cents,
            max_slots: distance.max_slots,
          })),
        });
      }

      return duplicated.id;
    });

    const duplicated = await prisma.event.findUnique({
      where: { id: duplicatedId },
      include: {
        distances: { orderBy: { distance_km: "asc" } },
      },
    });

    return NextResponse.json({ data: duplicated }, { status: 201 });
  } catch (error) {
    return prismaToApiError(error);
  }
}
