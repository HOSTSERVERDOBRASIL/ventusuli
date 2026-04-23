import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus, Prisma, RegistrationStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const patchRegistrationSchema = z.object({
  action: z.enum(["CONFIRM_PAYMENT", "MARK_INTERESTED", "CANCEL"]),
});

interface RouteParams {
  params: { id: string };
}

async function loadRegistration(registrationId: string, userId: string, organizationId: string) {
  return prisma.registration.findFirst({
    where: {
      id: registrationId,
      user_id: userId,
      organization_id: organizationId,
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
      payment: {
        select: {
          id: true,
          status: true,
          amount_cents: true,
          paid_at: true,
          expires_at: true,
        },
      },
    },
  });
}

function mapRegistrationResponse(
  registration: NonNullable<Awaited<ReturnType<typeof loadRegistration>>>,
) {
  return {
    id: registration.id,
    eventId: registration.event.id,
    eventName: registration.event.name,
    eventDate: registration.event.event_date.toISOString(),
    distanceId: registration.distance.id,
    distanceLabel: registration.distance.label,
    status: registration.status,
    paymentStatus: registration.payment?.status ?? PaymentStatus.PENDING,
    amountCents: registration.payment?.amount_cents ?? registration.distance.price_cents,
  };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body inválido.", 400);
  }

  const parsed = patchRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados inválidos.", 400);
  }

  const current = await loadRegistration(params.id, auth.userId, auth.organizationId);
  if (!current) return apiError("USER_NOT_FOUND", "Inscrição não encontrada.", 404);

  const action = parsed.data.action;

  try {
    await prisma.$transaction(async (tx) => {
      const shouldReleaseSlot =
        current.status === RegistrationStatus.PENDING_PAYMENT ||
        current.status === RegistrationStatus.CONFIRMED;

      if (action === "CONFIRM_PAYMENT") {
        await tx.registration.update({
          where: { id: params.id },
          data: { status: RegistrationStatus.CONFIRMED },
        });

        if (current.payment) {
          await tx.payment.update({
            where: { id: current.payment.id },
            data: {
              status: PaymentStatus.PAID,
              paid_at: new Date(),
            },
          });
        }
        return;
      }

      if (action === "MARK_INTERESTED") {
        await tx.registration.update({
          where: { id: params.id },
          data: { status: RegistrationStatus.INTERESTED },
        });

        if (shouldReleaseSlot) {
          await tx.eventDistance.updateMany({
            where: { id: current.distance.id, registered_count: { gt: 0 } },
            data: { registered_count: { decrement: 1 } },
          });
        }

        if (current.payment && current.payment.status === PaymentStatus.PENDING) {
          await tx.payment.update({
            where: { id: current.payment.id },
            data: {
              status: PaymentStatus.CANCELLED,
            },
          });
        }
        return;
      }

      await tx.registration.update({
        where: { id: params.id },
        data: { status: RegistrationStatus.CANCELLED },
      });

      if (shouldReleaseSlot) {
        await tx.eventDistance.updateMany({
          where: { id: current.distance.id, registered_count: { gt: 0 } },
          data: { registered_count: { decrement: 1 } },
        });
      }

      if (current.payment && current.payment.status === PaymentStatus.PENDING) {
        await tx.payment.update({
          where: { id: current.payment.id },
          data: { status: PaymentStatus.CANCELLED },
        });
      }
    });

    const updated = await loadRegistration(params.id, auth.userId, auth.organizationId);
    if (!updated) return apiError("USER_NOT_FOUND", "Inscrição não encontrada.", 404);

    return NextResponse.json({ data: mapRegistrationResponse(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return apiError("INTERNAL_ERROR", "Não foi possível atualizar a inscrição.", 500);
    }
    return apiError("INTERNAL_ERROR", "Não foi possível atualizar a inscrição.", 500);
  }
}
