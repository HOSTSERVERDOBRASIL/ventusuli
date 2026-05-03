DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationRacePlanStatus') THEN
    CREATE TYPE "public"."OrganizationRacePlanStatus" AS ENUM ('PLANNED', 'OPEN_TO_ATHLETES', 'REGISTRATION_CLOSED', 'TEAM_CONFIRMED', 'CANCELLED', 'COMPLETED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RacePlanAthleteAction') THEN
    CREATE TYPE "public"."RacePlanAthleteAction" AS ENUM ('INTEREST', 'CONFIRM', 'INTERNAL_REGISTRATION', 'EXTERNAL_LINK', 'TEAM_REGISTRATION', 'PAYMENT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AthleteRaceParticipationStatus') THEN
    CREATE TYPE "public"."AthleteRaceParticipationStatus" AS ENUM ('INTERESTED', 'CONFIRMED', 'PENDING_PAYMENT', 'PAID', 'REGISTERED_EXTERNALLY', 'IN_TEAM_REGISTRATION', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."organization_race_plans" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "external_event_id" TEXT,
  "created_by" TEXT NOT NULL,
  "status" "public"."OrganizationRacePlanStatus" NOT NULL DEFAULT 'PLANNED',
  "athlete_action" "public"."RacePlanAthleteAction" NOT NULL DEFAULT 'INTEREST',
  "audience" JSONB,
  "instructions" TEXT,
  "logistics" JSONB,
  "registration_url" TEXT,
  "opens_at" TIMESTAMP(3),
  "closes_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_race_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."athlete_race_participations" (
  "id" TEXT NOT NULL,
  "race_plan_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "distance_id" TEXT,
  "registration_id" TEXT,
  "status" "public"."AthleteRaceParticipationStatus" NOT NULL DEFAULT 'INTERESTED',
  "external_registration_url" TEXT,
  "external_registration_code" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "cancelled_at" TIMESTAMP(3),
  "attended_at" TIMESTAMP(3),

  CONSTRAINT "athlete_race_participations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_race_plans_organization_id_event_id_key"
  ON "public"."organization_race_plans"("organization_id", "event_id");
CREATE INDEX IF NOT EXISTS "organization_race_plans_organization_id_status_opens_at_idx"
  ON "public"."organization_race_plans"("organization_id", "status", "opens_at");
CREATE INDEX IF NOT EXISTS "organization_race_plans_organization_id_status_closes_at_idx"
  ON "public"."organization_race_plans"("organization_id", "status", "closes_at");
CREATE INDEX IF NOT EXISTS "organization_race_plans_event_id_idx"
  ON "public"."organization_race_plans"("event_id");
CREATE INDEX IF NOT EXISTS "organization_race_plans_external_event_id_idx"
  ON "public"."organization_race_plans"("external_event_id");

CREATE UNIQUE INDEX IF NOT EXISTS "athlete_race_participations_registration_id_key"
  ON "public"."athlete_race_participations"("registration_id");
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_race_participations_race_plan_id_user_id_key"
  ON "public"."athlete_race_participations"("race_plan_id", "user_id");
CREATE INDEX IF NOT EXISTS "athlete_race_participations_organization_id_status_created_at_idx"
  ON "public"."athlete_race_participations"("organization_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "athlete_race_participations_organization_id_user_id_created_at_idx"
  ON "public"."athlete_race_participations"("organization_id", "user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "athlete_race_participations_race_plan_id_status_idx"
  ON "public"."athlete_race_participations"("race_plan_id", "status");

ALTER TABLE "public"."organization_race_plans"
  ADD CONSTRAINT "organization_race_plans_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_race_plans"
  ADD CONSTRAINT "organization_race_plans_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."organization_race_plans"
  ADD CONSTRAINT "organization_race_plans_external_event_id_fkey"
  FOREIGN KEY ("external_event_id") REFERENCES "public"."external_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."organization_race_plans"
  ADD CONSTRAINT "organization_race_plans_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."athlete_race_participations"
  ADD CONSTRAINT "athlete_race_participations_race_plan_id_fkey"
  FOREIGN KEY ("race_plan_id") REFERENCES "public"."organization_race_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."athlete_race_participations"
  ADD CONSTRAINT "athlete_race_participations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."athlete_race_participations"
  ADD CONSTRAINT "athlete_race_participations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."athlete_race_participations"
  ADD CONSTRAINT "athlete_race_participations_distance_id_fkey"
  FOREIGN KEY ("distance_id") REFERENCES "public"."event_distances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."athlete_race_participations"
  ADD CONSTRAINT "athlete_race_participations_registration_id_fkey"
  FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
