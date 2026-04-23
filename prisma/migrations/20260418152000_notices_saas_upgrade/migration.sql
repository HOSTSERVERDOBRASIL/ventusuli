-- AlterTable
ALTER TABLE "public"."notice_deliveries"
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notice_deliveries_organization_id_created_at_idx"
ON "public"."notice_deliveries"("organization_id", "created_at" DESC);
