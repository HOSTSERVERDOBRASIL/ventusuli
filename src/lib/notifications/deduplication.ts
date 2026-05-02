export function createNotificationDeduplicationKey(input: {
  organizationId: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  recipientId: string;
  channel: string;
}): string {
  return [
    input.organizationId,
    input.eventType,
    input.entityType ?? "GENERAL",
    input.entityId ?? "NONE",
    input.recipientId,
    input.channel,
  ].join(":");
}
