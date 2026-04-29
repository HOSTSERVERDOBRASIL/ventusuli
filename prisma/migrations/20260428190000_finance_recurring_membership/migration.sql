ALTER TABLE "public"."financial_entries"
ADD COLUMN IF NOT EXISTS "subject_user_id" TEXT,
ADD COLUMN IF NOT EXISTS "reference_code" TEXT;

CREATE INDEX IF NOT EXISTS "financial_entries_organization_id_subject_user_id_idx"
ON "public"."financial_entries"("organization_id", "subject_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "financial_entries_organization_id_reference_code_key"
ON "public"."financial_entries"("organization_id", "reference_code");

ALTER TABLE "public"."financial_entries"
ADD CONSTRAINT "financial_entries_subject_user_id_fkey"
FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
