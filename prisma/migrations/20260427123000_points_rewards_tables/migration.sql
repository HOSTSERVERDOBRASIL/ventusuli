DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerType') THEN
    CREATE TYPE "public"."LedgerType" AS ENUM ('CREDIT', 'DEBIT', 'EXPIRATION', 'ADJUSTMENT', 'REFUND');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerSource') THEN
    CREATE TYPE "public"."LedgerSource" AS ENUM (
      'EVENT_PARTICIPATION',
      'EARLY_SIGNUP',
      'EARLY_PAYMENT',
      'CAMPAIGN_BONUS',
      'REFERRAL',
      'RECURRENCE',
      'MANUAL',
      'REDEMPTION',
      'EXPIRATION'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RedemptionStatus') THEN
    CREATE TYPE "public"."RedemptionStatus" AS ENUM (
      'REQUESTED',
      'PENDING_PAYMENT',
      'APPROVED',
      'SEPARATED',
      'DELIVERED',
      'CANCELLED',
      'PAYMENT_FAILED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."EventPointRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventId" TEXT,
  "basePoints" INTEGER NOT NULL DEFAULT 10,
  "earlySignupBonus" INTEGER NOT NULL DEFAULT 5,
  "earlyPaymentBonus" INTEGER NOT NULL DEFAULT 3,
  "campaignBonus" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventPointRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."AthletePointLedger" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT,
  "registrationId" TEXT,
  "type" "public"."LedgerType" NOT NULL,
  "sourceType" "public"."LedgerSource" NOT NULL,
  "points" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "referenceCode" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AthletePointLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."RewardItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "imageUrl" TEXT,
  "pointsCost" INTEGER NOT NULL,
  "cashPriceCents" INTEGER NOT NULL DEFAULT 0,
  "allowPoints" BOOLEAN NOT NULL DEFAULT true,
  "allowCash" BOOLEAN NOT NULL DEFAULT false,
  "allowMixed" BOOLEAN NOT NULL DEFAULT false,
  "maxPointsDiscountPercent" INTEGER NOT NULL DEFAULT 40,
  "minimumCashCents" INTEGER NOT NULL DEFAULT 0,
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."RewardRedemption" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "pointsUsed" INTEGER NOT NULL DEFAULT 0,
  "cashPaidCents" INTEGER NOT NULL DEFAULT 0,
  "paymentId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "public"."RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventPointRule_organizationId_eventId_active_idx"
ON "public"."EventPointRule"("organizationId", "eventId", "active");

CREATE INDEX IF NOT EXISTS "AthletePointLedger_organizationId_userId_createdAt_idx"
ON "public"."AthletePointLedger"("organizationId", "userId", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "AthletePointLedger_referenceCode_key"
ON "public"."AthletePointLedger"("referenceCode");

CREATE INDEX IF NOT EXISTS "RewardItem_organizationId_active_idx"
ON "public"."RewardItem"("organizationId", "active");

CREATE INDEX IF NOT EXISTS "RewardRedemption_organizationId_userId_status_idx"
ON "public"."RewardRedemption"("organizationId", "userId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "RewardRedemption_idempotencyKey_key"
ON "public"."RewardRedemption"("idempotencyKey");

ALTER TABLE "public"."EventPointRule"
ADD CONSTRAINT "EventPointRule_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."AthletePointLedger"
ADD CONSTRAINT "AthletePointLedger_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."AthletePointLedger"
ADD CONSTRAINT "AthletePointLedger_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."RewardItem"
ADD CONSTRAINT "RewardItem_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."RewardRedemption"
ADD CONSTRAINT "RewardRedemption_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."RewardRedemption"
ADD CONSTRAINT "RewardRedemption_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."RewardRedemption"
ADD CONSTRAINT "RewardRedemption_rewardItemId_fkey"
FOREIGN KEY ("rewardItemId") REFERENCES "public"."RewardItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
