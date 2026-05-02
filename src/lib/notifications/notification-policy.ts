import type {
  NotificationChannel,
  NotificationEventType,
  NotificationPreferenceSnapshot,
  NotificationRecipient,
} from "./types";

export function resolveNotificationChannels(eventType: NotificationEventType): NotificationChannel[] {
  if (eventType === "NOTICE_PUBLISHED") {
    return ["IN_APP"];
  }

  if (eventType.includes("CANCELLED") || eventType.includes("UPDATED")) {
    return ["IN_APP", "EMAIL", "WHATSAPP", "SMS"];
  }

  if (eventType.includes("REMINDER")) {
    return ["IN_APP", "WHATSAPP", "SMS"];
  }

  if (eventType.includes("BIRTHDAY")) {
    return ["IN_APP", "WHATSAPP"];
  }

  if (eventType.includes("PAYMENT")) {
    return ["IN_APP", "EMAIL", "WHATSAPP", "SMS"];
  }

  return ["IN_APP", "EMAIL"];
}

function categoryEnabled(
  eventType: NotificationEventType,
  preferences: NotificationPreferenceSnapshot | null | undefined,
): boolean {
  if (!preferences) return true;
  if (eventType.includes("EVENT")) return preferences.eventsEnabled !== false;
  if (eventType.includes("TRAINING")) return preferences.trainingEnabled !== false;
  if (eventType.includes("BIRTHDAY")) return preferences.birthdayMessageEnabled !== false;
  if (eventType.includes("PAYMENT")) return preferences.financialEnabled !== false;
  return true;
}

export function canSendToNotificationChannel(
  eventType: NotificationEventType,
  recipient: NotificationRecipient,
  channel: NotificationChannel,
): boolean {
  const preferences = recipient.preferences;
  if (!categoryEnabled(eventType, preferences)) return false;

  if (channel === "IN_APP") return preferences?.inAppEnabled !== false;
  if (channel === "EMAIL") return Boolean(recipient.email) && preferences?.emailEnabled !== false;
  if (channel === "WHATSAPP") {
    return Boolean(recipient.whatsapp) && preferences?.whatsappEnabled === true;
  }
  if (channel === "SMS") return Boolean(recipient.phone) && preferences?.smsEnabled === true;

  return false;
}

export function skippedNotificationStatus(
  recipient: NotificationRecipient,
  channel: NotificationChannel,
): "SKIPPED_NO_CONTACT" | "SKIPPED_NO_CONSENT" {
  if (channel === "EMAIL" && !recipient.email) return "SKIPPED_NO_CONTACT";
  if (channel === "WHATSAPP" && !recipient.whatsapp) return "SKIPPED_NO_CONTACT";
  if (channel === "SMS" && !recipient.phone) return "SKIPPED_NO_CONTACT";
  return "SKIPPED_NO_CONSENT";
}
