import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { creditEventPoints, EventTriggerSource } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isFinanceRole } from "@/lib/request-auth";

const bodySchema = z.object({
  eventId: z.string().min(1),
});

interface RegistrationFlagShape {
  isEarlySignup?: boolean;
  earlySignup?: boolean;
  early_signup?: boolean;
  isEarlyPayment?: boolean;
  earlyPayment?: boolean;
  early_payment?: boolean;
}

function asFlagShape(value: unknown): RegistrationFlagShape {
  if (!value || typeof value !== "object") return {};
  return value as RegistrationFlagShape;
}

function hasEarlySignupFlag(value: unknown): boolean {
  const flags = asFlagShape(value);
  return Boolean(flags.isEarlySignup ?? flags.earlySignup ?? flags.early_signup);
}

function hasEarlyPaymentFlag(value: unknown): boolean {
  const flags = asFlagShape(value);
  return Boolean(flags.isEarlyPayment ?? flags.earlyPayment ?? flags.early_payment);
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Gestor ou Financeiro.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const event = await prisma.event.findFirst({
    where: {
      id: parsed.data.eventId,
      organization_id: auth.organizationId,
    },
    select: { id: true },
  });

  if (!event) {
    return apiError("USER_NOT_FOUND", "Prova nao encontrada.", 404);
  }

  const registrations = await prisma.$queryRaw<
    Array<{
      id: string;
      user_id: string;
      event_id: string;
      status: string;
      payment_status: string | null;
    }>
  >(Prisma.sql`
    SELECT
      r.id,
      r.user_id,
      r.event_id,
      r.status::text AS status,
      p.status::text AS payment_status
    FROM public.registrations r
    LEFT JOIN public.payments p ON p.registration_id = r.id
    WHERE r.organization_id = ${auth.organizationId}
      AND r.event_id = ${parsed.data.eventId}
      AND r.attendance_status = 'PRESENT'::"public"."AttendanceStatus"
      AND (
        r.status = 'CONFIRMED'::"public"."RegistrationStatus"
        OR p.status = 'PAID'::"public"."PaymentStatus"
      )
  `);

  const tasks: Array<Promise<{ created: boolean }>> = [];

  for (const registration of registrations) {
    const triggerSources: EventTriggerSource[] = ["PARTICIPATION"];

    if (hasEarlySignupFlag(registration as unknown)) {
      triggerSources.push("EARLY_SIGNUP");
    }

    if (hasEarlyPaymentFlag(registration as unknown)) {
      triggerSources.push("EARLY_PAYMENT");
    }

    for (const triggerSource of triggerSources) {
      tasks.push(
        creditEventPoints({
          orgId: auth.organizationId,
          userId: registration.user_id,
          eventId: registration.event_id,
          registrationId: registration.id,
          triggerSource,
          createdBy: auth.userId,
        }).then((result) => ({ created: result.created })),
      );
    }
  }

  const settled = await Promise.allSettled(tasks);

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (result.value.created) processed += 1;
      else skipped += 1;
      continue;
    }

    errors.push(result.reason instanceof Error ? result.reason.message : "Erro desconhecido ao processar pontuacao.");
  }

  return NextResponse.json({ processed, skipped, errors });
}
