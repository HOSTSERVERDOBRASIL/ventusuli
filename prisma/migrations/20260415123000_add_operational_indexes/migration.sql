-- Performance indexes for dashboard and operational lists
CREATE INDEX IF NOT EXISTS "events_organization_id_status_event_date_idx"
ON "public"."events"("organization_id", "status", "event_date");

CREATE INDEX IF NOT EXISTS "registrations_organization_id_status_registered_at_idx"
ON "public"."registrations"("organization_id", "status", "registered_at");

CREATE INDEX IF NOT EXISTS "payments_organization_id_status_created_at_idx"
ON "public"."payments"("organization_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "payments_user_id_status_created_at_idx"
ON "public"."payments"("user_id", "status", "created_at");
