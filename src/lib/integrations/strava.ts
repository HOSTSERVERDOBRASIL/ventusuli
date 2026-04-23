import crypto from "crypto";
import { Prisma, StravaSyncStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncStravaActivities } from "@/lib/integrations/strava-service";

const STRAVA_WEBHOOK_EVENT_SCHEMA = z.object({
  object_type: z.string().min(1),
  object_id: z.number().int().nonnegative(),
  aspect_type: z.string().min(1),
  owner_id: z.number().int().nonnegative(),
  subscription_id: z.number().int().nonnegative().optional(),
  event_time: z.number().int().nonnegative().optional(),
  updates: z.record(z.string()).optional(),
});

export type StravaWebhookEvent = z.infer<typeof STRAVA_WEBHOOK_EVENT_SCHEMA>;

interface ChallengeParams {
  mode: string | null;
  challenge: string | null;
  verifyToken: string | null;
}

function isKnownObjectType(value: string): boolean {
  return value === "activity" || value === "athlete";
}

function stableUpdates(updates: Record<string, string> | undefined): string {
  if (!updates) return "";
  return Object.keys(updates)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}:${updates[key]}`)
    .join("|");
}

export function parseWebhookEvent(payload: unknown): StravaWebhookEvent {
  return STRAVA_WEBHOOK_EVENT_SCHEMA.parse(payload);
}

export function validateStravaChallenge(params: ChallengeParams): { ok: boolean; reason?: string } {
  const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!expectedToken) {
    return { ok: false, reason: "STRAVA_WEBHOOK_VERIFY_TOKEN not configured." };
  }

  if (params.mode !== "subscribe") {
    return { ok: false, reason: "Unsupported challenge mode." };
  }

  if (!params.challenge) {
    return { ok: false, reason: "Missing challenge value." };
  }

  if (!params.verifyToken || params.verifyToken !== expectedToken) {
    return { ok: false, reason: "Invalid verify token." };
  }

  return { ok: true };
}

export function buildWebhookIdempotencyKey(event: StravaWebhookEvent): string {
  const raw = [
    event.object_type,
    String(event.object_id),
    event.aspect_type,
    String(event.owner_id),
    String(event.subscription_id ?? ""),
    String(event.event_time ?? ""),
    stableUpdates(event.updates),
  ].join("::");

  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function enqueueStravaWebhookEvent(event: StravaWebhookEvent): Promise<{ logId: string; duplicate: boolean }> {
  const stravaAthleteId = String(event.owner_id);
  const idempotencyKey = buildWebhookIdempotencyKey(event);

  const linkedConnection = await prisma.stravaConnection.findFirst({
    where: { strava_athlete_id: stravaAthleteId },
    select: {
      user_id: true,
      organization_id: true,
    },
  });

  try {
    const created = await prisma.stravaSyncLog.create({
      data: {
        organization_id: linkedConnection?.organization_id,
        user_id: linkedConnection?.user_id,
        strava_athlete_id: stravaAthleteId,
        trigger: "WEBHOOK",
        status: "RECEIVED",
        idempotency_key: idempotencyKey,
        object_type: event.object_type,
        aspect_type: event.aspect_type,
        object_id: String(event.object_id),
        subscription_id: event.subscription_id ? String(event.subscription_id) : null,
        event_time: event.event_time ? new Date(event.event_time * 1000) : null,
        payload: event as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return { logId: created.id, duplicate: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.stravaSyncLog.findUnique({
        where: { idempotency_key: idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return { logId: existing.id, duplicate: true };
      }
    }

    throw error;
  }
}

export async function processStravaWebhookLog(logId: string): Promise<void> {
  const log = await prisma.stravaSyncLog.findUnique({
    where: { id: logId },
  });

  if (!log) return;
  if (log.status !== StravaSyncStatus.RECEIVED && log.status !== StravaSyncStatus.FAILED) return;

  await prisma.stravaSyncLog.update({
    where: { id: log.id },
    data: { status: "PROCESSING" },
  });

  try {
    if (!isKnownObjectType(log.object_type)) {
      await prisma.stravaSyncLog.update({
        where: { id: log.id },
        data: {
          status: "IGNORED",
          processed_at: new Date(),
          error_message: `Unsupported object_type: ${log.object_type}`,
        },
      });
      return;
    }

    if (log.aspect_type === "delete") {
      await prisma.stravaSyncLog.update({
        where: { id: log.id },
        data: {
          status: "SKIPPED",
          processed_at: new Date(),
          error_message: "Delete events are skipped (Strava incremental sync keeps local consistency).",
        },
      });
      return;
    }

    const connection = await prisma.stravaConnection.findFirst({
      where: {
        strava_athlete_id: log.strava_athlete_id,
      },
      select: {
        user_id: true,
        organization_id: true,
      },
    });

    if (!connection) {
      await prisma.stravaSyncLog.update({
        where: { id: log.id },
        data: {
          status: "SKIPPED",
          processed_at: new Date(),
          error_message: `No linked user for Strava athlete ${log.strava_athlete_id}`,
        },
      });
      return;
    }

    const sync = await syncStravaActivities(connection.user_id, connection.organization_id, false);

    await prisma.stravaSyncLog.update({
      where: { id: log.id },
      data: {
        organization_id: connection.organization_id,
        user_id: connection.user_id,
        status: "SYNCED",
        processed_at: new Date(),
        sync_result: sync as unknown as Prisma.InputJsonValue,
        error_message: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Strava webhook processing error.";
    await prisma.stravaSyncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        processed_at: new Date(),
        error_message: message.slice(0, 1000),
      },
    });
  }
}

export function processStravaWebhookLogAsync(logId: string): void {
  queueMicrotask(() => {
    void processStravaWebhookLog(logId);
  });
}
