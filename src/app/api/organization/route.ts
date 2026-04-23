import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { isAllowedImageUrl } from "@/lib/storage/image-url";
import {
  hasOrganizationTelegramBotToken,
  sanitizeOrganizationSettings,
} from "@/lib/organization-settings";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const logoUrlSchema = z
  .string()
  .trim()
  .refine((value) => value.length > 0, "Logo invalida.")
  .refine((value) => isAllowedImageUrl(value), "Logo deve ser URL valida ou arquivo enviado.");

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  supportEmail: z.string().trim().email().optional(),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{6})$/)
    .optional(),
  logoUrl: logoUrlSchema.nullable().optional(),
  allowAthleteSelfSignup: z.boolean().optional(),
  requireAthleteApproval: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
  telegramChatId: z.string().trim().min(3).max(128).optional(),
  telegramBotToken: z.string().trim().min(10).max(256).optional(),
});

function canEditOrganization(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

function getSettingsValue<T>(settings: unknown, ...keys: string[]): T | undefined {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return undefined;
  let current: unknown = settings;
  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current as T;
}

function getBrandingSettings(settings: unknown): { supportEmail?: string; primaryColor?: string } {
  return {
    supportEmail: getSettingsValue<string>(settings, "branding", "supportEmail"),
    primaryColor: getSettingsValue<string>(settings, "branding", "primaryColor"),
  };
}

function getTelegramSettings(settings: unknown): {
  telegramEnabled: boolean;
  telegramChatId: string;
} {
  const enabled =
    getSettingsValue<boolean>(settings, "integrations", "telegram", "telegram_enabled") ??
    getSettingsValue<boolean>(settings, "telegram_enabled") ??
    false;
  const chatId =
    getSettingsValue<string>(settings, "integrations", "telegram", "telegram_chat_id") ??
    getSettingsValue<string>(settings, "telegram_chat_id") ??
    "";
  return {
    telegramEnabled: enabled,
    telegramChatId: chatId,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const organization = await prisma.organization.findUnique({
    where: { id: auth.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      logo_url: true,
      settings: true,
      created_at: true,
    },
  });

  if (!organization) {
    return apiError("USER_NOT_FOUND", "Organizacao nao encontrada.", 404);
  }

  const branding = getBrandingSettings(organization.settings);
  const allowAthleteSelfSignup =
    getSettingsValue<boolean>(organization.settings, "allowAthleteSelfSignup") ?? true;
  const requireAthleteApproval =
    getSettingsValue<boolean>(organization.settings, "requireAthleteApproval") ?? false;
  const telegram = getTelegramSettings(organization.settings);
  const sanitizedSettings = sanitizeOrganizationSettings(organization.settings);

  return NextResponse.json({
    data: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: organization.plan,
      logoUrl: organization.logo_url,
      supportEmail: branding.supportEmail ?? "",
      primaryColor: branding.primaryColor ?? "#F5A623",
      allowAthleteSelfSignup,
      requireAthleteApproval,
      telegramEnabled: telegram.telegramEnabled,
      telegramChatId: telegram.telegramChatId,
      telegramConfigured: hasOrganizationTelegramBotToken(organization.settings),
      settings: sanitizedSettings,
      createdAt: organization.created_at,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canEditOrganization(auth.role)) {
    return apiError("FORBIDDEN", "Acesso restrito ao administrador.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const current = await prisma.organization.findUnique({
    where: { id: auth.organizationId },
    select: { settings: true },
  });

  if (!current) {
    return apiError("USER_NOT_FOUND", "Organizacao nao encontrada.", 404);
  }

  const currentSettings =
    current.settings && typeof current.settings === "object" && !Array.isArray(current.settings)
      ? (current.settings as Record<string, unknown>)
      : {};
  const currentBranding =
    currentSettings.branding &&
    typeof currentSettings.branding === "object" &&
    !Array.isArray(currentSettings.branding)
      ? (currentSettings.branding as Record<string, unknown>)
      : {};

  const nextBranding = {
    ...currentBranding,
    ...(parsed.data.supportEmail !== undefined ? { supportEmail: parsed.data.supportEmail } : {}),
    ...(parsed.data.primaryColor !== undefined ? { primaryColor: parsed.data.primaryColor } : {}),
  };
  const currentIntegrations =
    currentSettings.integrations &&
    typeof currentSettings.integrations === "object" &&
    !Array.isArray(currentSettings.integrations)
      ? (currentSettings.integrations as Record<string, unknown>)
      : {};
  const currentTelegram =
    currentIntegrations.telegram &&
    typeof currentIntegrations.telegram === "object" &&
    !Array.isArray(currentIntegrations.telegram)
      ? (currentIntegrations.telegram as Record<string, unknown>)
      : {};
  const nextTelegram = {
    ...currentTelegram,
    ...(parsed.data.telegramEnabled !== undefined
      ? { telegram_enabled: parsed.data.telegramEnabled }
      : {}),
    ...(parsed.data.telegramChatId !== undefined
      ? { telegram_chat_id: parsed.data.telegramChatId }
      : {}),
    ...(parsed.data.telegramBotToken !== undefined
      ? { telegram_bot_token: parsed.data.telegramBotToken }
      : {}),
  };

  const updated = await prisma.organization.update({
    where: { id: auth.organizationId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
      ...(parsed.data.logoUrl !== undefined ? { logo_url: parsed.data.logoUrl } : {}),
      settings: {
        ...currentSettings,
        branding: nextBranding,
        integrations: {
          ...currentIntegrations,
          telegram: nextTelegram,
        },
        ...(parsed.data.allowAthleteSelfSignup !== undefined
          ? { allowAthleteSelfSignup: parsed.data.allowAthleteSelfSignup }
          : {}),
        ...(parsed.data.requireAthleteApproval !== undefined
          ? { requireAthleteApproval: parsed.data.requireAthleteApproval }
          : {}),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      logo_url: true,
      settings: true,
    },
  });

  const updatedBranding = getBrandingSettings(updated.settings);
  const updatedAllowSelfSignup =
    getSettingsValue<boolean>(updated.settings, "allowAthleteSelfSignup") ?? true;
  const updatedRequireApproval =
    getSettingsValue<boolean>(updated.settings, "requireAthleteApproval") ?? false;
  const updatedTelegram = getTelegramSettings(updated.settings);
  const sanitizedSettings = sanitizeOrganizationSettings(updated.settings);

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
      logoUrl: updated.logo_url,
      supportEmail: updatedBranding.supportEmail ?? "",
      primaryColor: updatedBranding.primaryColor ?? "#F5A623",
      allowAthleteSelfSignup: updatedAllowSelfSignup,
      requireAthleteApproval: updatedRequireApproval,
      telegramEnabled: updatedTelegram.telegramEnabled,
      telegramChatId: updatedTelegram.telegramChatId,
      telegramConfigured: hasOrganizationTelegramBotToken(updated.settings),
      settings: sanitizedSettings,
    },
  });
}
