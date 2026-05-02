import { NoticeAudience, PrismaClient, UserRole } from "@prisma/client";
import type { NotificationPreferenceSnapshot, NotificationRecipient } from "./types";

const ADMIN_NOTICE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.MODERATOR,
  UserRole.FINANCE,
  UserRole.ORGANIZER,
  UserRole.SUPPORT,
];

function mapPreferences(
  preferences: NotificationPreferenceSnapshot | null | undefined,
): NotificationPreferenceSnapshot | null {
  if (!preferences) return null;
  return {
    emailEnabled: preferences.emailEnabled,
    whatsappEnabled: preferences.whatsappEnabled,
    smsEnabled: preferences.smsEnabled,
    inAppEnabled: preferences.inAppEnabled,
    marketingEnabled: preferences.marketingEnabled,
    eventsEnabled: preferences.eventsEnabled,
    trainingEnabled: preferences.trainingEnabled,
    birthdayMessageEnabled: preferences.birthdayMessageEnabled,
    birthdayPublicEnabled: preferences.birthdayPublicEnabled,
    financialEnabled: preferences.financialEnabled,
  };
}

function mapUserToRecipient(user: {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  athlete_profile: { phone: string | null } | null;
  notification_preference: NotificationPreferenceSnapshot | null;
}): NotificationRecipient {
  const phone = user.athlete_profile?.phone ?? null;
  return {
    id: user.id,
    organizationId: user.organization_id,
    name: user.name,
    email: user.email,
    phone,
    whatsapp: phone,
    preferences: mapPreferences(user.notification_preference),
  };
}

function audienceWhere(audience: NoticeAudience) {
  if (audience === NoticeAudience.ATHLETES) {
    return { role: { in: [UserRole.ATHLETE, UserRole.PREMIUM_ATHLETE] } };
  }

  if (audience === NoticeAudience.COACHES) {
    return { role: UserRole.COACH };
  }

  if (audience === NoticeAudience.ADMINS) {
    return { role: { in: ADMIN_NOTICE_ROLES } };
  }

  return {};
}

export async function getNotificationRecipientsForAudience(
  prisma: PrismaClient,
  organizationId: string,
  audience: NoticeAudience,
): Promise<NotificationRecipient[]> {
  const users = await prisma.user.findMany({
    where: {
      organization_id: organizationId,
      account_status: "ACTIVE",
      ...audienceWhere(audience),
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      email: true,
      athlete_profile: { select: { phone: true } },
      notification_preference: {
        select: {
          emailEnabled: true,
          whatsappEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
          marketingEnabled: true,
          eventsEnabled: true,
          trainingEnabled: true,
          birthdayMessageEnabled: true,
          birthdayPublicEnabled: true,
          financialEnabled: true,
        },
      },
    },
    take: 5000,
  });

  return users.map(mapUserToRecipient);
}

export async function getNotificationRecipientsByUserIds(
  prisma: PrismaClient,
  organizationId: string,
  userIds: string[],
): Promise<NotificationRecipient[]> {
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      organization_id: organizationId,
    },
    select: {
      id: true,
      organization_id: true,
      name: true,
      email: true,
      athlete_profile: { select: { phone: true } },
      notification_preference: {
        select: {
          emailEnabled: true,
          whatsappEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
          marketingEnabled: true,
          eventsEnabled: true,
          trainingEnabled: true,
          birthdayMessageEnabled: true,
          birthdayPublicEnabled: true,
          financialEnabled: true,
        },
      },
    },
  });

  return users.map(mapUserToRecipient);
}
