export function isDemoModeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function buildAuthHeaders(accessToken?: string | null): HeadersInit | undefined {
  if (!accessToken) return undefined;
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
