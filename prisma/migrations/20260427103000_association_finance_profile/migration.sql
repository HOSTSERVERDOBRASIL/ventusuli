ALTER TABLE "public"."financial_entries"
ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PAID',
ADD COLUMN IF NOT EXISTS "entry_kind" TEXT NOT NULL DEFAULT 'CASH',
ADD COLUMN IF NOT EXISTS "account_code" TEXT,
ADD COLUMN IF NOT EXISTS "cost_center" TEXT,
ADD COLUMN IF NOT EXISTS "counterparty" TEXT,
ADD COLUMN IF NOT EXISTS "payment_method" TEXT,
ADD COLUMN IF NOT EXISTS "document_url" TEXT;

CREATE INDEX IF NOT EXISTS "financial_entries_organization_id_status_idx"
ON "public"."financial_entries"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "financial_entries_organization_id_entry_kind_idx"
ON "public"."financial_entries"("organization_id", "entry_kind");
