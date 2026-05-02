import { NextRequest, NextResponse } from "next/server";
import { EventStatus, Prisma, RegistrationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { notifyEventCancelled, notifyEventUpdated } from "@/lib/notifications/domain-events";
import { getAuthContext } from "@/lib/request-auth";
import { isAllowedImageUrl } from "@/lib/storage/image-url";

const patchEventSchema = z
  .object({
    name: z.string().trim().min(3).optional(),
    city: z.string().trim().min(1).optional(),
    state: z
      .string()
      .trim()
      .length(2)
      .transform((v) => v.toUpperCase())
      .optional(),
    address: z.string().trim().max(255).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    check_in_radius_m: z.number().int().min(25).max(1000).optional(),
    proximity_radius_m: z.number().int().min(50).max(2000).optional(),
    event_date: z.string().datetime().optional(),
    registration_deadline: z.string().datetime().nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    image_url: z
      .string()
      .trim()
      .min(1)
      .refine((value) => isAllowedImageUrl(value), {
        message: "Imagem da prova invalida. Use upload oficial ou URL http/https.",
      })
      .nullable()
      .optional(),
    external_url: z.string().url().nullable().optional(),
    status: z.nativeEnum(EventStatus).optional(),
    distances: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(50),
          distance_km: z.number().positive(),
          price_cents: z.number().int().min(0),
          max_slots: z.number().int().positive().nullable().optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (value) => {
      const hasLatitude = value.latitude !== undefined;
      const hasLongitude = value.longitude !== undefined;
      if (hasLatitude !== hasLongitude) return false;
      return !hasLatitude || (value.latitude == null) === (value.longitude == null);
    },
    {
      message: "Informe latitude e longitude do ponto exato da prova.",
    },
  )
  .refine(
    (value) =>
      value.check_in_radius_m === undefined ||
      value.proximity_radius_m === undefined ||
      value.proximity_radius_m >= value.check_in_radius_m,
    {
      message: "O raio de proximidade deve ser maior ou igual ao raio de check-in.",
    },
  );

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
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError("VALIDATION_ERROR", "Conflito de dados Ãºnicos.", 409);
    }
    if (error.code === "P2025") {
      return apiError("USER_NOT_FOUND", "Registro nÃ£o encontrado.", 404);
    }
  }
  return apiError("INTERNAL_ERROR", "Erro interno ao processar evento.", 500);
}

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  try {
    const event = await prisma.event.findFirst({
      where: {
        id: params.id,
        organization_id: auth.organizationId,
      },
      include: {
        distances: {
          orderBy: { distance_km: "asc" },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event) {
      return apiError("USER_NOT_FOUND", "Prova nÃ£o encontrada.", 404);
    }

    const confirmedCount = await prisma.registration.count({
      where: {
        event_id: params.id,
        organization_id: auth.organizationId,
        status: RegistrationStatus.CONFIRMED,
      },
    });

    return NextResponse.json({
      data: {
        ...event,
        registrations_count: event._count.registrations,
        confirmed_registrations_count: confirmedCount,
      },
    });
  } catch (error) {
    return prismaToApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) {
    return apiError("FORBIDDEN", "Apenas administradores podem editar provas.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invÃ¡lido.", 400);
  }

  const parsed = patchEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.errors[0]?.message ?? "Dados invÃ¡lidos.",
      400,
    );
  }

  const input = parsed.data;

  try {
    const current = await prisma.event.findFirst({
      where: { id: params.id, organization_id: auth.organizationId },
      include: {
        distances: {
          orderBy: { distance_km: "asc" },
        },
      },
    });

    if (!current) {
      return apiError("USER_NOT_FOUND", "Prova nÃ£o encontrada.", 404);
    }

    const targetDistanceLabels = input.distances?.map((d) => d.label) ?? null;
    const finalDistancesCount = targetDistanceLabels
      ? targetDistanceLabels.length
      : current.distances.length;
    const nextStatus = input.status ?? current.status;
    const finalLatitude = input.latitude !== undefined ? input.latitude : current.latitude;
    const finalLongitude = input.longitude !== undefined ? input.longitude : current.longitude;
    const finalCheckInRadius = input.check_in_radius_m ?? current.check_in_radius_m;
    const finalProximityRadius = input.proximity_radius_m ?? current.proximity_radius_m;

    if (nextStatus === EventStatus.PUBLISHED && finalDistancesCount < 1) {
      return apiError("VALIDATION_ERROR", "Prova publicada deve ter ao menos uma distÃ¢ncia.", 400);
    }
    if (finalProximityRadius < finalCheckInRadius) {
      return apiError(
        "VALIDATION_ERROR",
        "O raio de proximidade deve ser maior ou igual ao raio de check-in.",
        400,
      );
    }
    if (nextStatus === EventStatus.PUBLISHED && (finalLatitude == null || finalLongitude == null)) {
      return apiError("VALIDATION_ERROR", "Informe o ponto exato da prova antes de publicar.", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: params.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
          ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
          ...(input.check_in_radius_m !== undefined
            ? { check_in_radius_m: input.check_in_radius_m }
            : {}),
          ...(input.proximity_radius_m !== undefined
            ? { proximity_radius_m: input.proximity_radius_m }
            : {}),
          ...(input.event_date !== undefined ? { event_date: new Date(input.event_date) } : {}),
          ...(input.registration_deadline !== undefined
            ? {
                registration_deadline: input.registration_deadline
                  ? new Date(input.registration_deadline)
                  : null,
              }
            : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.image_url !== undefined ? { image_url: input.image_url } : {}),
          ...(input.external_url !== undefined ? { external_url: input.external_url } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });

      if (!input.distances) return;

      const existingByLabel = new Map(current.distances.map((d) => [d.label, d]));
      const nextLabels = input.distances.map((d) => d.label);
      const labelsToRemove = current.distances
        .filter((distance) => !nextLabels.includes(distance.label))
        .map((distance) => distance.label);

      if (labelsToRemove.length > 0) {
        const idsToRemove = current.distances
          .filter((distance) => labelsToRemove.includes(distance.label))
          .map((distance) => distance.id);

        const linkedRegistrations = await tx.registration.count({
          where: { distance_id: { in: idsToRemove } },
        });
        if (linkedRegistrations > 0) {
          throw new Error("DISTANCE_HAS_REGISTRATIONS");
        }

        await tx.eventDistance.deleteMany({
          where: {
            event_id: params.id,
            label: { in: labelsToRemove },
          },
        });
      }

      for (const distance of input.distances) {
        const existing = existingByLabel.get(distance.label);
        if (existing) {
          await tx.eventDistance.update({
            where: { id: existing.id },
            data: {
              distance_km: new Prisma.Decimal(distance.distance_km),
              price_cents: distance.price_cents,
              max_slots: distance.max_slots ?? null,
            },
          });
        } else {
          await tx.eventDistance.create({
            data: {
              event_id: params.id,
              label: distance.label,
              distance_km: new Prisma.Decimal(distance.distance_km),
              price_cents: distance.price_cents,
              max_slots: distance.max_slots ?? null,
            },
          });
        }
      }
    });

    const updated = await prisma.event.findFirst({
      where: { id: params.id, organization_id: auth.organizationId },
      include: { distances: { orderBy: { distance_km: "asc" } } },
    });

    if (
      updated &&
      current.status === EventStatus.PUBLISHED &&
      updated.status === EventStatus.PUBLISHED
    ) {
      await notifyEventUpdated(prisma, updated);
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "DISTANCE_HAS_REGISTRATIONS") {
      return apiError(
        "FORBIDDEN",
        "NÃ£o Ã© possÃ­vel remover distÃ¢ncias que jÃ¡ possuem inscriÃ§Ãµes.",
        403,
      );
    }
    return prismaToApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) {
    return apiError("FORBIDDEN", "Apenas administradores podem cancelar provas.", 403);
  }

  try {
    const event = await prisma.event.findFirst({
      where: { id: params.id, organization_id: auth.organizationId },
      select: { id: true },
    });
    if (!event) {
      return apiError("USER_NOT_FOUND", "Prova nÃ£o encontrada.", 404);
    }

    const confirmedCount = await prisma.registration.count({
      where: {
        event_id: params.id,
        organization_id: auth.organizationId,
        status: RegistrationStatus.CONFIRMED,
      },
    });

    if (confirmedCount > 0) {
      return apiError(
        "FORBIDDEN",
        "NÃ£o Ã© possÃ­vel cancelar prova com inscriÃ§Ãµes confirmadas.",
        403,
      );
    }

    const cancelled = await prisma.event.update({
      where: { id: params.id },
      data: { status: EventStatus.CANCELLED },
      include: { distances: { orderBy: { distance_km: "asc" } } },
    });

    await notifyEventCancelled(prisma, cancelled);

    return NextResponse.json({ data: cancelled });
  } catch (error) {
    return prismaToApiError(error);
  }
}
