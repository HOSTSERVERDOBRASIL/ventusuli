import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

function canManageRacePlans(role: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "ORGANIZER";
}

export async function GET(req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageRacePlans(auth.role)) {
    return apiError("FORBIDDEN", "Apenas administradores podem acompanhar a agenda da assessoria.", 403);
  }

  const plan = await prisma.organizationRacePlan.findFirst({
    where: {
      eventId: params.eventId,
      organizationId: auth.organizationId,
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          event_date: true,
          city: true,
          state: true,
        },
      },
      participations: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          distance: {
            select: {
              id: true,
              label: true,
              distance_km: true,
            },
          },
          registration: {
            select: {
              id: true,
              status: true,
              payment: {
                select: {
                  status: true,
                  amount_cents: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!plan) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      id: plan.id,
      eventId: plan.eventId,
      status: plan.status,
      athleteAction: plan.athleteAction,
      instructions: plan.instructions,
      registrationUrl: plan.registrationUrl,
      opensAt: plan.opensAt?.toISOString() ?? null,
      closesAt: plan.closesAt?.toISOString() ?? null,
      event: {
        id: plan.event.id,
        name: plan.event.name,
        eventDate: plan.event.event_date.toISOString(),
        city: plan.event.city,
        state: plan.event.state,
      },
      participations: plan.participations.map((participation) => ({
        id: participation.id,
        status: participation.status,
        athleteName: participation.user.name,
        athleteEmail: participation.user.email,
        distanceLabel: participation.distance?.label ?? null,
        distanceKm: participation.distance ? Number(participation.distance.distance_km) : null,
        registrationId: participation.registrationId,
        registrationStatus: participation.registration?.status ?? null,
        paymentStatus: participation.registration?.payment?.status ?? null,
        amountCents: participation.registration?.payment?.amount_cents ?? null,
        externalRegistrationUrl: participation.externalRegistrationUrl,
        externalRegistrationCode: participation.externalRegistrationCode,
        note: participation.note,
        createdAt: participation.createdAt.toISOString(),
        updatedAt: participation.updatedAt.toISOString(),
      })),
    },
  });
}
