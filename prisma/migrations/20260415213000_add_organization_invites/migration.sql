CREATE TABLE IF NOT EXISTS "public"."organization_invites" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMP(3),
  "max_uses" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_invites_token_key"
  ON "public"."organization_invites"("token");

CREATE INDEX IF NOT EXISTS "organization_invites_organization_id_active_idx"
  ON "public"."organization_invites"("organization_id", "active");

CREATE INDEX IF NOT EXISTS "organization_invites_token_active_idx"
  ON "public"."organization_invites"("token", "active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_invites_organization_id_fkey'
  ) THEN
    ALTER TABLE "public"."organization_invites"
      ADD CONSTRAINT "organization_invites_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
