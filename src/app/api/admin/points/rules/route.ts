import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const ruleSchema = z.object({
  eventId: z.string().min(1).nullable().optional(),
  basePoints: z.number().int().min(0).max(100000),
  earlySignupBonus: z.number().int().min(0).max(100000).default(0),
  earlyPaymentBonus: z.number().int().min(0).max(100000).default(0),
  campaignBonus: z.number().int().min(0).max(100000).default(0),
  active: z.boolean().default(true),
});

function mapRule(rule: {
  id: string;
  eventId: string | null;
  basePoints: number;
  earlySignupBonus: number;
  earlyPaymentBonus: number;
  campaignBonus: number;
  active: boolean;
  updatedAt: Date;
}) {
  return {
    id: rule.id,
    eventId: rule.eventId,
    basePoints: rule.basePoints,
    earlySignupBonus: rule.earlySignupBonus,
    earlyPaymentBonus: rule.earlyPaymentBonus,
    campaignBonus: rule.campaignBonus,
    active: rule.active,
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Gestor.", 403);

  const [rules, events] = await Promise.all([
    prisma.eventPointRule.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ eventId: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.event.findMany({
      where: { organization_id: auth.organizationId },
      orderBy: { event_date: "desc" },
      select: { id: true, name: true, event_date: true },
    }),
  ]);

  return NextResponse.json({
    data: rules.map(mapRule),
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      eventDate: event.event_date.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Gestor.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const eventId = parsed.data.eventId?.trim() || null;
  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organization_id: auth.organizationId },
      select: { id: true },
    });
    if (!event) return apiError("USER_NOT_FOUND", "Prova nao encontrada.", 404);
  }

  const existing = await prisma.eventPointRule.findFirst({
    where: {
      organizationId: auth.organizationId,
      eventId,
    },
    select: { id: true },
  });

  const rule = existing
    ? await prisma.eventPointRule.update({
        where: { id: existing.id },
        data: {
          basePoints: parsed.data.basePoints,
          earlySignupBonus: parsed.data.earlySignupBonus,
          earlyPaymentBonus: parsed.data.earlyPaymentBonus,
          campaignBonus: parsed.data.campaignBonus,
          active: parsed.data.active,
        },
      })
    : await prisma.eventPointRule.create({
        data: {
          organizationId: auth.organizationId,
          eventId,
          basePoints: parsed.data.basePoints,
          earlySignupBonus: parsed.data.earlySignupBonus,
          earlyPaymentBonus: parsed.data.earlyPaymentBonus,
          campaignBonus: parsed.data.campaignBonus,
          active: parsed.data.active,
        },
      });

  return NextResponse.json({ data: mapRule(rule) });
}
