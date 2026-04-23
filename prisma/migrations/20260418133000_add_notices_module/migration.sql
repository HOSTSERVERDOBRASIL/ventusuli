-- CreateEnum
CREATE TYPE "public"."NoticeAudience" AS ENUM ('ALL', 'ATHLETES', 'COACHES', 'ADMINS');

-- CreateEnum
CREATE TYPE "public"."NoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."NoticeChannel" AS ENUM ('IN_APP', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "public"."NoticeDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "public"."notices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "public"."NoticeAudience" NOT NULL DEFAULT 'ALL',
    "status" "public"."NoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publish_at" TIMESTAMP(3),
    "telegram_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notice_deliveries" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel" "public"."NoticeChannel" NOT NULL,
    "status" "public"."NoticeDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notices_organization_id_status_pinned_publish_at_idx" ON "public"."notices"("organization_id", "status", "pinned", "publish_at" DESC);

-- CreateIndex
CREATE INDEX "notices_created_by_created_at_idx" ON "public"."notices"("created_by", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notice_deliveries_notice_id_channel_key" ON "public"."notice_deliveries"("notice_id", "channel");

-- CreateIndex
CREATE INDEX "notice_deliveries_organization_id_channel_status_idx" ON "public"."notice_deliveries"("organization_id", "channel", "status");

-- CreateIndex
CREATE INDEX "notice_deliveries_sent_at_idx" ON "public"."notice_deliveries"("sent_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."notices" ADD CONSTRAINT "notices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notices" ADD CONSTRAINT "notices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notice_deliveries" ADD CONSTRAINT "notice_deliveries_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notice_deliveries" ADD CONSTRAINT "notice_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
