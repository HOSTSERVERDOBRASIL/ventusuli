export type NotificationChannel = "IN_APP" | "EMAIL" | "WHATSAPP" | "SMS";

export type NotificationStatus =
  | "PENDING"
  | "SCHEDULED"
  | "SENDING"
  | "SENT"
  | "FAILED_TEMPORARY"
  | "FAILED_PERMANENT"
  | "CANCELLED"
  | "SKIPPED_NO_CONSENT"
  | "SKIPPED_NO_CONTACT"
  | "SKIPPED_DUPLICATE";

export type NotificationEventType =
  | "NOTICE_PUBLISHED"
  | "ATHLETE_REGISTERED"
  | "ATHLETE_APPROVED"
  | "ATHLETE_REJECTED"
  | "EVENT_PUBLISHED"
  | "EVENT_UPDATED"
  | "EVENT_CANCELLED"
  | "EVENT_REMINDER_7_DAYS"
  | "EVENT_REMINDER_1_DAY"
  | "EVENT_REMINDER_2_HOURS"
  | "TRAINING_PUBLISHED"
  | "TRAINING_UPDATED"
  | "TRAINING_CANCELLED"
  | "TRAINING_REMINDER_1_DAY"
  | "TRAINING_REMINDER_2_HOURS"
  | "BIRTHDAY_INDIVIDUAL"
  | "BIRTHDAYS_OF_DAY"
  | "MONTHLY_PLANNING_SUMMARY"
  | "PAYMENT_PENDING"
  | "REGISTRATION_CONFIRMED"
  | "POINTS_CREDITED"
  | "POINTS_EXPIRING_SOON"
  | "REWARD_REDEEMED";

export interface NotificationPreferenceSnapshot {
  emailEnabled?: boolean;
  whatsappEnabled?: boolean;
  smsEnabled?: boolean;
  inAppEnabled?: boolean;
  marketingEnabled?: boolean;
  eventsEnabled?: boolean;
  trainingEnabled?: boolean;
  birthdayMessageEnabled?: boolean;
  birthdayPublicEnabled?: boolean;
  financialEnabled?: boolean;
}

export interface NotificationRecipient {
  id: string;
  organizationId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  preferences?: NotificationPreferenceSnapshot | null;
}

export interface EmitNotificationInput {
  organizationId: string;
  eventType: NotificationEventType;
  entityType?: string;
  entityId?: string;
  recipients: NotificationRecipient[];
  payload: Record<string, string | number | boolean | null | undefined>;
  channels?: NotificationChannel[];
  scheduledAt?: Date;
  url?: string | null;
}

export interface ProviderResult {
  success: boolean;
  providerMessageId?: string;
  raw?: unknown;
  error?: string;
}

export interface NotificationJobRecord {
  id: string;
  organization_id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  recipient_id: string;
  channel: NotificationChannel;
  template_code: string;
  title: string;
  subject: string | null;
  body: string;
  url: string | null;
  payload: unknown;
  scheduled_at: Date;
  status: NotificationStatus;
  attempts: number;
  deduplication_key: string;
}
