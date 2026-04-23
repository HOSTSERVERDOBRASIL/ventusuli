import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, RegistrationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const createSchema = z.object({
  eventId: z.string().uuid(),
  distanceId: z.string().uuid(),
});

function canManageAthletes(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

interface RouteParams {
  params: { id: string };
}

function buildTxId(registrationId: string): string {
  return `VS-${registrationId.replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const athlete = await prisma.user.findFirst({
    where: { id: params.id, organization_id: auth.organizationId, role: UserRole.ATHLETE },
    select: { id: true },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta não encontrado.", 404);

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      organization_id: auth.organizationId,
      status: "PUBLISHED",
    },
    include: {
      distances: {
        where: { id: parsed.data.distanceId },
      },
    },
  });

  if (!event) return apiError("USER_NOT_FOUND", "Prova não encontrada.", 404);

  const distance = event.distances[0];
  if (!distance) return apiError("VALIDATION_ERROR", "Distância inválida para esta prova.", 400);

  if (event.registration_deadline && event.registration_deadline < new Date()) {
    return apiError("FORBIDDEN", "Periodo de inscrição encerrado.", 403);
  }

  if (distance.max_slots && distance.registered_count >= distance.max_slots) {
    return apiError("FORBIDDEN", "Distância sem vagas disponíveis.", 403);
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.registration.findUnique({
      where: {
        user_id_event_id_distance_id: {
          user_id: params.id,
          event_id: event.id,
          distance_id: distance.id,
        },
      },
      include: {
        payment: true,
      },
    });

    if (existing) {
      if (!existing.payment) {
        await tx.payment.create({
          data: {
            registration_id: existing.id,
            user_id: params.id,
            organization_id: auth.organizationId,
            amount_cents: distance.price_cents,
            fee_cents: 0,
            net_cents: distance.price_cents,
            status: PaymentStatus.PENDING,
            efi_tx_id: buildTxId(existing.id),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      await tx.registration.update({
        where: { id: existing.id },
        data: { status: RegistrationStatus.PENDING_PAYMENT },
      });

      return existing.id;
    }

    const created = await tx.registration.create({
      data: {
        user_id: params.id,
        organization_id: auth.organizationId,
        event_id: event.id,
        distance_id: distance.id,
        status: RegistrationStatus.PENDING_PAYMENT,
      },
      select: { id: true },
    });

    await tx.payment.create({
      data: {
        registration_id: created.id,
        user_id: params.id,
        organization_id: auth.organizationId,
        amount_cents: distance.price_cents,
        fee_cents: 0,
        net_cents: distance.price_cents,
        status: PaymentStatus.PENDING,
        efi_tx_id: buildTxId(created.id),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await tx.eventDistance.update({
      where: { id: distance.id },
      data: { registered_count: { increment: 1 } },
    });

    return created.id;
  });

  return NextResponse.json({ data: { registrationId: result } }, { status: 201 });
}
