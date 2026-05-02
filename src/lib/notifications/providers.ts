import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import { logInfo } from "@/lib/logger";
import { getOptionalIntegrationEnv } from "@/lib/env";
import type { ProviderResult } from "./types";

export interface EmailProvider {
  send(input: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<ProviderResult>;
}

export interface WhatsAppProvider {
  send(input: {
    to: string;
    message: string;
    templateName?: string;
    variables?: Record<string, string>;
    category?: "TRANSACTIONAL" | "REMINDER" | "URGENT" | "COMMUNITY" | "BIRTHDAY";
  }): Promise<ProviderResult>;
}

export interface SmsProvider {
  send(input: {
    to: string;
    message: string;
    category?: "CODE" | "URGENT" | "REMINDER" | "TRANSACTIONAL";
  }): Promise<ProviderResult>;
}

export interface InAppNotificationProvider {
  send(input: {
    userId: string;
    title: string;
    message: string;
    url?: string | null;
    type: string;
  }): Promise<ProviderResult>;
}

export interface NotificationProviders {
  email: EmailProvider;
  whatsapp: WhatsAppProvider;
  sms: SmsProvider;
  inApp: InAppNotificationProvider;
}

function createSmtpEmailProvider(): EmailProvider | null {
  const env = getOptionalIntegrationEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;

  const port = env.SMTP_PORT ?? 587;
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465;
  const from = env.EMAIL_FROM ?? env.SMTP_USER;
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return {
    async send(input) {
      try {
        const result = await transporter.sendMail({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        });

        logInfo("notification_email_sent", {
          to: input.to,
          subject: input.subject,
          messageId: result.messageId,
        });

        return {
          success: true,
          providerMessageId: result.messageId,
          raw: {
            accepted: result.accepted,
            rejected: result.rejected,
            response: result.response,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    },
  };
}

export function createLoggingNotificationProviders(): NotificationProviders {
  const smtpEmailProvider = createSmtpEmailProvider();

  return {
    email: smtpEmailProvider ?? {
      async send(input) {
        logInfo("notification_email_simulated", {
          to: input.to,
          subject: input.subject,
        });
        return {
          success: process.env.NODE_ENV !== "production",
          providerMessageId: process.env.NODE_ENV !== "production" ? randomUUID() : undefined,
          raw: { simulated: true, configured: false },
          error:
            process.env.NODE_ENV === "production"
              ? "SMTP nao configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS."
              : undefined,
        };
      },
    },
    whatsapp: {
      async send(input) {
        logInfo("notification_whatsapp_simulated", {
          to: input.to,
          templateName: input.templateName ?? null,
        });
        return { success: true, providerMessageId: randomUUID(), raw: { simulated: true } };
      },
    },
    sms: {
      async send(input) {
        logInfo("notification_sms_simulated", {
          to: input.to,
          category: input.category ?? null,
        });
        return { success: true, providerMessageId: randomUUID(), raw: { simulated: true } };
      },
    },
    inApp: {
      async send(input) {
        logInfo("notification_in_app_recorded", {
          userId: input.userId,
          type: input.type,
          hasUrl: Boolean(input.url),
        });
        return { success: true, providerMessageId: randomUUID(), raw: { persisted: true } };
      },
    },
  };
}
