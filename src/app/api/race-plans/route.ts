import { NextRequest, NextResponse } from "next/server";
import { OrganizationRacePlanStatus, Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const racePlanInclude = {
  event: {
    include: {
      distances: {
        orderBy: { distance_km: "asc" },
      },
    },
  },
  participations: true,
} satisfies Prisma.OrganizationRacePlanInclude;

type RacePlanWithAthleteInclude = Prisma.OrganizationRacePlanGetPayload<{
  include: typeof racePlanInclude;
}>;

function toRacePlanDto(plan: RacePlanWithAthleteInclude, userId: string) {
  const myParticipation = plan.participations.find((participation) => participation.userId === userId);

  return {
    id: plan.id,
    eventId: plan.eventId,
    status: plan.status,
    athleteAction: plan.athleteAction,
    instructions: plan.instructions,
    logistics: plan.logistics,
    registrationUrl: plan.registrationUrl,
    opensAt: plan.opensAt?.toISOString() ?? null,
    closesAt: plan.closesAt?.toISOString() ?? null,
    event: {
      id: plan.event.id,
      name: plan.event.name,
      city: plan.event.city,
      state: plan.event.state,
      address: plan.event.address,
      eventDate: plan.event.event_date.toISOString(),
      registrationDeadline: plan.event.registration_deadline?.toISOString() ?? null,
      description: plan.event.description,
      imageUrl: plan.event.image_url,
      externalUrl: plan.event.external_url,
      distances: plan.event.distances.map((distance) => ({
        id: distance.id,
        label: distance.label,
        distanceKm: Number(distance.distance_km),
        priceCents: distance.price_cents,
        maxSlots: distance.max_slots,
        registeredCount: distance.registered_count,
      })),
    },
    myParticipation: myParticipation
      ? {
          id: myParticipation.id,
          status: myParticipation.status,
          distanceId: myParticipation.distanceId,
          registrationId: myParticipation.registrationId,
          externalRegistrationUrl: myParticipation.externalRegistrationUrl,
          externalRegistrationCode: myParticipation.externalRegistrationCode,
          note: myParticipation.note,
          createdAt: myParticipation.createdAt.toISOString(),
          updatedAt: myParticipation.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const now = new Date();
  const plans = await prisma.organizationRacePlan.findMany({
    where: {
      organizationId: auth.organizationId,
      status: OrganizationRacePlanStatus.OPEN_TO_ATHLETES,
      OR: [{ opensAt: null }, { opensAt: { lte: now } }],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }],
    },
    orderBy: [{ event: { event_date: "asc" } }, { createdAt: "asc" }],
    include: racePlanInclude,
  });

  return NextResponse.json({
    data: plans.map((plan) => toRacePlanDto(plan, auth.userId)),
  });
}
