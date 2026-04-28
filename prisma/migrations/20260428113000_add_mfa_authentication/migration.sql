CREATE TYPE "public"."MfaMethod" AS ENUM ('TOTP', 'EMAIL_OTP', 'RECOVERY_CODE');

CREATE TYPE "public"."AuthChallengePurpose" AS ENUM ('LOGIN_MFA', 'MFA_SETUP');

ALTER TABLE "public"."refresh_tokens"
ADD COLUMN "remember_me" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "public"."user_mfa_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" TEXT,
    "email_otp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "recovery_codes_hashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recovery_codes_version" INTEGER NOT NULL DEFAULT 1,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mfa_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."auth_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "purpose" "public"."AuthChallengePurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "primary_method" "public"."MfaMethod" NOT NULL DEFAULT 'TOTP',
    "available_methods" "public"."MfaMethod"[] DEFAULT ARRAY['TOTP']::"public"."MfaMethod"[],
    "email_otp_code_hash" TEXT,
    "temp_totp_secret" TEXT,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "email_otp_sent_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_mfa_settings_user_id_key" ON "public"."user_mfa_settings"("user_id");
CREATE INDEX "user_mfa_settings_organization_id_enabled_idx" ON "public"."user_mfa_settings"("organization_id", "enabled");

CREATE UNIQUE INDEX "auth_challenges_token_hash_key" ON "public"."auth_challenges"("token_hash");
CREATE INDEX "auth_challenges_user_id_purpose_expires_at_idx" ON "public"."auth_challenges"("user_id", "purpose", "expires_at" DESC);
CREATE INDEX "auth_challenges_organization_id_purpose_created_at_idx" ON "public"."auth_challenges"("organization_id", "purpose", "created_at" DESC);
CREATE INDEX "auth_challenges_expires_at_idx" ON "public"."auth_challenges"("expires_at");

ALTER TABLE "public"."user_mfa_settings"
ADD CONSTRAINT "user_mfa_settings_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_mfa_settings"
ADD CONSTRAINT "user_mfa_settings_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."auth_challenges"
ADD CONSTRAINT "auth_challenges_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."auth_challenges"
ADD CONSTRAINT "auth_challenges_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
