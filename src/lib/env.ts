import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function optionalNonEmptyString(minLength = 1) {
  return z.preprocess(emptyToUndefined, z.string().min(minLength).optional());
}

function optionalUrl() {
  return z.preprocess(emptyToUndefined, z.string().url().optional());
}

function optionalBooleanEnum() {
  return z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional());
}

function optionalPositiveInteger() {
  return z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional());
}

const requiredEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters."),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 characters."),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL."),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL."),
});

const optionalIntegrationEnvSchema = z.object({
  PUBLIC_ADMIN_REGISTRATION_ENABLED: optionalBooleanEnum(),
  NEXT_PUBLIC_PUBLIC_ADMIN_REGISTRATION_ENABLED: optionalBooleanEnum(),
  SUPER_ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  SUPER_ADMIN_PASSWORD: optionalNonEmptyString(8),
  STRAVA_CLIENT_ID: optionalNonEmptyString(),
  STRAVA_CLIENT_SECRET: optionalNonEmptyString(),
  STRAVA_REDIRECT_URI: optionalUrl(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: optionalNonEmptyString(8),
  TELEGRAM_NOTICES_ENABLED: optionalBooleanEnum(),
  TELEGRAM_BOT_TOKEN: optionalNonEmptyString(),
  TELEGRAM_CHAT_ID: optionalNonEmptyString(),
  EFI_CLIENT_ID: optionalNonEmptyString(),
  EFI_CLIENT_SECRET: optionalNonEmptyString(),
  EFI_SANDBOX: optionalBooleanEnum(),
  EFI_CERT_PATH: optionalNonEmptyString(),
  PAYMENT_WEBHOOK_SECRET: optionalNonEmptyString(16),
  RATE_LIMIT_BACKEND: z.preprocess(
    emptyToUndefined,
    z.enum(["auto", "memory", "redis", "upstash"]).optional(),
  ),
  REDIS_URL: optionalNonEmptyString(),
  UPSTASH_REDIS_REST_URL: optionalUrl(),
  UPSTASH_REDIS_REST_TOKEN: optionalNonEmptyString(),
  STORAGE_ENDPOINT: optionalNonEmptyString(),
  STORAGE_BUCKET: optionalNonEmptyString(),
  STORAGE_ACCESS_KEY: optionalNonEmptyString(),
  STORAGE_SECRET_KEY: optionalNonEmptyString(),
  STORAGE_PUBLIC_BASE_URL: optionalUrl(),
  STORAGE_DRIVER: z.preprocess(emptyToUndefined, z.enum(["local", "s3"]).optional()),
  UPLOAD_MAX_FILE_MB: optionalPositiveInteger(),
});

export type RequiredRuntimeEnv = z.infer<typeof requiredEnvSchema>;
export type OptionalIntegrationEnv = z.infer<typeof optionalIntegrationEnvSchema>;
export type RuntimeEnv = RequiredRuntimeEnv & OptionalIntegrationEnv;

let cachedRequiredEnv: RequiredRuntimeEnv | null = null;
let cachedOptionalEnv: OptionalIntegrationEnv | null = null;

function formatError(error: z.ZodError): string {
  return error.errors.map((item) => `${item.path.join(".")}: ${item.message}`).join("; ");
}

export function getRequiredRuntimeEnv(): RequiredRuntimeEnv {
  if (cachedRequiredEnv) return cachedRequiredEnv;

  const parsed = requiredEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid required environment configuration: ${formatError(parsed.error)}`);
  }

  cachedRequiredEnv = parsed.data;
  return cachedRequiredEnv;
}

export function getOptionalIntegrationEnv(): OptionalIntegrationEnv {
  if (cachedOptionalEnv) return cachedOptionalEnv;

  const parsed = optionalIntegrationEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid optional integration environment configuration: ${formatError(parsed.error)}`,
    );
  }

  cachedOptionalEnv = parsed.data;
  return cachedOptionalEnv;
}

export function getRuntimeEnv(): RuntimeEnv {
  return {
    ...getRequiredRuntimeEnv(),
    ...getOptionalIntegrationEnv(),
  };
}

export function assertRuntimeEnvOrThrow(): void {
  getRuntimeEnv();
}
