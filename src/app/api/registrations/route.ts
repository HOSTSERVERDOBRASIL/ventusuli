import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, Prisma, RegistrationStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { notifyPaymentPending } from "@/lib/notifications/domain-events";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const createRegistrationSchema = z.object({
  eventId: z.string().uuid(),
  distanceId: z.string().uuid(),
});

function toTxId(registrationId: string): string {
  return `VS-${registrationId.replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const registrations = await prisma.registration.findMany({
    where: {
      user_id: auth.userId,
      organization_id: auth.organizationId,
    },
    orderBy: { registered_at: "desc" },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          check_in_radius_m: true,
          proximity_radius_m: true,
          event_date: true,
        },
      },
      distance: {
        select: {
          id: true,
          label: true,
          price_cents: true,
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          amount_cents: true,
        },
      },
    },
  });

  const data = registrations.map((registration) => ({
    id: registration.id,
    eventId: registration.event.id,
    eventName: registration.event.name,
    eventDate: registration.event.event_date.toISOString(),
    eventAddress: registration.event.address,
    eventLatitude: registration.event.latitude ? Number(registration.event.latitude) : null,
    eventLongitude: registration.event.longitude ? Number(registration.event.longitude) : null,
    checkInRadiusM: registration.event.check_in_radius_m,
    proximityRadiusM: registration.event.proximity_radius_m,
    distanceId: registration.distance.id,
    distanceLabel: registration.distance.label,
    status: registration.status,
    paymentStatus: registration.payment?.status ?? PaymentStatus.PENDING,
    amountCents: registration.payment?.amount_cents ?? registration.distance.price_cents,
    attendanceStatus: registration.attendance_status,
    checkInAt: registration.check_in_at?.toISOString() ?? null,
    checkInDistanceM: registration.check_in_distance_m,
    checkOutAt: registration.check_out_at?.toISOString() ?? null,
    checkOutDistanceM: registration.check_out_distance_m,
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body inválido.", 400);
  }

  const parsed = createRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados inválidos.", 400);
  }

  const { eventId, distanceId } = parsed.data;

  // CPF is required before any registration — checked here so the frontend
  // can redirect the athlete to /perfil with a clear message.
  const athleteProfile = await prisma.athleteProfile.findUnique({
    where: { user_id: auth.userId },
    select: { cpf: true },
  });

  if (!athleteProfile?.cpf) {
    return apiError(
      "FORBIDDEN",
      "CPF obrigatório para realizar inscrição. Complete seu perfil antes de continuar.",
      403,
    );
  }

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organization_id: auth.organizationId,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      event_date: true,
      registration_deadline: true,
      distances: {
        where: { id: distanceId },
        select: {
          id: true,
          label: true,
          price_cents: true,
          max_slots: true,
          registered_count: true,
        },
      },
    },
  });

  if (!event) return apiError("USER_NOT_FOUND", "Prova não encontrada.", 404);

  const distance = event.distances[0];
  if (!distance) return apiError("VALIDATION_ERROR", "Distância inválida para esta prova.", 400);

  if (event.registration_deadline && event.registration_deadline < new Date()) {
    return apiError("FORBIDDEN", "Período de inscrição encerrado.", 403);
  }

  if (distance.max_slots && distance.registered_count >= distance.max_slots) {
    return apiError("FORBIDDEN", "Distância sem vagas disponíveis.", 403);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.registration.findUnique({
        where: {
          user_id_event_id_distance_id: {
            user_id: auth.userId,
            event_id: eventId,
            distance_id: distance.id,
          },
        },
        include: {
          payment: {
            select: {
              id: true,
              status: true,
              amount_cents: true,
              expires_at: true,
            },
          },
          event: {
            select: {
              id: true,
              name: true,
              event_date: true,
            },
          },
          distance: {
            select: {
              id: true,
              label: true,
              price_cents: true,
            },
          },
        },
      });

      if (existing) {
        // Reopen canceled/interested registrations so the athlete can continue
        // the critical flow without manual cleanup.
        if (
          existing.status === RegistrationStatus.CANCELLED ||
          existing.status === RegistrationStatus.INTERESTED
        ) {
          const reopened = await tx.registration.update({
            where: { id: existing.id },
            data: { status: RegistrationStatus.PENDING_PAYMENT },
            include: {
              event: {
                select: {
                  id: true,
                  name: true,
                  event_date: true,
                },
              },
              distance: {
                select: {
                  id: true,
                  label: true,
                  price_cents: true,
                },
              },
              payment: {
                select: {
                  id: true,
                  status: true,
                  amount_cents: true,
                  expires_at: true,
                },
              },
            },
          });

          const refreshedPayment = reopened.payment
            ? await tx.payment.update({
                where: { id: reopened.payment.id },
                data: {
                  status: PaymentStatus.PENDING,
                  paid_at: null,
                  expires_at: new Date(Date.now() + 15 * 60 * 1000),
                },
                select: {
                  id: true,
                  status: true,
                  amount_cents: true,
                  expires_at: true,
                },
              })
            : await tx.payment.create({
                data: {
                  registration_id: reopened.id,
                  user_id: auth.userId,
                  organization_id: auth.organizationId,
                  amount_cents: distance.price_cents,
                  fee_cents: 0,
                  net_cents: distance.price_cents,
                  status: PaymentStatus.PENDING,
                  efi_tx_id: toTxId(reopened.id),
                  expires_at: new Date(Date.now() + 15 * 60 * 1000),
                },
                select: {
                  id: true,
                  status: true,
                  amount_cents: true,
                  expires_at: true,
                },
              });

          await tx.eventDistance.update({
            where: { id: distance.id },
            data: { registered_count: { increment: 1 } },
          });

          return {
            registration: {
              ...reopened,
              payment: refreshedPayment,
            },
            created: false,
          };
        }

        return {
          registration: existing,
          created: false,
        };
      }

      const registration = await tx.registration.create({
        data: {
          user_id: auth.userId,
          event_id: eventId,
          distance_id: distance.id,
          organization_id: auth.organizationId,
          status: RegistrationStatus.PENDING_PAYMENT,
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              event_date: true,
            },
          },
          distance: {
            select: {
              id: true,
              label: true,
              price_cents: true,
            },
          },
        },
      });

      const payment = await tx.payment.create({
        data: {
          registration_id: registration.id,
          user_id: auth.userId,
          organization_id: auth.organizationId,
          amount_cents: distance.price_cents,
          fee_cents: 0,
          net_cents: distance.price_cents,
          status: PaymentStatus.PENDING,
          efi_tx_id: toTxId(registration.id),
          expires_at: new Date(Date.now() + 15 * 60 * 1000),
        },
        select: {
          id: true,
          status: true,
          amount_cents: true,
          expires_at: true,
        },
      });

      await tx.eventDistance.update({
        where: { id: distance.id },
        data: { registered_count: { increment: 1 } },
      });

      return {
        registration: {
          ...registration,
          payment,
        },
        created: true,
      };
    });

    const payload = {
      id: result.registration.id,
      eventId: result.registration.event.id,
      eventName: result.registration.event.name,
      eventDate: result.registration.event.event_date.toISOString(),
      distanceId: result.registration.distance.id,
      distanceLabel: result.registration.distance.label,
      status: result.registration.status,
      paymentStatus: result.registration.payment?.status ?? PaymentStatus.PENDING,
      amountCents:
        result.registration.payment?.amount_cents ?? result.registration.distance.price_cents,
    };

    if (result.registration.payment?.status === PaymentStatus.PENDING) {
      await notifyPaymentPending(prisma, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        registrationId: result.registration.id,
        eventName: result.registration.event.name,
        dueDate: result.registration.payment.expires_at ?? new Date(Date.now() + 15 * 60 * 1000),
        amountCents:
          result.registration.payment.amount_cents ?? result.registration.distance.price_cents,
      });
    }

    return NextResponse.json({ data: payload }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(
        "VALIDATION_ERROR",
        "Inscrição já existente para esta prova e distância.",
        409,
      );
    }
    return apiError("INTERNAL_ERROR", "Não foi possível criar a inscrição.", 500);
  }
}
