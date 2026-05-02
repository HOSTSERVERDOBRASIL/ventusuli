import { NextRequest, NextResponse } from "next/server";
import { RegistrationStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { distanceInMeters } from "@/lib/geo-distance";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const checkInSchema = z.object({
  action: z.enum(["CHECK_IN", "CHECK_OUT"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

interface RouteParams {
  params: { id: string };
}

function outsideRadiusMessage(distanceMeters: number, radiusMeters: number, action: string) {
  return `${action} liberado apenas dentro de ${radiusMeters}m do ponto da prova. Distancia atual: ${distanceMeters}m.`;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const registration = await prisma.registration.findFirst({
    where: {
      id: params.id,
      user_id: auth.userId,
      organization_id: auth.organizationId,
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          check_in_radius_m: true,
          proximity_radius_m: true,
        },
      },
    },
  });

  if (!registration) return apiError("USER_NOT_FOUND", "Inscricao nao encontrada.", 404);
  if (registration.status !== RegistrationStatus.CONFIRMED) {
    return apiError("FORBIDDEN", "Check-in liberado apenas para inscricoes confirmadas.", 403);
  }

  if (registration.event.latitude == null || registration.event.longitude == null) {
    return apiError("VALIDATION_ERROR", "Ponto exato da prova ainda nao foi configurado.", 409);
  }

  const eventPoint = {
    latitude: Number(registration.event.latitude),
    longitude: Number(registration.event.longitude),
  };
  const athletePoint = {
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
  };
  const distanceMeters = distanceInMeters(eventPoint, athletePoint);
  const checkInRadius = registration.event.check_in_radius_m || 100;
  const proximityRadius = registration.event.proximity_radius_m || 200;

  if (parsed.data.action === "CHECK_IN" && distanceMeters > checkInRadius) {
    return apiError(
      "FORBIDDEN",
      outsideRadiusMessage(distanceMeters, checkInRadius, "Check-in"),
      403,
    );
  }

  if (parsed.data.action === "CHECK_OUT") {
    if (!registration.check_in_at) {
      return apiError("FORBIDDEN", "Faca o check-in antes do check-out.", 403);
    }

    if (distanceMeters > proximityRadius) {
      return apiError(
        "FORBIDDEN",
        outsideRadiusMessage(distanceMeters, proximityRadius, "Check-out"),
        403,
      );
    }
  }

  const now = new Date();
  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data:
      parsed.data.action === "CHECK_IN"
        ? {
            attendance_status: "PRESENT",
            attendance_checked_at: registration.attendance_checked_at ?? now,
            attendance_checked_by: registration.attendance_checked_by ?? auth.userId,
            ...(registration.check_in_at
              ? {}
              : {
                  check_in_at: now,
                  check_in_latitude: parsed.data.latitude,
                  check_in_longitude: parsed.data.longitude,
                  check_in_distance_m: distanceMeters,
                }),
          }
        : {
            check_out_at: now,
            check_out_latitude: parsed.data.latitude,
            check_out_longitude: parsed.data.longitude,
            check_out_distance_m: distanceMeters,
          },
    select: {
      id: true,
      attendance_status: true,
      check_in_at: true,
      check_out_at: true,
    },
  });

  return NextResponse.json({
    data: {
      registrationId: updated.id,
      action: parsed.data.action,
      distanceMeters,
      checkInRadiusM: checkInRadius,
      proximityRadiusM: proximityRadius,
      checkInAt: updated.check_in_at?.toISOString() ?? null,
      checkOutAt: updated.check_out_at?.toISOString() ?? null,
      attendanceStatus: updated.attendance_status,
    },
  });
}
