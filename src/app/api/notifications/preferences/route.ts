import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const preferenceSchema = z.object({
  emailEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  marketingEnabled: z.boolean().optional(),
  eventsEnabled: z.boolean().optional(),
  trainingEnabled: z.boolean().optional(),
  birthdayMessageEnabled: z.boolean().optional(),
  birthdayPublicEnabled: z.boolean().optional(),
  financialEnabled: z.boolean().optional(),
});

function mapPreference(preference: {
  id: string;
  userId: string;
  organizationId: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  marketingEnabled: boolean;
  eventsEnabled: boolean;
  trainingEnabled: boolean;
  birthdayMessageEnabled: boolean;
  birthdayPublicEnabled: boolean;
  financialEnabled: boolean;
  updatedAt: Date;
}) {
  return {
    id: preference.id,
    user_id: preference.userId,
    organization_id: preference.organizationId,
    email_enabled: preference.emailEnabled,
    whatsapp_enabled: preference.whatsappEnabled,
    sms_enabled: preference.smsEnabled,
    in_app_enabled: preference.inAppEnabled,
    marketing_enabled: preference.marketingEnabled,
    events_enabled: preference.eventsEnabled,
    training_enabled: preference.trainingEnabled,
    birthday_message_enabled: preference.birthdayMessageEnabled,
    birthday_public_enabled: preference.birthdayPublicEnabled,
    financial_enabled: preference.financialEnabled,
    updated_at: preference.updatedAt.toISOString(),
  };
}

async function getOrCreatePreference(userId: string, organizationId: string) {
  const existing = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return prisma.notificationPreference.create({
    data: {
      userId,
      organizationId,
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const preference = await getOrCreatePreference(auth.userId, auth.organizationId);
  return NextResponse.json({ data: mapPreference(preference) });
}

export async function PUT(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  await getOrCreatePreference(auth.userId, auth.organizationId);

  const preference = await prisma.notificationPreference.update({
    where: { userId: auth.userId },
    data: parsed.data,
  });

  return NextResponse.json({ data: mapPreference(preference) });
}
