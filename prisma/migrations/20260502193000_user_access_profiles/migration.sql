CREATE TABLE "public"."user_access_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "role" "public"."UserRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_access_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_access_profiles_user_id_role_key" ON "public"."user_access_profiles"("user_id", "role");
CREATE INDEX "user_access_profiles_organization_id_role_active_idx" ON "public"."user_access_profiles"("organization_id", "role", "active");
CREATE INDEX "user_access_profiles_user_id_active_idx" ON "public"."user_access_profiles"("user_id", "active");

ALTER TABLE "public"."user_access_profiles"
  ADD CONSTRAINT "user_access_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_access_profiles"
  ADD CONSTRAINT "user_access_profiles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
