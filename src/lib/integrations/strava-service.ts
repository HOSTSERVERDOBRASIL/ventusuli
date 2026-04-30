import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchStravaActivities,
  refreshStravaToken,
  StravaActivity,
  StravaTokenResponse,
} from "@/lib/integrations/strava-client";
import { logIntegration, logWarn } from "@/lib/logger";

const STRAVA_SOURCE = "STRAVA";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_SYNC = 20;

export interface StravaConnectionStatus {
  connected: boolean;
  stravaAthleteId: string | null;
  scopes: string[];
  expiresAt: string | null;
  lastSyncAt: string | null;
  integrationConfigured?: boolean;
  unavailableReason?: string | null;
  missingConfig?: string[];
}

export interface StravaSyncResult {
  syncedCount: number;
  failedCount: number;
  pagesFetched: number;
  lastSyncAt: string;
}

export class StravaIntegrationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "StravaIntegrationError";
    this.statusCode = statusCode;
  }
}

function toPaceSecondsPerKm(distanceM: number | undefined, movingTimeS: number | undefined): Prisma.Decimal | null {
  if (!distanceM || distanceM <= 0 || !movingTimeS || movingTimeS <= 0) return null;
  const km = distanceM / 1000;
  const pace = movingTimeS / km;
  return new Prisma.Decimal(Number(pace.toFixed(2)));
}

function toActivityCreateInput(
  activity: StravaActivity,
  userId: string,
  organizationId: string,
): Prisma.ActivityUncheckedCreateInput {
  return {
    external_source: STRAVA_SOURCE,
    external_id: String(activity.id),
    user_id: userId,
    organization_id: organizationId,
    type: activity.sport_type ?? activity.type ?? "Unknown",
    name: activity.name,
    distance_m: typeof activity.distance === "number" ? Math.round(activity.distance) : null,
    moving_time_s: typeof activity.moving_time === "number" ? Math.round(activity.moving_time) : null,
    elapsed_time_s: typeof activity.elapsed_time === "number" ? Math.round(activity.elapsed_time) : null,
    average_pace_sec_km: toPaceSecondsPerKm(activity.distance, activity.moving_time),
    average_hr: typeof activity.average_heartrate === "number" ? Math.round(activity.average_heartrate) : null,
    max_hr: typeof activity.max_heartrate === "number" ? Math.round(activity.max_heartrate) : null,
    elevation_gain_m:
      typeof activity.total_elevation_gain === "number" ? Math.round(activity.total_elevation_gain) : null,
    activity_date: new Date(activity.start_date),
    raw_payload: activity as unknown as Prisma.InputJsonValue,
  };
}

async function assertAthleteContext(userId: string, organizationId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organization_id: organizationId,
      role: "ATHLETE",
    },
    select: {
      id: true,
      athlete_profile: {
        select: {
          athlete_status: true,
        },
      },
    },
  });

  if (!user) {
    throw new StravaIntegrationError("Conta atleta invalida para integrar Strava.", 403);
  }

  if (user.athlete_profile?.athlete_status !== "ACTIVE") {
    throw new StravaIntegrationError(
      "A integracao com Strava esta disponivel apenas para atletas ativos.",
      403,
    );
  }
}

export async function getStravaConnectionStatus(
  userId: string,
  organizationId: string,
): Promise<StravaConnectionStatus> {
  await assertAthleteContext(userId, organizationId);

  const connection = await prisma.stravaConnection.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
    select: {
      strava_athlete_id: true,
      scopes: true,
      expires_at: true,
      last_sync_at: true,
    },
  });

  if (!connection) {
    return {
      connected: false,
      stravaAthleteId: null,
      scopes: [],
      expiresAt: null,
      lastSyncAt: null,
    };
  }

  return {
    connected: true,
    stravaAthleteId: connection.strava_athlete_id,
    scopes: connection.scopes,
    expiresAt: connection.expires_at.toISOString(),
    lastSyncAt: connection.last_sync_at ? connection.last_sync_at.toISOString() : null,
  };
}

export async function upsertStravaConnectionFromToken(
  userId: string,
  organizationId: string,
  token: StravaTokenResponse,
): Promise<void> {
  await assertAthleteContext(userId, organizationId);

  const expiresAt = new Date(token.expires_at * 1000);
  const scopes = token.scope
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  await prisma.stravaConnection.upsert({
    where: {
      user_id: userId,
    },
    create: {
      user_id: userId,
      organization_id: organizationId,
      strava_athlete_id: String(token.athlete.id),
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt,
      scopes,
    },
    update: {
      organization_id: organizationId,
      strava_athlete_id: String(token.athlete.id),
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt,
      scopes,
    },
  });

  logIntegration("strava", "connection_upserted", {
    organizationId,
    userId,
    stravaAthleteId: String(token.athlete.id),
  });
}

async function ensureValidAccessToken(
  userId: string,
  organizationId: string,
): Promise<{ accessToken: string; lastSyncAt: Date | null }> {
  const connection = await prisma.stravaConnection.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
  });

  if (!connection) {
    throw new StravaIntegrationError("Conexao Strava nao encontrada para este atleta.", 404);
  }

  const expiresSoon = connection.expires_at.getTime() <= Date.now() + 60_000;
  if (!expiresSoon) {
    return {
      accessToken: connection.access_token,
      lastSyncAt: connection.last_sync_at,
    };
  }

  const refreshed = await refreshStravaToken(connection.refresh_token);
  const updated = await prisma.stravaConnection.update({
    where: { id: connection.id },
    data: {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000),
      scopes: refreshed.scope
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    },
    select: {
      access_token: true,
      last_sync_at: true,
    },
  });

  logIntegration("strava", "token_refreshed", {
    organizationId,
    userId,
  });

  return {
    accessToken: updated.access_token,
    lastSyncAt: updated.last_sync_at,
  };
}

export async function syncStravaActivities(
  userId: string,
  organizationId: string,
  forceFullSync = false,
): Promise<StravaSyncResult> {
  await assertAthleteContext(userId, organizationId);

  const { accessToken, lastSyncAt } = await ensureValidAccessToken(userId, organizationId);

  const overlapMs = 24 * 60 * 60 * 1000;
  const afterEpoch = !forceFullSync && lastSyncAt ? Math.floor((lastSyncAt.getTime() - overlapMs) / 1000) : undefined;

  let page = 1;
  let pagesFetched = 0;
  let syncedCount = 0;
  let failedCount = 0;

  while (page <= MAX_PAGES_PER_SYNC) {
    const activities = await fetchStravaActivities(accessToken, {
      after: afterEpoch,
      page,
      perPage: PAGE_SIZE,
    });

    pagesFetched += 1;

    if (!activities.length) {
      break;
    }

    for (const activity of activities) {
      try {
        const payload = toActivityCreateInput(activity, userId, organizationId);
        await prisma.activity.upsert({
          where: {
            external_source_external_id: {
              external_source: STRAVA_SOURCE,
              external_id: String(activity.id),
            },
          },
          create: payload,
          update: {
            user_id: userId,
            organization_id: organizationId,
            type: payload.type,
            name: payload.name,
            distance_m: payload.distance_m,
            moving_time_s: payload.moving_time_s,
            elapsed_time_s: payload.elapsed_time_s,
            average_pace_sec_km: payload.average_pace_sec_km,
            average_hr: payload.average_hr,
            max_hr: payload.max_hr,
            elevation_gain_m: payload.elevation_gain_m,
            activity_date: payload.activity_date,
            raw_payload: payload.raw_payload,
          },
        });
        syncedCount += 1;
      } catch (error) {
        failedCount += 1;
        logWarn("strava_activity_upsert_failed", {
          organizationId,
          userId,
          activityId: activity.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (activities.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  const now = new Date();
  await prisma.stravaConnection.updateMany({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
    data: {
      last_sync_at: now,
    },
  });

  logIntegration("strava", "activities_synced", {
    organizationId,
    userId,
    syncedCount,
    failedCount,
    pagesFetched,
    forceFullSync,
  });

  return {
    syncedCount,
    failedCount,
    pagesFetched,
    lastSyncAt: now.toISOString(),
  };
}

export async function disconnectStrava(userId: string, organizationId: string): Promise<void> {
  await prisma.stravaConnection.deleteMany({
    where: {
      user_id: userId,
      organization_id: organizationId,
    },
  });

  logIntegration("strava", "connection_disconnected", {
    organizationId,
    userId,
  });
}
