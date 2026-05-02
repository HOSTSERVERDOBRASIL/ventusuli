import { Event, Notice, NoticeAudience, PrismaClient } from "@prisma/client";
import { logError } from "@/lib/logger";
import { notificationService } from "./index";
import {
  getNotificationRecipientsByUserIds,
  getNotificationRecipientsForAudience,
} from "./recipients";

type PublishedNotice = Pick<Notice, "id" | "organization_id" | "title" | "body" | "audience">;
type PublishedEvent = Pick<Event, "id" | "organization_id" | "name" | "city" | "state" | "address" | "event_date">;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function appUrl(pathname: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  if (!baseUrl) return pathname;
  return new URL(pathname, baseUrl).toString();
}

function eventLocation(event: PublishedEvent): string {
  const cityState = [event.city, event.state].filter(Boolean).join("/");
  return event.address ? `${event.address} - ${cityState}` : cityState || "Local a confirmar";
}

export async function notifyNoticePublished(
  prisma: PrismaClient,
  notice: PublishedNotice,
): Promise<void> {
  try {
    if (!notice.organization_id) return;

    const recipients = await getNotificationRecipientsForAudience(
      prisma,
      notice.organization_id,
      notice.audience,
    );

    await notificationService.emit({
      organizationId: notice.organization_id,
      eventType: "NOTICE_PUBLISHED",
      entityType: "NOTICE",
      entityId: notice.id,
      recipients,
      channels: ["IN_APP"],
      url: "/avisos",
      payload: {
        notice_title: notice.title,
        notice_body: notice.body,
      },
    });
  } catch (error) {
    logError("notice_notification_emit_failed", {
      noticeId: notice.id,
      organizationId: notice.organization_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyEventPublished(
  prisma: PrismaClient,
  event: PublishedEvent,
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsForAudience(
      prisma,
      event.organization_id,
      NoticeAudience.ATHLETES,
    );

    await notificationService.emit({
      organizationId: event.organization_id,
      eventType: "EVENT_PUBLISHED",
      entityType: "EVENT",
      entityId: event.id,
      recipients,
      url: `/provas/${event.id}`,
      payload: {
        event_name: event.name,
        event_date: formatDate(event.event_date),
        event_time: formatTime(event.event_date),
        event_location: eventLocation(event),
        event_url: appUrl(`/provas/${event.id}`),
      },
    });
  } catch (error) {
    logError("event_published_notification_emit_failed", {
      eventId: event.id,
      organizationId: event.organization_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyEventUpdated(
  prisma: PrismaClient,
  event: PublishedEvent,
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsForAudience(
      prisma,
      event.organization_id,
      NoticeAudience.ATHLETES,
    );

    await notificationService.emit({
      organizationId: event.organization_id,
      eventType: "EVENT_UPDATED",
      entityType: "EVENT",
      entityId: `${event.id}-${Date.now()}`,
      recipients,
      url: `/provas/${event.id}`,
      payload: {
        event_name: event.name,
        event_date: formatDate(event.event_date),
        event_time: formatTime(event.event_date),
        event_location: eventLocation(event),
        event_url: appUrl(`/provas/${event.id}`),
      },
    });
  } catch (error) {
    logError("event_updated_notification_emit_failed", {
      eventId: event.id,
      organizationId: event.organization_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyEventCancelled(
  prisma: PrismaClient,
  event: PublishedEvent,
  reason = "Cancelamento operacional.",
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsForAudience(
      prisma,
      event.organization_id,
      NoticeAudience.ATHLETES,
    );

    await notificationService.emit({
      organizationId: event.organization_id,
      eventType: "EVENT_CANCELLED",
      entityType: "EVENT",
      entityId: event.id,
      recipients,
      url: `/provas/${event.id}`,
      payload: {
        event_name: event.name,
        event_date: formatDate(event.event_date),
        event_time: formatTime(event.event_date),
        event_location: eventLocation(event),
        cancel_reason: reason,
      },
    });
  } catch (error) {
    logError("event_cancelled_notification_emit_failed", {
      eventId: event.id,
      organizationId: event.organization_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyAthleteApproved(
  prisma: PrismaClient,
  organizationId: string,
  athleteId: string,
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, organizationId, [athleteId]);
    await notificationService.emit({
      organizationId,
      eventType: "ATHLETE_APPROVED",
      entityType: "USER",
      entityId: athleteId,
      recipients,
      url: "/",
      payload: {
        login_url: appUrl("/login"),
      },
    });
  } catch (error) {
    logError("athlete_approved_notification_emit_failed", {
      organizationId,
      athleteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyAthleteRejected(
  prisma: PrismaClient,
  organizationId: string,
  athleteId: string,
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, organizationId, [athleteId]);
    await notificationService.emit({
      organizationId,
      eventType: "ATHLETE_REJECTED",
      entityType: "USER",
      entityId: athleteId,
      recipients,
      url: "/login",
      payload: {},
    });
  } catch (error) {
    logError("athlete_rejected_notification_emit_failed", {
      organizationId,
      athleteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyPaymentPending(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    registrationId: string;
    eventName: string;
    dueDate: Date;
    amountCents: number;
  },
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, input.organizationId, [
      input.userId,
    ]);

    await notificationService.emit({
      organizationId: input.organizationId,
      eventType: "PAYMENT_PENDING",
      entityType: "REGISTRATION",
      entityId: input.registrationId,
      recipients,
      url: "/minhas-inscricoes",
      payload: {
        event_name: input.eventName,
        amount: formatCurrency(input.amountCents),
        due_date: new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(input.dueDate),
        payment_url: appUrl("/minhas-inscricoes"),
      },
    });
  } catch (error) {
    logError("payment_pending_notification_emit_failed", {
      organizationId: input.organizationId,
      userId: input.userId,
      registrationId: input.registrationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyRegistrationConfirmed(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    registrationId: string;
    eventName: string;
  },
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, input.organizationId, [
      input.userId,
    ]);

    await notificationService.emit({
      organizationId: input.organizationId,
      eventType: "REGISTRATION_CONFIRMED",
      entityType: "REGISTRATION",
      entityId: input.registrationId,
      recipients,
      channels: ["IN_APP", "EMAIL"],
      url: "/minhas-inscricoes",
      payload: {
        event_name: input.eventName,
        registration_url: appUrl("/minhas-inscricoes"),
      },
    });
  } catch (error) {
    logError("registration_confirmed_notification_emit_failed", {
      organizationId: input.organizationId,
      userId: input.userId,
      registrationId: input.registrationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyPointsCredited(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    points: number;
    reason: string;
    referenceCode: string;
  },
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, input.organizationId, [
      input.userId,
    ]);

    await notificationService.emit({
      organizationId: input.organizationId,
      eventType: "POINTS_CREDITED",
      entityType: "POINT_LEDGER",
      entityId: input.referenceCode,
      recipients,
      channels: ["IN_APP", "EMAIL"],
      url: "/recompensas",
      payload: {
        points: input.points,
        reason: input.reason,
        points_url: appUrl("/recompensas"),
      },
    });
  } catch (error) {
    logError("points_credited_notification_emit_failed", {
      organizationId: input.organizationId,
      userId: input.userId,
      referenceCode: input.referenceCode,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyPointsExpiringSoon(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    points: number;
    expirationDate: Date;
    daysAhead: number;
  },
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, input.organizationId, [
      input.userId,
    ]);

    await notificationService.emit({
      organizationId: input.organizationId,
      eventType: "POINTS_EXPIRING_SOON",
      entityType: "POINTS_EXPIRATION",
      entityId: `${input.userId}-${input.daysAhead}-${formatDate(input.expirationDate)}`,
      recipients,
      channels: ["IN_APP", "EMAIL"],
      url: "/recompensas",
      payload: {
        points: input.points,
        expiration_date: formatDate(input.expirationDate),
        rewards_url: appUrl("/recompensas"),
      },
    });
  } catch (error) {
    logError("points_expiring_notification_emit_failed", {
      organizationId: input.organizationId,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyRewardRedeemed(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    redemptionId: string;
    rewardName: string;
    pointsUsed: number;
    status: string;
  },
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, input.organizationId, [
      input.userId,
    ]);

    await notificationService.emit({
      organizationId: input.organizationId,
      eventType: "REWARD_REDEEMED",
      entityType: "REWARD_REDEMPTION",
      entityId: input.redemptionId,
      recipients,
      channels: ["IN_APP", "EMAIL"],
      url: "/meus-resgates",
      payload: {
        reward_name: input.rewardName,
        points_used: input.pointsUsed,
        redemption_status: input.status,
        redemptions_url: appUrl("/meus-resgates"),
      },
    });
  } catch (error) {
    logError("reward_redeemed_notification_emit_failed", {
      organizationId: input.organizationId,
      userId: input.userId,
      redemptionId: input.redemptionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyBirthdayIndividual(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    points: number;
    year: number;
  },
): Promise<void> {
  try {
    const recipients = await getNotificationRecipientsByUserIds(prisma, input.organizationId, [
      input.userId,
    ]);

    await notificationService.emit({
      organizationId: input.organizationId,
      eventType: "BIRTHDAY_INDIVIDUAL",
      entityType: "BIRTHDAY",
      entityId: `${input.userId}-${input.year}`,
      recipients,
      channels: ["IN_APP", "EMAIL"],
      url: "/recompensas",
      payload: {
        points: input.points,
      },
    });
  } catch (error) {
    logError("birthday_notification_emit_failed", {
      organizationId: input.organizationId,
      userId: input.userId,
      year: input.year,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
