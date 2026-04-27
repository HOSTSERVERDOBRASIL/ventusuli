import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";

function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const event = await prisma.event.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
    },
    select: { id: true },
  });

  if (!event) {
    return apiError("USER_NOT_FOUND", "Prova não encontrada.", 404);
  }

  const registrations = await prisma.registration.findMany({
    where: {
      event_id: params.id,
      organization_id: auth.organizationId,
    },
    orderBy: { registered_at: "desc" },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      distance: {
        select: {
          label: true,
          price_cents: true,
        },
      },
      payment: {
        select: {
          status: true,
          amount_cents: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: registrations.map((registration) => ({
      registration_id: registration.id,
      athlete_name: registration.user.name,
      athlete_email: registration.user.email,
      distance_label: registration.distance.label,
      registration_status: registration.status,
      payment_status: registration.payment?.status ?? "PENDING",
      amount_cents: registration.payment?.amount_cents ?? registration.distance.price_cents,
      registered_at: registration.registered_at,
    })),
  });
}
