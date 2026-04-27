import { NextRequest, NextResponse } from "next/server";
import { OrgPlan, OrgStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { isAllowedImageUrl } from "@/lib/storage/image-url";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const logoUrlSchema = z
  .string()
  .trim()
  .refine((value) => value.length > 0, "Logo invalida.")
  .refine((value) => isAllowedImageUrl(value), "Logo deve ser URL valida ou arquivo enviado.");

const setupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug invalido"),
  plan: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]),
  branding: z
    .object({
      supportEmail: z.string().trim().email().optional(),
      primaryColor: z
        .string()
        .trim()
        .regex(/^#([0-9A-Fa-f]{6})$/)
        .optional(),
      logoUrl: logoUrlSchema.nullable().optional(),
    })
    .optional(),
  athletePolicy: z
    .object({
      allowAthleteSelfSignup: z.boolean(),
      requireAthleteApproval: z.boolean(),
    })
    .optional(),
  initialData: z
    .object({
      defaultCity: z.string().trim().max(120).optional(),
      defaultState: z.string().trim().max(2).optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .optional(),
});

function canSetupOrganization(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

function parseSettingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canSetupOrganization(auth.role)) {
    return apiError(
      "FORBIDDEN",
      "Apenas administradores podem concluir o setup da assessoria.",
      403,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const current = await prisma.organization.findUnique({
    where: { id: auth.organizationId },
    select: { id: true, slug: true, settings: true },
  });
  if (!current) {
    return apiError("ORG_NOT_FOUND", "Assessoria nao encontrada.", 404);
  }

  if (parsed.data.slug !== current.slug) {
    const slugInUse = await prisma.organization.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (slugInUse) {
      return apiError("VALIDATION_ERROR", "Slug ja esta em uso por outra assessoria.", 409);
    }
  }

  const currentSettings = parseSettingsObject(current.settings);
  const brandingSettings = parseSettingsObject(currentSettings.branding);
  const initialDataSettings = parseSettingsObject(currentSettings.initialData);

  const nextBranding: Record<string, unknown> = {
    ...brandingSettings,
    ...(parsed.data.branding?.supportEmail !== undefined
      ? { supportEmail: parsed.data.branding.supportEmail }
      : {}),
    ...(parsed.data.branding?.primaryColor !== undefined
      ? { primaryColor: parsed.data.branding.primaryColor }
      : {}),
  };

  const nextInitialData: Record<string, unknown> = {
    ...initialDataSettings,
    ...(parsed.data.initialData?.defaultCity !== undefined
      ? { defaultCity: parsed.data.initialData.defaultCity }
      : {}),
    ...(parsed.data.initialData?.defaultState !== undefined
      ? { defaultState: parsed.data.initialData.defaultState.toUpperCase() }
      : {}),
    ...(parsed.data.initialData?.notes !== undefined
      ? { notes: parsed.data.initialData.notes }
      : {}),
  };

  const updated = await prisma.organization.update({
    where: { id: auth.organizationId },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      plan: parsed.data.plan as OrgPlan,
      status: OrgStatus.ACTIVE,
      setup_completed_at: new Date(),
      ...(parsed.data.branding?.logoUrl !== undefined
        ? { logo_url: parsed.data.branding.logoUrl }
        : {}),
      settings: {
        ...currentSettings,
        branding: nextBranding,
        initialData: nextInitialData,
        ...(parsed.data.athletePolicy
          ? {
              allowAthleteSelfSignup: parsed.data.athletePolicy.allowAthleteSelfSignup,
              requireAthleteApproval: parsed.data.athletePolicy.requireAthleteApproval,
            }
          : {}),
      } as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      setup_completed_at: true,
      logo_url: true,
      settings: true,
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
      status: updated.status,
      setupCompletedAt: updated.setup_completed_at,
      logoUrl: updated.logo_url,
      settings: updated.settings,
    },
  });
}
