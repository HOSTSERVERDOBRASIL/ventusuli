-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('ACTIVE', 'PENDING_INVITE', 'PENDING_APPROVAL', 'SUSPENDED');

-- AlterTable
ALTER TABLE "public"."users"
ADD COLUMN "account_status" "public"."AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "public"."admin_activation_invites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "invited_by" TEXT,
    "invitee_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activation_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_activation_invites_token_key" ON "public"."admin_activation_invites"("token");

-- CreateIndex
CREATE INDEX "admin_activation_invites_organization_id_active_idx" ON "public"."admin_activation_invites"("organization_id", "active");

-- CreateIndex
CREATE INDEX "admin_activation_invites_email_idx" ON "public"."admin_activation_invites"("email");

-- CreateIndex
CREATE INDEX "admin_activation_invites_token_active_idx" ON "public"."admin_activation_invites"("token", "active");

-- AddForeignKey
ALTER TABLE "public"."admin_activation_invites" ADD CONSTRAINT "admin_activation_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;