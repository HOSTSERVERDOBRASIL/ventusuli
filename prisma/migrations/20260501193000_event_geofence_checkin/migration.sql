ALTER TABLE "public"."events"
ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "check_in_radius_m" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS "proximity_radius_m" INTEGER NOT NULL DEFAULT 200;

ALTER TABLE "public"."registrations"
ADD COLUMN IF NOT EXISTS "check_in_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "check_in_latitude" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "check_in_longitude" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "check_in_distance_m" INTEGER,
ADD COLUMN IF NOT EXISTS "check_out_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "check_out_latitude" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "check_out_longitude" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "check_out_distance_m" INTEGER;

CREATE INDEX IF NOT EXISTS "registrations_organization_id_event_id_check_in_at_idx"
ON "public"."registrations"("organization_id", "event_id", "check_in_at");
