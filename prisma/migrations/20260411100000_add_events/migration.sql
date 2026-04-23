-- CreateEnum
CREATE TYPE "public"."EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED');

-- CreateEnum
CREATE TYPE "public"."RegistrationStatus" AS ENUM ('INTERESTED', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" CHAR(2),
    "address" TEXT,
    "event_date" TIMESTAMP(3) NOT NULL,
    "registration_deadline" TIMESTAMP(3),
    "description" TEXT,
    "image_url" TEXT,
    "external_url" TEXT,
    "status" "public"."EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."event_distances" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "distance_km" DECIMAL(6,3) NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "max_slots" INTEGER,
    "registered_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_distances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "distance_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "public"."RegistrationStatus" NOT NULL DEFAULT 'INTERESTED',
    "notes" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_organization_id_idx" ON "public"."events"("organization_id");

-- CreateIndex
CREATE INDEX "events_event_date_idx" ON "public"."events"("event_date");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "public"."events"("status");

-- CreateIndex
CREATE INDEX "event_distances_event_id_idx" ON "public"."event_distances"("event_id");

-- CreateIndex
CREATE INDEX "registrations_organization_id_idx" ON "public"."registrations"("organization_id");

-- CreateIndex
CREATE INDEX "registrations_user_id_idx" ON "public"."registrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_user_id_event_id_distance_id_key" ON "public"."registrations"("user_id", "event_id", "distance_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_registration_id_key" ON "public"."payments"("registration_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_idx" ON "public"."payments"("organization_id");

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_distances" ADD CONSTRAINT "event_distances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_distance_id_fkey" FOREIGN KEY ("distance_id") REFERENCES "public"."event_distances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

