ALTER TABLE "public"."organization_invites"
ADD COLUMN "invite_kind" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN "invited_email" TEXT,
ADD COLUMN "invited_name" TEXT,
ADD COLUMN "created_by" TEXT,
ADD COLUMN "accepted_user_id" TEXT,
ADD COLUMN "accepted_at" TIMESTAMP(3);

CREATE INDEX "organization_invites_created_by_idx" ON "public"."organization_invites"("created_by");
CREATE INDEX "organization_invites_invited_email_idx" ON "public"."organization_invites"("invited_email");
CREATE INDEX "organization_invites_invite_kind_idx" ON "public"."organization_invites"("invite_kind");

ALTER TABLE "public"."organization_invites"
ADD CONSTRAINT "organization_invites_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."organization_invites"
ADD CONSTRAINT "organization_invites_accepted_user_id_fkey"
FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
