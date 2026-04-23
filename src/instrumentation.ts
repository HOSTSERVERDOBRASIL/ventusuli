import { assertRuntimeEnvOrThrow, getRequiredRuntimeEnv } from "@/lib/env";

export async function register(): Promise<void> {
  const required = getRequiredRuntimeEnv();

  if (required.NODE_ENV === "production") {
    assertRuntimeEnvOrThrow();
  }
}
