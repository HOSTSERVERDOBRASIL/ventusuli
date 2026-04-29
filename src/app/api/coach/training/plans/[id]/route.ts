import { NextRequest, NextResponse } from "next/server";
import { Prisma, TrainingPlanStatus } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { mapTrainingPlan } from "@/lib/training-serializers";
import { getAuthContext } from "@/lib/request-auth";

const patchSchema = z.object({
  status: z.nativeEnum(TrainingPlanStatus).optional(),
  notes: z.string().trim().max(1200).optional().nullable(),
});

function canUseCoachArea(role: string): boolean {
  return role === "COACH" || role === "ADMIN";
}

const planInclude = Prisma.validator<Prisma.TrainingPlanInclude>()({
  athlete: { select: { name: true } },
  coach: { select: { name: true } },
  weeks: {
    orderBy: { week_number: "asc" as const },
    include: {
      days: {
        orderBy: { scheduled_date: "asc" as const },
        include: {
          items: { orderBy: { sort_order: "asc" as const } },
          sessions: { include: { feedback: true } },
        },
      },
    },
  },
  ai_recommendations: {
    orderBy: { created_at: "desc" as const },
    take: 10,
  },
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUseCoachArea(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao coach.", 403);

  const plan = await prisma.trainingPlan.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      ...(auth.role === "COACH" ? { coach_id: auth.userId } : {}),
    },
    include: planInclude,
  });

  if (!plan) return apiError("USER_NOT_FOUND", "Planilha nao encontrada.", 404);
  return NextResponse.json({ data: mapTrainingPlan(plan) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canUseCoachArea(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao coach.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const current = await prisma.trainingPlan.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      ...(auth.role === "COACH" ? { coach_id: auth.userId } : {}),
    },
    select: { id: true },
  });

  if (!current) return apiError("USER_NOT_FOUND", "Planilha nao encontrada.", 404);

  const updated = await prisma.trainingPlan.update({
    where: { id: current.id },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
    include: planInclude,
  });

  return NextResponse.json({ data: mapTrainingPlan(updated) });
}
