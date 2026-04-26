import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  cpf: z.string().trim().min(11).max(14).optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
});

function canViewAthletes(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.COACH;
}

function canManageAthletes(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

function getInternalNote(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const note = (value as Record<string, unknown>).internal_note;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}

function resolveAthleteStatus(
  profileStatus: unknown,
  accountStatus: string,
): "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED" {
  if (
    profileStatus === "PENDING_APPROVAL" ||
    profileStatus === "ACTIVE" ||
    profileStatus === "REJECTED" ||
    profileStatus === "BLOCKED"
  ) {
    return profileStatus;
  }
  if (accountStatus === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (accountStatus === "SUSPENDED") return "BLOCKED";
  return "ACTIVE";
}

interface RouteParams {
  params: { id: string };
}

async function loadAthlete(organizationId: string, athleteId: string) {
  return prisma.user.findFirst({
    where: {
      id: athleteId,
      organization_id: organizationId,
      role: UserRole.ATHLETE,
    },
    include: {
      athlete_profile: true,
      registrations: {
        where: { organization_id: organizationId },
        orderBy: { registered_at: "desc" },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              event_date: true,
              city: true,
              state: true,
              status: true,
            },
          },
          distance: {
            select: {
              id: true,
              label: true,
              distance_km: true,
              price_cents: true,
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              amount_cents: true,
              created_at: true,
              paid_at: true,
            },
          },
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canViewAthletes(auth.role))
    return apiError("FORBIDDEN", "Acesso restrito a equipe tecnica.", 403);

  const athlete = await loadAthlete(auth.organizationId, params.id);
  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta não encontrado.", 404);
  const athleteStatus = resolveAthleteStatus(
    athlete.athlete_profile?.athlete_status,
    athlete.account_status,
  );

  const totalPaidCents = athlete.registrations.reduce(
    (sum, registration) =>
      sum + (registration.payment?.status === "PAID" ? registration.payment.amount_cents : 0),
    0,
  );
  const totalPendingCents = athlete.registrations.reduce(
    (sum, registration) =>
      sum + (registration.payment?.status === "PENDING" ? registration.payment.amount_cents : 0),
    0,
  );

  const nextRegistration =
    athlete.registrations
      .filter((registration) => new Date(registration.event.event_date) >= new Date())
      .sort(
        (a, b) => new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime(),
      )[0] ?? null;

  return NextResponse.json({
    data: {
      id: athlete.id,
      name: athlete.name,
      email: athlete.email,
      role: athlete.role,
      profile: {
        cpf: athlete.athlete_profile?.cpf ?? null,
        memberNumber: athlete.athlete_profile?.member_number ?? null,
        memberSince: athlete.athlete_profile?.member_since ?? null,
        signupSource: athlete.athlete_profile?.signup_source ?? null,
        phone: athlete.athlete_profile?.phone ?? null,
        city: athlete.athlete_profile?.city ?? null,
        state: athlete.athlete_profile?.state ?? null,
        internalNote: getInternalNote(athlete.athlete_profile?.emergency_contact),
        athleteStatus,
        approvalPending: athleteStatus === "PENDING_APPROVAL",
      },
      summary: {
        registrationsCount: athlete.registrations.length,
        paidAmountCents: totalPaidCents,
        pendingAmountCents: totalPendingCents,
        nextEventName: nextRegistration?.event.name ?? null,
        nextEventDate: nextRegistration?.event.event_date ?? null,
      },
      registrations: athlete.registrations.map((registration) => ({
        id: registration.id,
        status: registration.status,
        registeredAt: registration.registered_at,
        event: {
          id: registration.event.id,
          name: registration.event.name,
          eventDate: registration.event.event_date,
          city: registration.event.city,
          state: registration.event.state,
          status: registration.event.status,
        },
        distance: {
          id: registration.distance.id,
          label: registration.distance.label,
          distanceKm: Number(registration.distance.distance_km),
          priceCents: registration.distance.price_cents,
        },
        payment: registration.payment
          ? {
              id: registration.payment.id,
              status: registration.payment.status,
              amountCents: registration.payment.amount_cents,
              createdAt: registration.payment.created_at,
              paidAt: registration.payment.paid_at,
            }
          : null,
      })),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const current = await prisma.user.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      role: UserRole.ATHLETE,
    },
    select: { id: true },
  });

  if (!current) return apiError("USER_NOT_FOUND", "Atleta não encontrado.", 404);

  const input = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      if (input.name !== undefined || input.email !== undefined) {
        await tx.user.update({
          where: { id: params.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
          },
        });
      }

      if (
        input.cpf !== undefined ||
        input.phone !== undefined ||
        input.city !== undefined ||
        input.state !== undefined
      ) {
        await tx.athleteProfile.upsert({
          where: { user_id: params.id },
          update: {
            ...(input.cpf !== undefined ? { cpf: input.cpf } : {}),
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.city !== undefined ? { city: input.city } : {}),
            ...(input.state !== undefined ? { state: input.state } : {}),
          },
          create: {
            user_id: params.id,
            organization_id: auth.organizationId,
            cpf: input.cpf ?? null,
            phone: input.phone ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
          },
        });
      }
    });

    const athlete = await loadAthlete(auth.organizationId, params.id);
    if (!athlete) return apiError("USER_NOT_FOUND", "Atleta não encontrado.", 404);

    return NextResponse.json({
      data: { id: athlete.id, name: athlete.name, email: athlete.email },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError("VALIDATION_ERROR", "Email já utilizado por outro usuário.", 409);
    }
    return apiError("INTERNAL_ERROR", "Não foi possível atualizar atleta.", 500);
  }
}
