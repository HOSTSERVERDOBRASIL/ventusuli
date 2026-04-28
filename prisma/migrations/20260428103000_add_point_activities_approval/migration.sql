DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LedgerSource'
      AND e.enumlabel = 'ACTIVITY_APPROVAL'
  ) THEN
    ALTER TYPE "public"."LedgerSource" ADD VALUE 'ACTIVITY_APPROVAL';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PointActivityEntryStatus') THEN
    CREATE TYPE "public"."PointActivityEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PointActivityEntrySource') THEN
    CREATE TYPE "public"."PointActivityEntrySource" AS ENUM ('ADMIN', 'USER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."point_activities" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "suggestedPoints" INTEGER NOT NULL DEFAULT 0,
  "activityDate" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "point_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."point_activity_entries" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "status" "public"."PointActivityEntryStatus" NOT NULL DEFAULT 'PENDING',
  "source" "public"."PointActivityEntrySource" NOT NULL DEFAULT 'ADMIN',
  "note" TEXT,
  "proofUrl" TEXT,
  "referenceCode" TEXT NOT NULL,
  "ledgerEntryId" TEXT,
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  CONSTRAINT "point_activity_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "point_activity_entries_referenceCode_key"
ON "public"."point_activity_entries"("referenceCode");

CREATE UNIQUE INDEX IF NOT EXISTS "point_activity_entries_activityId_userId_key"
ON "public"."point_activity_entries"("activityId", "userId");

CREATE INDEX IF NOT EXISTS "point_activities_organizationId_activityDate_idx"
ON "public"."point_activities"("organizationId", "activityDate" DESC);

CREATE INDEX IF NOT EXISTS "point_activities_organizationId_active_idx"
ON "public"."point_activities"("organizationId", "active");

CREATE INDEX IF NOT EXISTS "point_activity_entries_organizationId_status_createdAt_idx"
ON "public"."point_activity_entries"("organizationId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "point_activity_entries_organizationId_userId_createdAt_idx"
ON "public"."point_activity_entries"("organizationId", "userId", "createdAt" DESC);

ALTER TABLE "public"."point_activities"
ADD CONSTRAINT "point_activities_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."point_activity_entries"
ADD CONSTRAINT "point_activity_entries_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."point_activity_entries"
ADD CONSTRAINT "point_activity_entries_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "public"."point_activities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."point_activity_entries"
ADD CONSTRAINT "point_activity_entries_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
