-- CreateEnum
CREATE TYPE "public"."StravaSyncTrigger" AS ENUM ('WEBHOOK', 'MANUAL', 'OAUTH_CALLBACK', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "public"."StravaSyncStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'SYNCED', 'SKIPPED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."strava_sync_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "strava_athlete_id" TEXT NOT NULL,
    "trigger" "public"."StravaSyncTrigger" NOT NULL DEFAULT 'WEBHOOK',
    "status" "public"."StravaSyncStatus" NOT NULL DEFAULT 'RECEIVED',
    "idempotency_key" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "aspect_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "event_time" TIMESTAMP(3),
    "payload" JSONB,
    "sync_result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strava_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "strava_sync_logs_idempotency_key_key" ON "public"."strava_sync_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "strava_sync_logs_status_created_at_idx" ON "public"."strava_sync_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "strava_sync_logs_organization_id_created_at_idx" ON "public"."strava_sync_logs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "strava_sync_logs_strava_athlete_id_created_at_idx" ON "public"."strava_sync_logs"("strava_athlete_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."strava_sync_logs" ADD CONSTRAINT "strava_sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strava_sync_logs" ADD CONSTRAINT "strava_sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
