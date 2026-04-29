DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus') THEN
    CREATE TYPE "public"."AttendanceStatus" AS ENUM ('PENDING', 'PRESENT', 'ABSENT');
  END IF;
END $$;

ALTER TABLE "public"."registrations"
ADD COLUMN IF NOT EXISTS "attendance_status" "public"."AttendanceStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "public"."registrations"
ADD COLUMN IF NOT EXISTS "attendance_checked_at" TIMESTAMP(3);

ALTER TABLE "public"."registrations"
ADD COLUMN IF NOT EXISTS "attendance_checked_by" TEXT;

CREATE INDEX IF NOT EXISTS "registrations_organization_id_event_id_attendance_status_idx"
ON "public"."registrations"("organization_id", "event_id", "attendance_status");
