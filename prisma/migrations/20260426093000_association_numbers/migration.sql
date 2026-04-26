ALTER TABLE "public"."athlete_profiles"
ADD COLUMN "member_sequence" INTEGER,
ADD COLUMN "member_number" TEXT,
ADD COLUMN "member_since" TIMESTAMP(3);

WITH numbered AS (
  SELECT
    ap.id,
    ROW_NUMBER() OVER (
      PARTITION BY ap.organization_id
      ORDER BY ap.created_at ASC, ap.id ASC
    ) AS seq
  FROM "public"."athlete_profiles" ap
  WHERE ap.athlete_status = 'ACTIVE'
)
UPDATE "public"."athlete_profiles" ap
SET
  member_sequence = numbered.seq,
  member_number = 'ASSOC-' || LPAD(numbered.seq::TEXT, 5, '0'),
  member_since = COALESCE(ap.onboarding_completed_at, ap.created_at)
FROM numbered
WHERE ap.id = numbered.id;

CREATE UNIQUE INDEX "athlete_profiles_organization_member_sequence_key"
ON "public"."athlete_profiles"("organization_id", "member_sequence");

CREATE UNIQUE INDEX "athlete_profiles_organization_member_number_key"
ON "public"."athlete_profiles"("organization_id", "member_number");

CREATE INDEX "athlete_profiles_member_number_idx"
ON "public"."athlete_profiles"("member_number");
