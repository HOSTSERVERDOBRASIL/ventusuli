import { ExternalSyncStatus, ExternalSyncType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/integrations/external/credentials";
import {
  ExternalIntegrationError,
  type NormalizedEvent,
  type NormalizedOrder,
  type NormalizedRegistration,
} from "@/lib/integrations/external/types";
import { ensureTicketSportsPlatform } from "@/lib/integrations/external/platform-service";
import { TicketSportsClient } from "@/lib/integrations/ticketsports/client";
import { TicketSportsIntegration } from "@/lib/integrations/ticketsports/integration";
import { logError, logInfo, toErrorContext } from "@/lib/logger";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function ticketSportsIntegration(organizationId: string) {
  const platform = await ensureTicketSportsPlatform();
  const credential = await prisma.platformCredential.findUnique({
    where: {
      platformId_organizationId: {
        platformId: platform.id,
        organizationId,
      },
    },
  });

  const tokenFromCredential = credential?.encryptedToken
    ? decryptCredential(credential.encryptedToken)
    : null;
  const token = tokenFromCredential ?? process.env.TICKETSPORTS_API_TOKEN;

  if (!token || token === "replace_me") {
    throw new ExternalIntegrationError(
      "TICKETSPORTS_CREDENTIALS_MISSING",
      "Credenciais da TicketSports nao configuradas para esta organizacao.",
      400,
    );
  }

  return {
    platform,
    integration: new TicketSportsIntegration(new TicketSportsClient(platform.baseUrl, token)),
  };
}

async function startLog(
  platformId: string,
  organizationId: string,
  syncType: ExternalSyncType,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.syncLog.create({
    data: {
      platformId,
      organizationId,
      syncType,
      status: ExternalSyncStatus.RUNNING,
      metadata,
    },
  });
}

async function finishLog(
  id: string,
  status: ExternalSyncStatus,
  totalRecords: number,
  errorMessage?: string,
) {
  return prisma.syncLog.update({
    where: { id },
    data: {
      status,
      totalRecords,
      errorMessage,
      finishedAt: new Date(),
    },
  });
}

async function upsertEvent(platformId: string, organizationId: string, event: NormalizedEvent) {
  return prisma.externalEvent.upsert({
    where: {
      platformId_organizationId_externalId: {
        platformId,
        organizationId,
        externalId: event.externalId,
      },
    },
    create: {
      platformId,
      organizationId,
      externalId: event.externalId,
      name: event.name,
      date: toDate(event.date),
      location: event.location ?? null,
      status: event.status ?? null,
      rawPayload: toJson(event.rawPayload),
    },
    update: {
      name: event.name,
      date: toDate(event.date),
      location: event.location ?? null,
      status: event.status ?? null,
      rawPayload: toJson(event.rawPayload),
    },
  });
}

async function findOrCreateExternalEvent(
  platformId: string,
  organizationId: string,
  externalId: string,
) {
  const existing = await prisma.externalEvent.findUnique({
    where: {
      platformId_organizationId_externalId: {
        platformId,
        organizationId,
        externalId,
      },
    },
  });

  if (existing) return existing;
  return prisma.externalEvent.create({
    data: {
      platformId,
      organizationId,
      externalId,
      name: `Evento externo ${externalId}`,
      rawPayload: {},
    },
  });
}

async function upsertRegistration(
  platformId: string,
  organizationId: string,
  registration: NormalizedRegistration,
) {
  const event = await findOrCreateExternalEvent(
    platformId,
    organizationId,
    registration.eventExternalId,
  );

  return prisma.externalRegistration.upsert({
    where: {
      platformId_organizationId_externalId: {
        platformId,
        organizationId,
        externalId: registration.externalId,
      },
    },
    create: {
      platformId,
      organizationId,
      externalId: registration.externalId,
      externalEventId: event.id,
      participantName: registration.participantName ?? null,
      participantEmail: registration.participantEmail ?? null,
      participantDocument: registration.participantDocument ?? null,
      category: registration.category ?? null,
      status: registration.status ?? null,
      rawPayload: toJson(registration.rawPayload),
    },
    update: {
      externalEventId: event.id,
      participantName: registration.participantName ?? null,
      participantEmail: registration.participantEmail ?? null,
      participantDocument: registration.participantDocument ?? null,
      category: registration.category ?? null,
      status: registration.status ?? null,
      rawPayload: toJson(registration.rawPayload),
    },
  });
}

async function upsertOrder(platformId: string, organizationId: string, order: NormalizedOrder) {
  const event = order.eventExternalId
    ? await findOrCreateExternalEvent(platformId, organizationId, order.eventExternalId)
    : null;

  return prisma.externalOrder.upsert({
    where: {
      platformId_organizationId_externalId: {
        platformId,
        organizationId,
        externalId: order.externalId,
      },
    },
    create: {
      platformId,
      organizationId,
      externalId: order.externalId,
      externalEventId: event?.id ?? null,
      buyerName: order.buyerName ?? null,
      buyerEmail: order.buyerEmail ?? null,
      amount: order.amount ? Math.round(order.amount) : null,
      paymentStatus: order.paymentStatus ?? null,
      orderStatus: order.orderStatus ?? null,
      rawPayload: toJson(order.rawPayload),
    },
    update: {
      externalEventId: event?.id ?? null,
      buyerName: order.buyerName ?? null,
      buyerEmail: order.buyerEmail ?? null,
      amount: order.amount ? Math.round(order.amount) : null,
      paymentStatus: order.paymentStatus ?? null,
      orderStatus: order.orderStatus ?? null,
      rawPayload: toJson(order.rawPayload),
    },
  });
}

async function runSync<T>(
  organizationId: string,
  syncType: ExternalSyncType,
  metadata: Prisma.InputJsonValue | undefined,
  load: (integration: TicketSportsIntegration) => Promise<T[]>,
  persist: (platformId: string, item: T) => Promise<unknown>,
) {
  const { platform, integration } = await ticketSportsIntegration(organizationId);
  const log = await startLog(platform.id, organizationId, syncType, metadata);

  try {
    const items = await load(integration);
    for (const item of items) {
      await persist(platform.id, item);
    }

    await finishLog(log.id, ExternalSyncStatus.SUCCESS, items.length);
    logInfo("ticketsports_sync_success", {
      organizationId,
      syncType,
      totalRecords: items.length,
    });

    return { status: "success" as const, syncType: syncType.toLowerCase(), totalRecords: items.length };
  } catch (error) {
    const message =
      error instanceof ExternalIntegrationError || error instanceof Error
        ? error.message
        : "Erro ao sincronizar TicketSports.";
    await finishLog(log.id, ExternalSyncStatus.ERROR, 0, message);
    logError("ticketsports_sync_failed", {
      organizationId,
      syncType,
      ...toErrorContext(error),
    });
    throw error;
  }
}

export async function syncTicketSportsEvents(organizationId: string) {
  return runSync(
    organizationId,
    ExternalSyncType.EVENTS,
    undefined,
    (integration) => integration.getEvents(),
    (platformId, event) => upsertEvent(platformId, organizationId, event),
  );
}

export async function syncTicketSportsRegistrations(organizationId: string, eventId: string) {
  return runSync(
    organizationId,
    ExternalSyncType.REGISTRATIONS,
    { eventId },
    (integration) => integration.getRegistrations(eventId),
    (platformId, registration) => upsertRegistration(platformId, organizationId, registration),
  );
}

export async function syncTicketSportsOrders(organizationId: string, eventId?: string) {
  return runSync(
    organizationId,
    ExternalSyncType.ORDERS,
    eventId ? { eventId } : undefined,
    (integration) => integration.getOrders(eventId),
    (platformId, order) => upsertOrder(platformId, organizationId, order),
  );
}

export async function getTicketSportsOrder(organizationId: string, orderId: string) {
  const { platform, integration } = await ticketSportsIntegration(organizationId);
  const order = await integration.getOrderById(orderId);
  await upsertOrder(platform.id, organizationId, order);
  return order;
}

export function integrationErrorResponse(error: unknown) {
  if (error instanceof ExternalIntegrationError) {
    return {
      status: error.statusCode,
      body: {
        status: "error",
        code: error.code,
        message: error.message,
        details: error.details ?? {},
      },
    };
  }

  return {
    status: 500,
    body: {
      status: "error",
      code: "TICKETSPORTS_API_ERROR",
      message: error instanceof Error ? error.message : "Erro ao consultar a API da TicketSports.",
      details: {},
    },
  };
}
