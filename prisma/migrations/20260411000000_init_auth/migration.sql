-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'COACH', 'ATHLETE');

-- CreateEnum
CREATE TYPE "public"."OrgPlan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "public"."organizations" (
    "id"              TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "logo_url"        TEXT,
    "plan"            "public"."OrgPlan" NOT NULL DEFAULT 'FREE',
    "plan_expires_at" TIMESTAMP(3),
    "settings"        JSONB,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email"           TEXT NOT NULL,
    "password_hash"   TEXT NOT NULL,
    "role"            "public"."UserRole" NOT NULL DEFAULT 'ATHLETE',
    "name"            TEXT NOT NULL,
    "avatar_url"      TEXT,
    "email_verified"  BOOLEAN NOT NULL DEFAULT false,
    "last_login_at"   TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id"              TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "token_hash"      TEXT NOT NULL,
    "expires_at"      TIMESTAMP(3) NOT NULL,
    "revoked"         BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."athlete_profiles" (
    "id"                TEXT NOT NULL,
    "user_id"           TEXT NOT NULL,
    "organization_id"   TEXT NOT NULL,
    "cpf"               TEXT,
    "birth_date"        TIMESTAMP(3),
    "gender"            TEXT,
    "phone"             TEXT,
    "city"              TEXT,
    "state"             TEXT,
    "weight_kg"         DECIMAL(5,2),
    "height_cm"         INTEGER,
    "shirt_size"        TEXT,
    "emergency_contact" JSONB,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "public"."organizations"("slug");
CREATE INDEX "organizations_slug_idx" ON "public"."organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE INDEX "users_organization_id_idx" ON "public"."users"("organization_id");
CREATE INDEX "users_email_idx" ON "public"."users"("email");
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "public"."refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_organization_id_idx" ON "public"."refresh_tokens"("organization_id");
CREATE INDEX "refresh_tokens_token_hash_idx" ON "public"."refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "public"."refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_profiles_user_id_key" ON "public"."athlete_profiles"("user_id");
CREATE INDEX "athlete_profiles_organization_id_idx" ON "public"."athlete_profiles"("organization_id");
CREATE INDEX "athlete_profiles_user_id_idx" ON "public"."athlete_profiles"("user_id");
CREATE INDEX "athlete_profiles_cpf_idx" ON "public"."athlete_profiles"("cpf");

-- AddForeignKey
ALTER TABLE "public"."users"
    ADD CONSTRAINT "users_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "public"."organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "public"."organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_profiles"
    ADD CONSTRAINT "athlete_profiles_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "public"."users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."athlete_profiles"
    ADD CONSTRAINT "athlete_profiles_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "public"."organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
