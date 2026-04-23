ALTER TABLE "public"."notices"
  ALTER COLUMN "organization_id" DROP NOT NULL;

ALTER TABLE "public"."notice_deliveries"
  ALTER COLUMN "organization_id" DROP NOT NULL;

ALTER TABLE "public"."notices"
  DROP CONSTRAINT IF EXISTS "notices_organization_id_fkey";

ALTER TABLE "public"."notices"
  ADD CONSTRAINT "notices_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."notice_deliveries"
  DROP CONSTRAINT IF EXISTS "notice_deliveries_organization_id_fkey";

ALTER TABLE "public"."notice_deliveries"
  ADD CONSTRAINT "notice_deliveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
