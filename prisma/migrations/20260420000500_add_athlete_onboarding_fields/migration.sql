DO $$ BEGIN
  CREATE TYPE "public"."AthleteSignupSource" AS ENUM ('SLUG', 'INVITE', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "public"."athlete_profiles"
ADD COLUMN IF NOT EXISTS "signup_source" "public"."AthleteSignupSource" NOT NULL DEFAULT 'SLUG',
ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "athlete_profiles_organization_id_signup_source_idx"
ON "public"."athlete_profiles"("organization_id", "signup_source");
