DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoyaltyLevelKey') THEN
    CREATE TYPE "public"."LoyaltyLevelKey" AS ENUM ('STARTER', 'MEMBER', 'PLUS', 'PRIME', 'BLACK');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoyaltyMissionType') THEN
    CREATE TYPE "public"."LoyaltyMissionType" AS ENUM (
      'ONBOARDING',
      'FREQUENCY',
      'SPEND',
      'ENGAGEMENT',
      'SEASONAL',
      'DYNAMIC'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoyaltyMissionStatus') THEN
    CREATE TYPE "public"."LoyaltyMissionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserMissionStatus') THEN
    CREATE TYPE "public"."UserMissionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CLAIMED', 'EXPIRED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoyaltyBadgeCategory') THEN
    CREATE TYPE "public"."LoyaltyBadgeCategory" AS ENUM ('FIRST_ACTION', 'RECURRENT', 'ELITE', 'REFERRAL', 'SPECIAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."users_loyalty" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "currentLevelKey" "public"."LoyaltyLevelKey" NOT NULL DEFAULT 'STARTER',
  "availablePoints" INTEGER NOT NULL DEFAULT 0,
  "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" TIMESTAMP(3),
  "inactivityDowngradeAt" TIMESTAMP(3),
  "streakCurrent" INTEGER NOT NULL DEFAULT 0,
  "streakBest" INTEGER NOT NULL DEFAULT 0,
  "lastStreakAt" TIMESTAMP(3),
  "segment" TEXT NOT NULL DEFAULT 'novo',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_loyalty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."loyalty_levels" (
  "id" TEXT NOT NULL,
  "key" "public"."LoyaltyLevelKey" NOT NULL,
  "name" TEXT NOT NULL,
  "minLifetimePoints" INTEGER NOT NULL,
  "multiplier" DECIMAL(5,2) NOT NULL,
  "benefits" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."missions" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "public"."LoyaltyMissionType" NOT NULL,
  "targetValue" INTEGER NOT NULL DEFAULT 1,
  "rewardPoints" INTEGER NOT NULL DEFAULT 0,
  "rewardBadgeId" TEXT,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "repeatable" BOOLEAN NOT NULL DEFAULT false,
  "status" "public"."LoyaltyMissionStatus" NOT NULL DEFAULT 'ACTIVE',
  "levelRequirement" "public"."LoyaltyLevelKey",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."user_missions" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cycleKey" TEXT NOT NULL DEFAULT 'default',
  "progressValue" INTEGER NOT NULL DEFAULT 0,
  "status" "public"."UserMissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "completedAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_missions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."badges" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "category" "public"."LoyaltyBadgeCategory" NOT NULL DEFAULT 'SPECIAL',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."user_badges" (
  "id" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."loyalty_program_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "eventName" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_program_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_loyalty_userId_key"
ON "public"."users_loyalty"("userId");

CREATE INDEX IF NOT EXISTS "users_loyalty_organizationId_currentLevelKey_idx"
ON "public"."users_loyalty"("organizationId", "currentLevelKey");

CREATE INDEX IF NOT EXISTS "users_loyalty_organizationId_segment_idx"
ON "public"."users_loyalty"("organizationId", "segment");

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_levels_key_key"
ON "public"."loyalty_levels"("key");

CREATE INDEX IF NOT EXISTS "loyalty_levels_active_sortOrder_idx"
ON "public"."loyalty_levels"("active", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "missions_organizationId_code_key"
ON "public"."missions"("organizationId", "code");

CREATE INDEX IF NOT EXISTS "missions_organizationId_status_type_idx"
ON "public"."missions"("organizationId", "status", "type");

CREATE INDEX IF NOT EXISTS "missions_organizationId_startAt_endAt_idx"
ON "public"."missions"("organizationId", "startAt", "endAt");

CREATE UNIQUE INDEX IF NOT EXISTS "user_missions_missionId_userId_cycleKey_key"
ON "public"."user_missions"("missionId", "userId", "cycleKey");

CREATE INDEX IF NOT EXISTS "user_missions_organizationId_status_updatedAt_idx"
ON "public"."user_missions"("organizationId", "status", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "user_missions_userId_status_updatedAt_idx"
ON "public"."user_missions"("userId", "status", "updatedAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "badges_organizationId_code_key"
ON "public"."badges"("organizationId", "code");

CREATE INDEX IF NOT EXISTS "badges_organizationId_category_active_idx"
ON "public"."badges"("organizationId", "category", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "user_badges_badgeId_userId_key"
ON "public"."user_badges"("badgeId", "userId");

CREATE INDEX IF NOT EXISTS "user_badges_organizationId_awardedAt_idx"
ON "public"."user_badges"("organizationId", "awardedAt" DESC);

CREATE INDEX IF NOT EXISTS "user_badges_userId_awardedAt_idx"
ON "public"."user_badges"("userId", "awardedAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_program_events_organizationId_sourceEventId_key"
ON "public"."loyalty_program_events"("organizationId", "sourceEventId");

CREATE INDEX IF NOT EXISTS "loyalty_program_events_organizationId_eventName_createdAt_idx"
ON "public"."loyalty_program_events"("organizationId", "eventName", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "loyalty_program_events_userId_createdAt_idx"
ON "public"."loyalty_program_events"("userId", "createdAt" DESC);

ALTER TABLE "public"."users_loyalty"
ADD CONSTRAINT "users_loyalty_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."users_loyalty"
ADD CONSTRAINT "users_loyalty_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."missions"
ADD CONSTRAINT "missions_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."missions"
ADD CONSTRAINT "missions_rewardBadgeId_fkey"
FOREIGN KEY ("rewardBadgeId") REFERENCES "public"."badges"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."user_missions"
ADD CONSTRAINT "user_missions_missionId_fkey"
FOREIGN KEY ("missionId") REFERENCES "public"."missions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_missions"
ADD CONSTRAINT "user_missions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_missions"
ADD CONSTRAINT "user_missions_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."badges"
ADD CONSTRAINT "badges_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_badges"
ADD CONSTRAINT "user_badges_badgeId_fkey"
FOREIGN KEY ("badgeId") REFERENCES "public"."badges"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_badges"
ADD CONSTRAINT "user_badges_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_badges"
ADD CONSTRAINT "user_badges_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."loyalty_program_events"
ADD CONSTRAINT "loyalty_program_events_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."loyalty_program_events"
ADD CONSTRAINT "loyalty_program_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "public"."loyalty_levels" (
  "id",
  "key",
  "name",
  "minLifetimePoints",
  "multiplier",
  "benefits",
  "active",
  "sortOrder"
)
VALUES
  (
    'loyalty-level-starter',
    'STARTER',
    'Ventus Starter',
    0,
    1.00,
    '{"benefits":["pontos base","missoes iniciais"]}'::jsonb,
    true,
    1
  ),
  (
    'loyalty-level-member',
    'MEMBER',
    'Ventus Member',
    1000,
    1.20,
    '{"benefits":["multiplicador 1.2x","bonus de frequencia"]}'::jsonb,
    true,
    2
  ),
  (
    'loyalty-level-plus',
    'PLUS',
    'Ventus Plus',
    5000,
    1.50,
    '{"benefits":["multiplicador 1.5x","cashback maior","ofertas exclusivas"]}'::jsonb,
    true,
    3
  ),
  (
    'loyalty-level-prime',
    'PRIME',
    'Ventus Prime',
    20000,
    2.00,
    '{"benefits":["multiplicador 2.0x","atendimento prioritario","campanhas privadas"]}'::jsonb,
    true,
    4
  ),
  (
    'loyalty-level-black',
    'BLACK',
    'Ventus Black',
    75000,
    3.00,
    '{"benefits":["multiplicador 3.0x","recompensas exclusivas","status maximo"]}'::jsonb,
    true,
    5
  )
ON CONFLICT ("key") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "minLifetimePoints" = EXCLUDED."minLifetimePoints",
  "multiplier" = EXCLUDED."multiplier",
  "benefits" = EXCLUDED."benefits",
  "active" = EXCLUDED."active",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "public"."users_loyalty" (
  "id",
  "userId",
  "organizationId",
  "currentLevelKey",
  "availablePoints",
  "lifetimePoints",
  "lastActivityAt",
  "segment"
)
SELECT
  'loyalty-' || u.id,
  u.id,
  u.organization_id,
  'STARTER'::"public"."LoyaltyLevelKey",
  0,
  0,
  u.created_at,
  'novo'
FROM "public"."users" u
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "public"."badges" (
  "id",
  "organizationId",
  "code",
  "name",
  "description",
  "icon",
  "category",
  "metadata"
)
SELECT
  'badge-first-action-' || o.id,
  o.id,
  'first-action',
  'Primeira Acao',
  'Conquistado ao completar a primeira acao elegivel no programa.',
  'sparkles',
  'FIRST_ACTION'::"public"."LoyaltyBadgeCategory",
  '{"eventName":"points.earned"}'::jsonb
FROM "public"."organizations" o
ON CONFLICT ("organizationId", "code") DO NOTHING;

INSERT INTO "public"."badges" (
  "id",
  "organizationId",
  "code",
  "name",
  "description",
  "icon",
  "category",
  "metadata"
)
SELECT
  'badge-recurring-' || o.id,
  o.id,
  'recurring-athlete',
  'Cliente Recorrente',
  'Mantem frequencia e volta a pontuar em ciclos seguidos.',
  'repeat',
  'RECURRENT'::"public"."LoyaltyBadgeCategory",
  '{"streakWeeks":4}'::jsonb
FROM "public"."organizations" o
ON CONFLICT ("organizationId", "code") DO NOTHING;

INSERT INTO "public"."missions" (
  "id",
  "organizationId",
  "code",
  "name",
  "description",
  "type",
  "targetValue",
  "rewardPoints",
  "repeatable",
  "status",
  "metadata"
)
SELECT
  'mission-onboarding-' || o.id,
  o.id,
  'complete-onboarding',
  'Concluir onboarding',
  'Complete cadastro, perfil e primeira interacao para desbloquear o programa.',
  'ONBOARDING'::"public"."LoyaltyMissionType",
  1,
  100,
  false,
  'ACTIVE'::"public"."LoyaltyMissionStatus",
  '{"eventName":"user.created"}'::jsonb
FROM "public"."organizations" o
ON CONFLICT ("organizationId", "code") DO NOTHING;

INSERT INTO "public"."missions" (
  "id",
  "organizationId",
  "code",
  "name",
  "description",
  "type",
  "targetValue",
  "rewardPoints",
  "repeatable",
  "status",
  "metadata"
)
SELECT
  'mission-first-purchase-' || o.id,
  o.id,
  'first-purchase',
  'Primeira compra',
  'Ganhe pontos extras na primeira compra ou pagamento confirmado.',
  'SPEND'::"public"."LoyaltyMissionType",
  1,
  250,
  false,
  'ACTIVE'::"public"."LoyaltyMissionStatus",
  '{"eventName":"purchase.completed"}'::jsonb
FROM "public"."organizations" o
ON CONFLICT ("organizationId", "code") DO NOTHING;

INSERT INTO "public"."missions" (
  "id",
  "organizationId",
  "code",
  "name",
  "description",
  "type",
  "targetValue",
  "rewardPoints",
  "repeatable",
  "status",
  "metadata"
)
SELECT
  'mission-referral-' || o.id,
  o.id,
  'first-referral',
  'Primeira indicacao',
  'Convide um novo atleta elegivel e ganhe bonus de indicacao.',
  'ENGAGEMENT'::"public"."LoyaltyMissionType",
  1,
  500,
  true,
  'ACTIVE'::"public"."LoyaltyMissionStatus",
  '{"eventName":"referral.confirmed"}'::jsonb
FROM "public"."organizations" o
ON CONFLICT ("organizationId", "code") DO NOTHING;
