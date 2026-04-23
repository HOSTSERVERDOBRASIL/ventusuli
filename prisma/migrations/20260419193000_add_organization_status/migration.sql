-- CreateEnum
CREATE TYPE "public"."OrgStatus" AS ENUM ('PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."organizations"
ADD COLUMN "status" "public"."OrgStatus" NOT NULL DEFAULT 'PENDING_SETUP';

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "public"."organizations"("status");
