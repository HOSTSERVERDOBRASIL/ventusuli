-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."CollectiveStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."payments" DROP COLUMN "external_id",
ADD COLUMN     "efi_charge_id" TEXT,
ADD COLUMN     "efi_tx_id" TEXT,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "fee_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "net_cents" INTEGER NOT NULL,
ADD COLUMN     "pix_key" TEXT,
ADD COLUMN     "qr_code_url" TEXT,
ADD COLUMN     "user_id" TEXT NOT NULL,
ADD COLUMN     "webhook_payload" JSONB,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "public"."collective_signups" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."CollectiveStatus" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "max_members" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collective_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collective_members" (
    "id" TEXT NOT NULL,
    "collective_signup_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "distance_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collective_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collective_signups_event_id_idx" ON "public"."collective_signups"("event_id");

-- CreateIndex
CREATE INDEX "collective_signups_organization_id_idx" ON "public"."collective_signups"("organization_id");

-- CreateIndex
CREATE INDEX "collective_signups_status_idx" ON "public"."collective_signups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "collective_members_payment_id_key" ON "public"."collective_members"("payment_id");

-- CreateIndex
CREATE INDEX "collective_members_user_id_idx" ON "public"."collective_members"("user_id");

-- CreateIndex
CREATE INDEX "collective_members_distance_id_idx" ON "public"."collective_members"("distance_id");

-- CreateIndex
CREATE UNIQUE INDEX "collective_members_collective_signup_id_user_id_key" ON "public"."collective_members"("collective_signup_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_efi_charge_id_key" ON "public"."payments"("efi_charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_efi_tx_id_key" ON "public"."payments"("efi_tx_id");

-- CreateIndex
CREATE INDEX "payments_efi_tx_id_idx" ON "public"."payments"("efi_tx_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status");

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collective_signups" ADD CONSTRAINT "collective_signups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collective_signups" ADD CONSTRAINT "collective_signups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collective_signups" ADD CONSTRAINT "collective_signups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collective_members" ADD CONSTRAINT "collective_members_collective_signup_id_fkey" FOREIGN KEY ("collective_signup_id") REFERENCES "public"."collective_signups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collective_members" ADD CONSTRAINT "collective_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collective_members" ADD CONSTRAINT "collective_members_distance_id_fkey" FOREIGN KEY ("distance_id") REFERENCES "public"."event_distances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collective_members" ADD CONSTRAINT "collective_members_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

