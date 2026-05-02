-- Central de notificacoes por usuario, integrada ao modulo de avisos existente.

ALTER TYPE "public"."LedgerSource" ADD VALUE IF NOT EXISTS 'BIRTHDAY';

CREATE TABLE "public"."notification_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "marketing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "events_enabled" BOOLEAN NOT NULL DEFAULT true,
    "training_enabled" BOOLEAN NOT NULL DEFAULT true,
    "birthday_message_enabled" BOOLEAN NOT NULL DEFAULT true,
    "birthday_public_enabled" BOOLEAN NOT NULL DEFAULT false,
    "financial_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."notification_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "recipient_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "payload" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "deduplication_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."notification_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "job_id" TEXT,
    "recipient_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request_payload" JSONB,
    "provider_response" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_templates_organization_id_code_channel_version_key"
ON "public"."notification_templates"("organization_id", "code", "channel", "version");

CREATE INDEX "notification_templates_code_channel_is_active_idx"
ON "public"."notification_templates"("code", "channel", "is_active");

CREATE INDEX "notification_templates_organization_id_code_idx"
ON "public"."notification_templates"("organization_id", "code");

CREATE UNIQUE INDEX "notification_preferences_user_id_key"
ON "public"."notification_preferences"("user_id");

CREATE INDEX "notification_preferences_organization_id_idx"
ON "public"."notification_preferences"("organization_id");

CREATE INDEX "notification_preferences_user_id_idx"
ON "public"."notification_preferences"("user_id");

CREATE UNIQUE INDEX "notification_jobs_deduplication_key_key"
ON "public"."notification_jobs"("deduplication_key");

CREATE INDEX "notification_jobs_organization_id_recipient_id_channel_created_at_idx"
ON "public"."notification_jobs"("organization_id", "recipient_id", "channel", "created_at" DESC);

CREATE INDEX "notification_jobs_organization_id_status_scheduled_at_idx"
ON "public"."notification_jobs"("organization_id", "status", "scheduled_at" ASC);

CREATE INDEX "notification_jobs_recipient_id_read_at_created_at_idx"
ON "public"."notification_jobs"("recipient_id", "read_at", "created_at" DESC);

CREATE INDEX "notification_jobs_entity_type_entity_id_idx"
ON "public"."notification_jobs"("entity_type", "entity_id");

CREATE INDEX "notification_logs_organization_id_created_at_idx"
ON "public"."notification_logs"("organization_id", "created_at" DESC);

CREATE INDEX "notification_logs_job_id_idx"
ON "public"."notification_logs"("job_id");

CREATE INDEX "notification_logs_recipient_id_created_at_idx"
ON "public"."notification_logs"("recipient_id", "created_at" DESC);

ALTER TABLE "public"."notification_templates"
ADD CONSTRAINT "notification_templates_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notification_preferences"
ADD CONSTRAINT "notification_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notification_preferences"
ADD CONSTRAINT "notification_preferences_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notification_jobs"
ADD CONSTRAINT "notification_jobs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notification_jobs"
ADD CONSTRAINT "notification_jobs_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notification_logs"
ADD CONSTRAINT "notification_logs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."notification_logs"
ADD CONSTRAINT "notification_logs_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "public"."notification_jobs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."notification_logs"
ADD CONSTRAINT "notification_logs_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
