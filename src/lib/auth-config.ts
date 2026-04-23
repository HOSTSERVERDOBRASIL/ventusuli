import { getRequiredRuntimeEnv } from "@/lib/env";

export type DemoRuntimeMode = "production" | "disabled" | "enabled";

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getDemoRuntimeMode(): DemoRuntimeMode {
  if (isProductionRuntime()) return "production";
  return process.env.DEMO_AUTH_ENABLED === "true" ? "enabled" : "disabled";
}

export function isDemoRuntimeEnabled(): boolean {
  return getDemoRuntimeMode() === "enabled";
}

export function isDemoUiEnabled(): boolean {
  if (isProductionRuntime()) return false;
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function isPublicAdminRegistrationEnabled(): boolean {
  if (isProductionRuntime()) return false;

  const raw = process.env.PUBLIC_ADMIN_REGISTRATION_ENABLED;
  return raw === "true";
}

export function isPublicAdminRegistrationUiEnabled(): boolean {
  if (isProductionRuntime()) return false;

  const raw = process.env.NEXT_PUBLIC_PUBLIC_ADMIN_REGISTRATION_ENABLED;
  return raw === "true";
}

// Backward-compatible alias for older call sites.
export function isDemoModeEnabled(): boolean {
  return isDemoRuntimeEnabled();
}

export function assertAuthSecretsForRuntime(): void {
  getRequiredRuntimeEnv();
}

export function getAuthConfigError(): string | null {
  try {
    assertAuthSecretsForRuntime();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid auth configuration.";
  }
}
