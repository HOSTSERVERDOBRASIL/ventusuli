CREATE TABLE IF NOT EXISTS "public"."platform_billing_invoices" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "amount_cents" INTEGER NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "payment_method" TEXT,
  "document_url" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_billing_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_billing_invoices_organization_id_due_at_idx"
ON "public"."platform_billing_invoices"("organization_id", "due_at" DESC);

CREATE INDEX IF NOT EXISTS "platform_billing_invoices_status_due_at_idx"
ON "public"."platform_billing_invoices"("status", "due_at");

ALTER TABLE "public"."platform_billing_invoices"
ADD CONSTRAINT "platform_billing_invoices_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
