import { ExternalPlatformAuthType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/integrations/external/credentials";
import type { PlatformRegistrationInput } from "@/lib/integrations/external/types";

export async function listExternalPlatforms(organizationId: string) {
  const platforms = await prisma.externalPlatform.findMany({
    orderBy: { name: "asc" },
    include: {
      credentials: {
        where: { organizationId },
        select: { id: true, clientId: true, expiresAt: true, updatedAt: true },
      },
    },
  });

  return platforms.map((platform) => ({
    id: platform.id,
    name: platform.name,
    slug: platform.slug,
    baseUrl: platform.baseUrl,
    authType: platform.authType,
    isActive: platform.isActive,
    hasCredential: platform.credentials.length > 0,
    credential: platform.credentials[0] ?? null,
  }));
}

export async function upsertExternalPlatform(input: PlatformRegistrationInput) {
  return prisma.externalPlatform.upsert({
    where: { slug: input.slug },
    create: {
      name: input.name,
      slug: input.slug,
      baseUrl: input.baseUrl,
      authType: input.authType,
      isActive: input.isActive ?? true,
    },
    update: {
      name: input.name,
      baseUrl: input.baseUrl,
      authType: input.authType,
      isActive: input.isActive ?? true,
    },
  });
}

export async function upsertPlatformCredential(input: {
  platformSlug: string;
  organizationId: string;
  token?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  expiresAt?: Date | null;
}) {
  const platform = await prisma.externalPlatform.findUniqueOrThrow({
    where: { slug: input.platformSlug },
  });

  return prisma.platformCredential.upsert({
    where: {
      platformId_organizationId: {
        platformId: platform.id,
        organizationId: input.organizationId,
      },
    },
    create: {
      platformId: platform.id,
      organizationId: input.organizationId,
      encryptedToken: input.token ? encryptCredential(input.token) : null,
      clientId: input.clientId?.trim() || null,
      encryptedClientSecret: input.clientSecret ? encryptCredential(input.clientSecret) : null,
      expiresAt: input.expiresAt ?? null,
    },
    update: {
      ...(typeof input.token === "string" ? { encryptedToken: encryptCredential(input.token) } : {}),
      clientId: input.clientId?.trim() || null,
      ...(typeof input.clientSecret === "string"
        ? { encryptedClientSecret: encryptCredential(input.clientSecret) }
        : {}),
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true, platformId: true, organizationId: true, clientId: true, expiresAt: true, updatedAt: true },
  });
}

export async function ensureTicketSportsPlatform() {
  return upsertExternalPlatform({
    name: "TicketSports",
    slug: "ticketsports",
    baseUrl: process.env.TICKETSPORTS_API_URL ?? "https://api.ticketsports.com.br",
    authType: ExternalPlatformAuthType.BEARER_TOKEN,
    isActive: true,
  });
}
