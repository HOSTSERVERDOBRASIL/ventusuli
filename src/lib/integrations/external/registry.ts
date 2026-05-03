import type { PlatformIntegration } from "@/lib/integrations/external/types";

type IntegrationFactory = (organizationId: string) => Promise<PlatformIntegration>;

const registry = new Map<string, IntegrationFactory>();

export function registerPlatformIntegration(slug: string, factory: IntegrationFactory): void {
  registry.set(slug, factory);
}

export async function createPlatformIntegration(
  slug: string,
  organizationId: string,
): Promise<PlatformIntegration | null> {
  const factory = registry.get(slug);
  return factory ? factory(organizationId) : null;
}
