DO $$ BEGIN
  CREATE TYPE "public"."AthleteStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "public"."athlete_profiles"
ADD COLUMN IF NOT EXISTS "athlete_status" "public"."AthleteStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "athlete_profiles_organization_id_athlete_status_idx"
ON "public"."athlete_profiles"("organization_id", "athlete_status");
