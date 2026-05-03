import { NextRequest, NextResponse } from "next/server";
import {
  AthleteRaceParticipationStatus,
  OrganizationRacePlanStatus,
  RacePlanAthleteAction,
} from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const participationSchema = z.object({
  status: z.nativeEnum(AthleteRaceParticipationStatus).optional(),
  distanceId: z.string().uuid().optional(),
  externalRegistrationUrl: z.string().url().optional(),
  externalRegistrationCode: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});

function defaultStatusForAction(action: RacePlanAthleteAction): AthleteRaceParticipationStatus {
  if (action === RacePlanAthleteAction.CONFIRM) return AthleteRaceParticipationStatus.CONFIRMED;
  if (action === RacePlanAthleteAction.EXTERNAL_LINK) {
    return AthleteRaceParticipationStatus.REGISTERED_EXTERNALLY;
  }
  if (action === RacePlanAthleteAction.TEAM_REGISTRATION) {
    return AthleteRaceParticipationStatus.IN_TEAM_REGISTRATION;
  }
  if (action === RacePlanAthleteAction.PAYMENT) {
    return AthleteRaceParticipationStatus.PENDING_PAYMENT;
  }
  if (action === RacePlanAthleteAction.INTERNAL_REGISTRATION) {
    return AthleteRaceParticipationStatus.CONFIRMED;
  }
  return AthleteRaceParticipationStatus.INTERESTED;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = participationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const input = parsed.data;
  const now = new Date();

  const plan = await prisma.organizationRacePlan.findFirst({
    where: {
      id: params.id,
      organizationId: auth.organizationId,
      status: OrganizationRacePlanStatus.OPEN_TO_ATHLETES,
      OR: [{ opensAt: null }, { opensAt: { lte: now } }],
      AND: [{ OR: [{ closesAt: null }, { closesAt: { gte: now } }] }],
    },
    include: {
      event: {
        select: {
          id: true,
          distances: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!plan) {
    return apiError("USER_NOT_FOUND", "Prova da assessoria nao encontrada ou fechada.", 404);
  }

  if (input.distanceId && !plan.event.distances.some((distance) => distance.id === input.distanceId)) {
    return apiError("VALIDATION_ERROR", "Distancia invalida para esta prova.", 400);
  }

  const status = input.status ?? defaultStatusForAction(plan.athleteAction);
  const participation = await prisma.athleteRaceParticipation.upsert({
    where: {
      racePlanId_userId: {
        racePlanId: plan.id,
        userId: auth.userId,
      },
    },
    create: {
      racePlanId: plan.id,
      organizationId: auth.organizationId,
      userId: auth.userId,
      distanceId: input.distanceId,
      status,
      externalRegistrationUrl: input.externalRegistrationUrl,
      externalRegistrationCode: input.externalRegistrationCode,
      note: input.note,
      cancelledAt: status === AthleteRaceParticipationStatus.CANCELLED ? now : null,
      attendedAt: status === AthleteRaceParticipationStatus.ATTENDED ? now : null,
    },
    update: {
      distanceId: input.distanceId,
      status,
      externalRegistrationUrl: input.externalRegistrationUrl,
      externalRegistrationCode: input.externalRegistrationCode,
      note: input.note,
      cancelledAt: status === AthleteRaceParticipationStatus.CANCELLED ? now : null,
      attendedAt: status === AthleteRaceParticipationStatus.ATTENDED ? now : null,
    },
  });

  return NextResponse.json({
    data: {
      id: participation.id,
      racePlanId: participation.racePlanId,
      status: participation.status,
      distanceId: participation.distanceId,
      externalRegistrationUrl: participation.externalRegistrationUrl,
      externalRegistrationCode: participation.externalRegistrationCode,
      note: participation.note,
      createdAt: participation.createdAt.toISOString(),
      updatedAt: participation.updatedAt.toISOString(),
    },
  });
}
