import { NextRequest, NextResponse } from "next/server";
import {
  AthleteRaceParticipationStatus,
  OrganizationRacePlanStatus,
  Prisma,
  RacePlanAthleteAction,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const listQuerySchema = z.object({
  status: z.nativeEnum(OrganizationRacePlanStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const upsertRacePlanSchema = z.object({
  eventId: z.string().uuid(),
  externalEventId: z.string().optional(),
  status: z.nativeEnum(OrganizationRacePlanStatus).default(OrganizationRacePlanStatus.PLANNED),
  athleteAction: z.nativeEnum(RacePlanAthleteAction).default(RacePlanAthleteAction.INTEREST),
  audience: z.record(z.unknown()).optional(),
  instructions: z.string().trim().max(5000).optional(),
  logistics: z.record(z.unknown()).optional(),
  registrationUrl: z.string().url().optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
});

function canManageRacePlans(role: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "ORGANIZER";
}

const racePlanInclude = {
  event: {
    include: {
      distances: {
        orderBy: { distance_km: "asc" },
      },
    },
  },
  participations: {
    select: {
      status: true,
    },
  },
} satisfies Prisma.OrganizationRacePlanInclude;

type RacePlanWithAdminInclude = Prisma.OrganizationRacePlanGetPayload<{
  include: typeof racePlanInclude;
}>;

function toPlanDto(plan: RacePlanWithAdminInclude) {
  const counts = plan.participations.reduce(
    (acc, participation) => {
      acc.total += 1;
      acc[participation.status] = (acc[participation.status] ?? 0) + 1;
      return acc;
    },
    { total: 0 } as Record<AthleteRaceParticipationStatus | "total", number>,
  );

  return {
    id: plan.id,
    eventId: plan.eventId,
    externalEventId: plan.externalEventId,
    status: plan.status,
    athleteAction: plan.athleteAction,
    audience: plan.audience,
    instructions: plan.instructions,
    logistics: plan.logistics,
    registrationUrl: plan.registrationUrl,
    opensAt: plan.opensAt?.toISOString() ?? null,
    closesAt: plan.closesAt?.toISOString() ?? null,
    publishedAt: plan.publishedAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    event: {
      id: plan.event.id,
      name: plan.event.name,
      city: plan.event.city,
      state: plan.event.state,
      eventDate: plan.event.event_date.toISOString(),
      status: plan.event.status,
      externalUrl: plan.event.external_url,
      distances: plan.event.distances.map((distance) => ({
        id: distance.id,
        label: distance.label,
        distanceKm: Number(distance.distance_km),
        priceCents: distance.price_cents,
      })),
    },
    participationCounts: counts,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageRacePlans(auth.role)) {
    return apiError("FORBIDDEN", "Apenas administradores podem gerenciar a agenda da assessoria.", 403);
  }

  const parsed = listQuerySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const plans = await prisma.organizationRacePlan.findMany({
    where: {
      organizationId: auth.organizationId,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    take: parsed.data.limit,
    orderBy: [{ status: "asc" }, { event: { event_date: "asc" } }],
    include: racePlanInclude,
  });

  return NextResponse.json({ data: plans.map(toPlanDto) });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageRacePlans(auth.role)) {
    return apiError("FORBIDDEN", "Apenas administradores podem gerenciar a agenda da assessoria.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = upsertRacePlanSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const input = parsed.data;

  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      organization_id: auth.organizationId,
    },
    select: { id: true },
  });

  if (!event) return apiError("USER_NOT_FOUND", "Prova nao encontrada nesta assessoria.", 404);

  if (input.externalEventId) {
    const externalEvent = await prisma.externalEvent.findFirst({
      where: {
        id: input.externalEventId,
        organizationId: auth.organizationId,
      },
      select: { id: true },
    });

    if (!externalEvent) {
      return apiError("USER_NOT_FOUND", "Prova externa nao encontrada nesta assessoria.", 404);
    }
  }

  const now = new Date();
  const publishedAt =
    input.status === OrganizationRacePlanStatus.OPEN_TO_ATHLETES ? now : undefined;

  const plan = await prisma.organizationRacePlan.upsert({
    where: {
      organizationId_eventId: {
        organizationId: auth.organizationId,
        eventId: input.eventId,
      },
    },
    create: {
      organizationId: auth.organizationId,
      eventId: input.eventId,
      externalEventId: input.externalEventId,
      createdBy: auth.userId,
      status: input.status,
      athleteAction: input.athleteAction,
      audience: input.audience as Prisma.InputJsonValue | undefined,
      instructions: input.instructions,
      logistics: input.logistics as Prisma.InputJsonValue | undefined,
      registrationUrl: input.registrationUrl,
      opensAt: input.opensAt ? new Date(input.opensAt) : null,
      closesAt: input.closesAt ? new Date(input.closesAt) : null,
      publishedAt,
    },
    update: {
      externalEventId: input.externalEventId,
      status: input.status,
      athleteAction: input.athleteAction,
      audience: input.audience as Prisma.InputJsonValue | undefined,
      instructions: input.instructions,
      logistics: input.logistics as Prisma.InputJsonValue | undefined,
      registrationUrl: input.registrationUrl,
      opensAt: input.opensAt ? new Date(input.opensAt) : null,
      closesAt: input.closesAt ? new Date(input.closesAt) : null,
      ...(publishedAt ? { publishedAt } : {}),
    },
    include: racePlanInclude,
  });

  return NextResponse.json({ data: toPlanDto(plan) }, { status: 201 });
}
