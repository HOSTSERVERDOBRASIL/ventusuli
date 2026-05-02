import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { logWarn } from "@/lib/logger";
import { createNotificationDeduplicationKey } from "./deduplication";
import {
  canSendToNotificationChannel,
  resolveNotificationChannels,
  skippedNotificationStatus,
} from "./notification-policy";
import { normalizeBrazilPhone } from "./phone";
import type { NotificationProviders } from "./providers";
import { resolveNotificationTemplateCode } from "./template-map";
import { renderTemplate } from "./template-renderer";
import { notificationTemplates, type NotificationTemplateSeed } from "./templates";
import type {
  EmitNotificationInput,
  NotificationChannel,
  NotificationJobRecord,
  NotificationRecipient,
  NotificationStatus,
  ProviderResult,
} from "./types";

interface EmitNotificationResult {
  created: number;
  sent: number;
  skipped: number;
}

interface PersistJobInput {
  organizationId: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  recipientId: string;
  channel: NotificationChannel;
  templateCode: string;
  title: string;
  subject?: string | null;
  body: string;
  url?: string | null;
  payload: Record<string, string | number | boolean | null | undefined>;
  scheduledAt: Date;
  status: NotificationStatus;
  deduplicationKey: string;
}

function findStaticTemplate(code: string) {
  return notificationTemplates.find((template) => template.code === code) ?? null;
}

function jsonb(value: unknown) {
  return Prisma.sql`${JSON.stringify(value ?? null)}::jsonb`;
}

function isDue(scheduledAt: Date): boolean {
  return scheduledAt.getTime() <= Date.now();
}

function initialStatus(scheduledAt: Date): NotificationStatus {
  return isDue(scheduledAt) ? "PENDING" : "SCHEDULED";
}

export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly providers: NotificationProviders,
  ) {}

  async emit(input: EmitNotificationInput): Promise<EmitNotificationResult> {
    const channels = input.channels ?? resolveNotificationChannels(input.eventType);
    const scheduledAt = input.scheduledAt ?? new Date();
    const result: EmitNotificationResult = { created: 0, sent: 0, skipped: 0 };

    for (const recipient of input.recipients) {
      for (const channel of channels) {
        const templateCode = resolveNotificationTemplateCode(input.eventType, channel);
        if (!templateCode) {
          logWarn("notification_template_not_mapped", {
            eventType: input.eventType,
            channel,
          });
          result.skipped += 1;
          continue;
        }

        const template = await this.findTemplate(input.organizationId, templateCode, channel);
        if (!template) {
          logWarn("notification_template_missing", { templateCode });
          result.skipped += 1;
          continue;
        }

        const payload = {
          ...input.payload,
          nome: recipient.name,
        };
        const subject = template.subject ? renderTemplate(template.subject, payload) : null;
        const body = renderTemplate(template.body, payload);
        const title = subject ?? "Ventu Suli";
        const deduplicationKey = createNotificationDeduplicationKey({
          organizationId: input.organizationId,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          recipientId: recipient.id,
          channel,
        });
        const allowed = canSendToNotificationChannel(input.eventType, recipient, channel);
        const status = allowed
          ? initialStatus(scheduledAt)
          : skippedNotificationStatus(recipient, channel);

        const job = await this.persistJob({
          organizationId: input.organizationId,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          recipientId: recipient.id,
          channel,
          templateCode,
          title,
          subject,
          body,
          url: input.url,
          payload,
          scheduledAt,
          status,
          deduplicationKey,
        });

        if (!job) {
          result.skipped += 1;
          continue;
        }

        result.created += 1;

        if (!allowed) {
          await this.createLog(job, "policy", status, {
            channel,
            recipientId: recipient.id,
          });
          result.skipped += 1;
          continue;
        }

        if (status === "PENDING") {
          const sent = await this.sendJob(job, recipient);
          result.sent += sent ? 1 : 0;
        }
      }
    }

    return result;
  }

  private async findTemplate(
    organizationId: string,
    code: string,
    channel: NotificationChannel,
  ): Promise<NotificationTemplateSeed | null> {
    const records = await this.prisma.notificationTemplate.findMany({
      where: {
        code,
        channel,
        organizationId: { in: [organizationId] },
      },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      take: 1,
    });

    const record = records[0];
    if (record) {
      if (!record.isActive) return null;
      return {
        code: record.code,
        name: record.name,
        channel: record.channel as NotificationChannel,
        audience: record.audience,
        subject: record.subject ?? undefined,
        body: record.body,
      };
    }

    return findStaticTemplate(code);
  }

  private async persistJob(input: PersistJobInput): Promise<NotificationJobRecord | null> {
    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<NotificationJobRecord[]>(Prisma.sql`
      INSERT INTO "public"."notification_jobs" (
        "id",
        "organization_id",
        "event_type",
        "entity_type",
        "entity_id",
        "recipient_id",
        "channel",
        "template_code",
        "title",
        "subject",
        "body",
        "url",
        "payload",
        "scheduled_at",
        "status",
        "deduplication_key",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${id},
        ${input.organizationId},
        ${input.eventType},
        ${input.entityType ?? null},
        ${input.entityId ?? null},
        ${input.recipientId},
        ${input.channel},
        ${input.templateCode},
        ${input.title},
        ${input.subject ?? null},
        ${input.body},
        ${input.url ?? null},
        ${jsonb(input.payload)},
        ${input.scheduledAt},
        ${input.status},
        ${input.deduplicationKey},
        ${new Date()},
        ${new Date()}
      )
      ON CONFLICT ("deduplication_key") DO NOTHING
      RETURNING
        "id",
        "organization_id",
        "event_type",
        "entity_type",
        "entity_id",
        "recipient_id",
        "channel",
        "template_code",
        "title",
        "subject",
        "body",
        "url",
        "payload",
        "scheduled_at",
        "status",
        "attempts",
        "deduplication_key"
    `);

    return rows[0] ?? null;
  }

  private async sendJob(
    job: NotificationJobRecord,
    recipient: NotificationRecipient,
  ): Promise<boolean> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "public"."notification_jobs"
      SET "status" = 'SENDING',
          "updated_at" = ${new Date()}
      WHERE "id" = ${job.id}
    `);

    const { provider, requestPayload, result } = await this.dispatch(job, recipient);
    const status: NotificationStatus = result.success ? "SENT" : "FAILED_TEMPORARY";
    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "public"."notification_jobs"
      SET "status" = ${status},
          "sent_at" = ${result.success ? now : null},
          "attempts" = "attempts" + 1,
          "last_error" = ${result.success ? null : result.error ?? "Falha no provider."},
          "provider" = ${provider},
          "provider_message_id" = ${result.providerMessageId ?? null},
          "updated_at" = ${now}
      WHERE "id" = ${job.id}
    `);

    await this.createLog(job, provider, status, requestPayload, result);
    return result.success;
  }

  private async dispatch(
    job: NotificationJobRecord,
    recipient: NotificationRecipient,
  ): Promise<{
    provider: string;
    requestPayload: Record<string, unknown>;
    result: ProviderResult;
  }> {
    if (job.channel === "EMAIL") {
      const requestPayload = {
        to: recipient.email,
        subject: job.subject ?? "Ventu Suli",
      };
      if (!recipient.email) {
        return {
          provider: "email",
          requestPayload,
          result: { success: false, error: "E-mail ausente para o destinatario." },
        };
      }
      return {
        provider: "email",
        requestPayload,
        result: await this.providers.email.send({
          to: recipient.email,
          subject: job.subject ?? "Ventu Suli",
          html: job.body.replace(/\n/g, "<br />"),
          text: job.body,
        }),
      };
    }

    if (job.channel === "WHATSAPP") {
      const phone = normalizeBrazilPhone(recipient.whatsapp);
      const requestPayload = {
        to: phone,
        templateName: job.template_code,
      };
      if (!phone) {
        return {
          provider: "whatsapp",
          requestPayload,
          result: { success: false, error: "WhatsApp ausente para o destinatario." },
        };
      }
      return {
        provider: "whatsapp",
        requestPayload,
        result: await this.providers.whatsapp.send({
          to: phone,
          message: job.body,
          templateName: job.template_code,
        }),
      };
    }

    if (job.channel === "SMS") {
      const phone = normalizeBrazilPhone(recipient.phone);
      const requestPayload = { to: phone };
      if (!phone) {
        return {
          provider: "sms",
          requestPayload,
          result: { success: false, error: "Telefone ausente para o destinatario." },
        };
      }
      return {
        provider: "sms",
        requestPayload,
        result: await this.providers.sms.send({
          to: phone,
          message: job.body,
        }),
      };
    }

    return {
      provider: "in_app",
      requestPayload: {
        userId: recipient.id,
        type: job.template_code,
        hasUrl: Boolean(job.url),
      },
      result: await this.providers.inApp.send({
        userId: recipient.id,
        title: job.title,
        message: job.body,
        url: job.url,
        type: job.template_code,
      }),
    };
  }

  private async createLog(
    job: NotificationJobRecord,
    provider: string,
    status: NotificationStatus,
    requestPayload?: unknown,
    providerResponse?: ProviderResult,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "public"."notification_logs" (
        "id",
        "organization_id",
        "job_id",
        "recipient_id",
        "channel",
        "provider",
        "status",
        "request_payload",
        "provider_response",
        "error_message",
        "created_at"
      )
      VALUES (
        ${randomUUID()},
        ${job.organization_id},
        ${job.id},
        ${job.recipient_id},
        ${job.channel},
        ${provider},
        ${status},
        ${requestPayload === undefined ? null : jsonb(requestPayload)},
        ${providerResponse === undefined ? null : jsonb(providerResponse.raw ?? providerResponse)},
        ${providerResponse?.success === false ? providerResponse.error ?? "Falha no provider." : null},
        ${new Date()}
      )
    `);
  }
}
