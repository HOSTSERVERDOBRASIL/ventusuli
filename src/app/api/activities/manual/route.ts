import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const MAX_MANUAL_ACTIVITIES_PER_24H = 12;
const MIN_PACE_SEC_KM = 150;
const MAX_PACE_SEC_KM = 2400;

const manualActivitySchema = z.object({
  name: z.string().trim().max(90).optional().nullable(),
  distanceKm: z.coerce.number().min(0.1).max(120),
  durationMinutes: z.coerce.number().min(1).max(720),
  activityDate: z.string().min(1),
  elevationGainM: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

function isAthleteRole(auth: ReturnType<typeof getAuthContext>): boolean {
  if (!auth) return false;
  return auth.roles.some((role) => {
    const value = String(role);
    return value === "ATHLETE" || value === "PREMIUM_ATHLETE";
  });
}

function parseActivityDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAthleteRole(auth)) {
    return apiError("FORBIDDEN", "Apenas atletas podem lançar treinos manuais.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body inválido.", 400);
  }

  const parsed = manualActivitySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados inválidos.", 400);
  }

  const now = new Date();
  const activityDate = parseActivityDate(parsed.data.activityDate);
  if (!activityDate) return apiError("VALIDATION_ERROR", "Data do treino inválida.", 400);

  const futureToleranceMs = 5 * 60 * 1000;
  if (activityDate.getTime() > now.getTime() + futureToleranceMs) {
    return apiError("VALIDATION_ERROR", "O treino manual não pode estar no futuro.", 400);
  }

  const oldestAllowed = new Date(now);
  oldestAllowed.setUTCFullYear(oldestAllowed.getUTCFullYear() - 2);
  if (activityDate < oldestAllowed) {
    return apiError(
      "VALIDATION_ERROR",
      "O treino manual precisa estar dentro dos últimos 2 anos.",
      400,
    );
  }

  const distanceKm = Number(parsed.data.distanceKm.toFixed(2));
  const movingTimeSeconds = Math.round(parsed.data.durationMinutes * 60);
  const paceSecondsPerKm = movingTimeSeconds / distanceKm;

  if (paceSecondsPerKm < MIN_PACE_SEC_KM || paceSecondsPerKm > MAX_PACE_SEC_KM) {
    return apiError(
      "VALIDATION_ERROR",
      "Revise distância e tempo: o ritmo informado parece inconsistente.",
      400,
    );
  }

  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const manualEntriesToday = await prisma.activity.count({
    where: {
      user_id: auth.userId,
      organization_id: auth.organizationId,
      external_source: "manual",
      created_at: { gte: windowStart },
    },
  });

  if (manualEntriesToday >= MAX_MANUAL_ACTIVITIES_PER_24H) {
    return apiError(
      "RATE_LIMIT_EXCEEDED",
      "Limite diário de lançamentos manuais atingido. Tente novamente amanhã.",
      429,
    );
  }

  const externalId = `manual:${auth.userId}:${randomUUID()}`;
  const cleanName = parsed.data.name?.trim() || "Treino manual";
  const note = parsed.data.note?.trim() || null;
  const distanceMeters = Math.round(distanceKm * 1000);

  const activity = await prisma.activity.create({
    data: {
      external_source: "manual",
      external_id: externalId,
      user_id: auth.userId,
      organization_id: auth.organizationId,
      type: "Run",
      name: cleanName,
      distance_m: distanceMeters,
      moving_time_s: movingTimeSeconds,
      elapsed_time_s: movingTimeSeconds,
      average_pace_sec_km: new Prisma.Decimal(paceSecondsPerKm.toFixed(2)),
      elevation_gain_m: parsed.data.elevationGainM ?? null,
      activity_date: activityDate,
      raw_payload: {
        source: "manual",
        trust: "self_reported",
        validationStatus: "SELF_REPORTED",
        note,
        createdBy: auth.userId,
        createdAt: now.toISOString(),
      },
    },
    select: {
      id: true,
      name: true,
      distance_m: true,
      moving_time_s: true,
      activity_date: true,
      external_source: true,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: activity.id,
        name: activity.name,
        source: activity.external_source,
        distanceKm: Number(((activity.distance_m ?? 0) / 1000).toFixed(2)),
        durationMinutes: Math.round((activity.moving_time_s ?? 0) / 60),
        activityDate: activity.activity_date.toISOString(),
        officialStatus: "SELF_REPORTED",
      },
      message:
        "Treino manual salvo. Ele atualiza sua evolução; ranking e pontos oficiais podem depender de validação da assessoria.",
    },
    { status: 201 },
  );
}
