DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'AuditActorType' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."AuditActorType" AS ENUM ('USER', 'SYSTEM', 'INTEGRATION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'InternalEventStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."InternalEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'PhotoGalleryStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."PhotoGalleryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'PhotoAssetStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."PhotoAssetStatus" AS ENUM ('PROCESSING', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'PhotoMatchType' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."PhotoMatchType" AS ENUM ('MANUAL', 'BIB_NUMBER', 'FACIAL_RECOGNITION', 'IMPORT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'PhotoMatchStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."PhotoMatchStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'PhotoPurchaseStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."PhotoPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'PhotoUnlockType' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."PhotoUnlockType" AS ENUM ('PURCHASE', 'POINTS', 'ADMIN_GRANT', 'PACKAGE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'SponsorStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."SponsorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'SponsorCampaignStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "public"."SponsorCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "actorId" TEXT,
  "actorType" "public"."AuditActorType" NOT NULL DEFAULT 'USER',
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "beforeData" JSONB,
  "afterData" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."internal_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB,
  "status" "public"."InternalEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "internal_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "internal_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "internal_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."photo_galleries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "coverPhotoId" TEXT,
  "status" "public"."PhotoGalleryStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "photo_galleries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photo_galleries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photo_galleries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."photos" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "galleryId" TEXT NOT NULL,
  "eventId" TEXT,
  "photographerId" TEXT,
  "originalStorageKey" TEXT NOT NULL,
  "previewStorageKey" TEXT,
  "thumbnailStorageKey" TEXT,
  "watermarkStorageKey" TEXT,
  "originalUrl" TEXT,
  "previewUrl" TEXT,
  "thumbnailUrl" TEXT,
  "watermarkUrl" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "pointsCost" INTEGER NOT NULL DEFAULT 0,
  "status" "public"."PhotoAssetStatus" NOT NULL DEFAULT 'PROCESSING',
  "metadata" JSONB,
  "takenAt" TIMESTAMP(3),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photos_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "public"."photo_galleries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photos_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "photos_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."photo_athlete_matches" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "bibNumber" TEXT,
  "matchType" "public"."PhotoMatchType" NOT NULL,
  "confidenceScore" DECIMAL(5,4),
  "status" "public"."PhotoMatchStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "photo_athlete_matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photo_athlete_matches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photo_athlete_matches_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photo_athlete_matches_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."photo_purchases" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "paymentId" TEXT,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "totalPoints" INTEGER NOT NULL DEFAULT 0,
  "status" "public"."PhotoPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "photo_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photo_purchases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photo_purchases_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."photo_purchase_items" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "pointsCost" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "photo_purchase_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photo_purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "public"."photo_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photo_purchase_items_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."photo_unlocks" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "unlockType" "public"."PhotoUnlockType" NOT NULL,
  "paymentId" TEXT,
  "pointTransactionId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "photo_unlocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "photo_unlocks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photo_unlocks_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "photo_unlocks_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."sponsors" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "description" TEXT,
  "websiteUrl" TEXT,
  "sponsorType" TEXT NOT NULL DEFAULT 'BRAND',
  "status" "public"."SponsorStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."sponsor_contacts" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sponsorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "roleTitle" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsor_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsor_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsor_contacts_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsor_contacts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."sponsor_campaigns" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sponsorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "campaignType" TEXT NOT NULL,
  "budgetCents" INTEGER NOT NULL DEFAULT 0,
  "pointsBudget" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "status" "public"."SponsorCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsor_campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsor_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsor_campaigns_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."sponsor_placements" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sponsorId" TEXT NOT NULL,
  "campaignId" TEXT,
  "placementArea" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "status" "public"."SponsorCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsor_placements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsor_placements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsor_placements_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsor_placements_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."sponsor_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."sponsor_campaign_events" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsor_campaign_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsor_campaign_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."sponsor_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsor_campaign_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."sponsor_metrics" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sponsorId" TEXT NOT NULL,
  "campaignId" TEXT,
  "placementArea" TEXT,
  "metricName" TEXT NOT NULL,
  "metricValue" INTEGER NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sponsor_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsor_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsor_metrics_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "audit_logs_organizationId_createdAt_idx" ON "public"."audit_logs"("organizationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_actorId_createdAt_idx" ON "public"."audit_logs"("actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "public"."audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx" ON "public"."audit_logs"("action", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "internal_events_organizationId_idempotencyKey_key" ON "public"."internal_events"("organizationId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "internal_events_organizationId_name_createdAt_idx" ON "public"."internal_events"("organizationId", "name", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "internal_events_organizationId_status_createdAt_idx" ON "public"."internal_events"("organizationId", "status", "createdAt" ASC);
CREATE INDEX IF NOT EXISTS "photo_galleries_organizationId_status_createdAt_idx" ON "public"."photo_galleries"("organizationId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "photo_galleries_organizationId_eventId_idx" ON "public"."photo_galleries"("organizationId", "eventId");
CREATE INDEX IF NOT EXISTS "photos_organizationId_galleryId_status_idx" ON "public"."photos"("organizationId", "galleryId", "status");
CREATE INDEX IF NOT EXISTS "photos_organizationId_eventId_status_idx" ON "public"."photos"("organizationId", "eventId", "status");
CREATE INDEX IF NOT EXISTS "photos_organizationId_uploadedAt_idx" ON "public"."photos"("organizationId", "uploadedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "photo_athlete_matches_photoId_athleteId_key" ON "public"."photo_athlete_matches"("photoId", "athleteId");
CREATE INDEX IF NOT EXISTS "photo_athlete_matches_organizationId_athleteId_status_idx" ON "public"."photo_athlete_matches"("organizationId", "athleteId", "status");
CREATE INDEX IF NOT EXISTS "photo_athlete_matches_organizationId_photoId_idx" ON "public"."photo_athlete_matches"("organizationId", "photoId");
CREATE INDEX IF NOT EXISTS "photo_purchases_organizationId_athleteId_createdAt_idx" ON "public"."photo_purchases"("organizationId", "athleteId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "photo_purchases_organizationId_status_createdAt_idx" ON "public"."photo_purchases"("organizationId", "status", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "photo_purchase_items_purchaseId_photoId_key" ON "public"."photo_purchase_items"("purchaseId", "photoId");
CREATE INDEX IF NOT EXISTS "photo_purchase_items_photoId_idx" ON "public"."photo_purchase_items"("photoId");
CREATE UNIQUE INDEX IF NOT EXISTS "photo_unlocks_organizationId_athleteId_photoId_key" ON "public"."photo_unlocks"("organizationId", "athleteId", "photoId");
CREATE INDEX IF NOT EXISTS "photo_unlocks_organizationId_athleteId_createdAt_idx" ON "public"."photo_unlocks"("organizationId", "athleteId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "photo_unlocks_organizationId_photoId_idx" ON "public"."photo_unlocks"("organizationId", "photoId");
CREATE INDEX IF NOT EXISTS "sponsors_organizationId_status_createdAt_idx" ON "public"."sponsors"("organizationId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "sponsor_contacts_organizationId_sponsorId_idx" ON "public"."sponsor_contacts"("organizationId", "sponsorId");
CREATE INDEX IF NOT EXISTS "sponsor_campaigns_organizationId_sponsorId_status_idx" ON "public"."sponsor_campaigns"("organizationId", "sponsorId", "status");
CREATE INDEX IF NOT EXISTS "sponsor_campaigns_organizationId_status_startsAt_endsAt_idx" ON "public"."sponsor_campaigns"("organizationId", "status", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "sponsor_placements_organizationId_placementArea_status_priority_idx" ON "public"."sponsor_placements"("organizationId", "placementArea", "status", "priority");
CREATE INDEX IF NOT EXISTS "sponsor_placements_organizationId_sponsorId_idx" ON "public"."sponsor_placements"("organizationId", "sponsorId");
CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_campaign_events_campaignId_eventId_key" ON "public"."sponsor_campaign_events"("campaignId", "eventId");
CREATE INDEX IF NOT EXISTS "sponsor_campaign_events_eventId_idx" ON "public"."sponsor_campaign_events"("eventId");
CREATE INDEX IF NOT EXISTS "sponsor_metrics_organizationId_sponsorId_metricName_periodEnd_idx" ON "public"."sponsor_metrics"("organizationId", "sponsorId", "metricName", "periodEnd" DESC);
