ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'FINANCE';

CREATE TABLE IF NOT EXISTS "public"."financial_entries" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "financial_entries_organization_id_occurred_at_idx"
ON "public"."financial_entries"("organization_id", "occurred_at" DESC);

CREATE INDEX IF NOT EXISTS "financial_entries_organization_id_type_idx"
ON "public"."financial_entries"("organization_id", "type");

ALTER TABLE "public"."financial_entries"
ADD CONSTRAINT "financial_entries_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."financial_entries"
ADD CONSTRAINT "financial_entries_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
