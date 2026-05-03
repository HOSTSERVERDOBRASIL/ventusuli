DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalPlatformAuthType') THEN
    CREATE TYPE "public"."ExternalPlatformAuthType" AS ENUM ('BEARER_TOKEN', 'API_KEY', 'OAUTH2_CLIENT_CREDENTIALS', 'BASIC_AUTH');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalSyncType') THEN
    CREATE TYPE "public"."ExternalSyncType" AS ENUM ('EVENTS', 'REGISTRATIONS', 'ORDERS', 'PAYMENTS');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalSyncStatus') THEN
    CREATE TYPE "public"."ExternalSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'ERROR', 'PARTIAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."external_platforms" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "base_url" TEXT NOT NULL,
  "auth_type" "public"."ExternalPlatformAuthType" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_platforms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."platform_credentials" (
  "id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "encrypted_token" TEXT,
  "client_id" TEXT,
  "encrypted_client_secret" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."external_events" (
  "id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3),
  "location" TEXT,
  "status" TEXT,
  "raw_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."external_registrations" (
  "id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "external_event_id" TEXT NOT NULL,
  "participant_name" TEXT,
  "participant_email" TEXT,
  "participant_document" TEXT,
  "category" TEXT,
  "status" TEXT,
  "raw_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."external_orders" (
  "id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "external_event_id" TEXT,
  "buyer_name" TEXT,
  "buyer_email" TEXT,
  "amount" INTEGER,
  "payment_status" TEXT,
  "order_status" TEXT,
  "raw_payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."sync_logs" (
  "id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "sync_type" "public"."ExternalSyncType" NOT NULL,
  "status" "public"."ExternalSyncStatus" NOT NULL DEFAULT 'RUNNING',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "total_records" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "metadata" JSONB,

  CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "external_platforms_slug_key" ON "public"."external_platforms"("slug");
CREATE INDEX IF NOT EXISTS "external_platforms_slug_is_active_idx" ON "public"."external_platforms"("slug", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "platform_credentials_platform_id_organization_id_key" ON "public"."platform_credentials"("platform_id", "organization_id");
CREATE INDEX IF NOT EXISTS "platform_credentials_organization_id_idx" ON "public"."platform_credentials"("organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "external_events_platform_id_organization_id_external_id_key" ON "public"."external_events"("platform_id", "organization_id", "external_id");
CREATE INDEX IF NOT EXISTS "external_events_organization_id_date_idx" ON "public"."external_events"("organization_id", "date");
CREATE INDEX IF NOT EXISTS "external_events_platform_id_status_idx" ON "public"."external_events"("platform_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "external_registrations_platform_id_organization_id_external_id_key" ON "public"."external_registrations"("platform_id", "organization_id", "external_id");
CREATE INDEX IF NOT EXISTS "external_registrations_organization_id_external_event_id_idx" ON "public"."external_registrations"("organization_id", "external_event_id");
CREATE INDEX IF NOT EXISTS "external_registrations_platform_id_status_idx" ON "public"."external_registrations"("platform_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "external_orders_platform_id_organization_id_external_id_key" ON "public"."external_orders"("platform_id", "organization_id", "external_id");
CREATE INDEX IF NOT EXISTS "external_orders_organization_id_external_event_id_idx" ON "public"."external_orders"("organization_id", "external_event_id");
CREATE INDEX IF NOT EXISTS "external_orders_platform_id_payment_status_idx" ON "public"."external_orders"("platform_id", "payment_status");

CREATE INDEX IF NOT EXISTS "sync_logs_organization_id_started_at_idx" ON "public"."sync_logs"("organization_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "sync_logs_platform_id_sync_type_started_at_idx" ON "public"."sync_logs"("platform_id", "sync_type", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "sync_logs_status_started_at_idx" ON "public"."sync_logs"("status", "started_at" DESC);

ALTER TABLE "public"."platform_credentials"
  ADD CONSTRAINT "platform_credentials_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "public"."external_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."platform_credentials"
  ADD CONSTRAINT "platform_credentials_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."external_events"
  ADD CONSTRAINT "external_events_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "public"."external_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."external_registrations"
  ADD CONSTRAINT "external_registrations_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "public"."external_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."external_registrations"
  ADD CONSTRAINT "external_registrations_external_event_id_fkey"
  FOREIGN KEY ("external_event_id") REFERENCES "public"."external_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."external_orders"
  ADD CONSTRAINT "external_orders_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "public"."external_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."external_orders"
  ADD CONSTRAINT "external_orders_external_event_id_fkey"
  FOREIGN KEY ("external_event_id") REFERENCES "public"."external_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."sync_logs"
  ADD CONSTRAINT "sync_logs_platform_id_fkey"
  FOREIGN KEY ("platform_id") REFERENCES "public"."external_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "public"."external_platforms" ("id", "name", "slug", "base_url", "auth_type", "is_active", "updated_at")
VALUES ('ticketsports', 'TicketSports', 'ticketsports', COALESCE(NULLIF(current_setting('app.ticketsports_api_url', true), ''), 'https://api.ticketsports.com.br'), 'BEARER_TOKEN', true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
