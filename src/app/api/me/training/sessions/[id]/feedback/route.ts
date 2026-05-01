import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const feedbackSchema = z.object({
  completedFlag: z.enum(["COMPLETED", "PARTIAL", "MISSED"]),
  perceivedEffort: z.number().int().min(1).max(5).optional().nullable(),
  painLevel: z.number().int().min(0).max(10).optional().nullable(),
  painArea: z.string().trim().max(120).optional().nullable(),
  discomfortNotes: z.string().trim().max(600).optional().nullable(),
  observation: z.string().trim().max(1200).optional().nullable(),
  actualDurationMinutes: z.number().int().min(0).max(1000).optional().nullable(),
  actualLoad: z.string().trim().max(120).optional().nullable(),
  actualDistanceM: z.number().int().min(0).max(500000).optional().nullable(),
  actualPace: z.string().trim().max(60).optional().nullable(),
  actualHeartRate: z.number().int().min(0).max(260).optional().nullable(),
});

function statusFromFlag(flag: "COMPLETED" | "PARTIAL" | "MISSED") {
  if (flag === "COMPLETED") return "COMPLETED";
  if (flag === "PARTIAL") return "PARTIAL";
  return "MISSED";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const session = await prisma.workoutSession.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      athlete_id: auth.userId,
      training_plan: { status: "ACTIVE" },
    },
    select: {
      id: true,
      training_plan_id: true,
      coach_id: true,
    },
  });

  if (!session) return apiError("USER_NOT_FOUND", "Sessao de treino nao encontrada.", 404);

  const painLevel = parsed.data.painLevel ?? 0;
  const perceivedEffort = parsed.data.perceivedEffort ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.workoutSession.update({
      where: { id: session.id },
      data: {
        status: statusFromFlag(parsed.data.completedFlag),
        perceived_effort: perceivedEffort,
        actual_duration_minutes: parsed.data.actualDurationMinutes ?? null,
        actual_load: parsed.data.actualLoad ?? null,
        actual_distance_m: parsed.data.actualDistanceM ?? null,
        actual_pace: parsed.data.actualPace ?? null,
        actual_heart_rate: parsed.data.actualHeartRate ?? null,
        athlete_notes: parsed.data.observation ?? parsed.data.discomfortNotes ?? null,
        completed_at:
          parsed.data.completedFlag === "MISSED" ? null : new Date(),
      },
    });

    await tx.athleteFeedback.upsert({
      where: { workout_session_id: session.id },
      update: {
        completed_flag: parsed.data.completedFlag,
        perceived_effort: perceivedEffort,
        pain_level: painLevel,
        pain_area: parsed.data.painArea ?? null,
        discomfort_notes: parsed.data.discomfortNotes ?? null,
        observation: parsed.data.observation ?? null,
        actual_duration_minutes: parsed.data.actualDurationMinutes ?? null,
        actual_load: parsed.data.actualLoad ?? null,
        actual_distance_m: parsed.data.actualDistanceM ?? null,
        actual_pace: parsed.data.actualPace ?? null,
        actual_heart_rate: parsed.data.actualHeartRate ?? null,
        submitted_at: new Date(),
      },
      create: {
        organization_id: auth.organizationId,
        workout_session_id: session.id,
        athlete_id: auth.userId,
        completed_flag: parsed.data.completedFlag,
        perceived_effort: perceivedEffort,
        pain_level: painLevel,
        pain_area: parsed.data.painArea ?? null,
        discomfort_notes: parsed.data.discomfortNotes ?? null,
        observation: parsed.data.observation ?? null,
        actual_duration_minutes: parsed.data.actualDurationMinutes ?? null,
        actual_load: parsed.data.actualLoad ?? null,
        actual_distance_m: parsed.data.actualDistanceM ?? null,
        actual_pace: parsed.data.actualPace ?? null,
        actual_heart_rate: parsed.data.actualHeartRate ?? null,
      },
    });

    const suggestion =
      painLevel >= 7
        ? {
            type: "RECOVERY_ALERT",
            summary: "Dor elevada registrada. Considere reduzir carga e revisar a sessao seguinte.",
            rationale: "Dor >= 7 aciona alerta de seguranca para o coach.",
          }
        : (perceivedEffort ?? 0) >= 5
          ? {
              type: "LOAD_REDUCTION",
              summary: "Esforco muito alto. Sugestao: reduzir intensidade ou inserir descanso adicional.",
              rationale: "RPE 5/5 sem margem de recuperacao aumenta risco de sobrecarga.",
            }
          : parsed.data.completedFlag === "COMPLETED" && (perceivedEffort ?? 0) <= 2
            ? {
                type: "PROGRESSION",
                summary: "Sessao bem tolerada. IA sugere progressao gradual na proxima semana.",
                rationale: "Boa resposta subjetiva permite ajuste moderado de carga.",
              }
            : {
                type: "MONITORING",
                summary: "Sessao registrada com sucesso. Manter monitoramento e comparar proximas respostas.",
                rationale: "Nao houve sinal critico, mas o historico deve orientar a revisao humana.",
              };

    await tx.aIRecommendation.create({
      data: {
        organization_id: auth.organizationId,
        athlete_id: auth.userId,
        coach_id: session.coach_id,
        training_plan_id: session.training_plan_id,
        workout_session_id: session.id,
        recommendation_type: suggestion.type,
        summary: suggestion.summary,
        rationale: suggestion.rationale,
        input_snapshot: parsed.data,
        output_snapshot: suggestion,
        status: "PENDING",
      },
    });
  });

  return NextResponse.json({ data: { sessionId: session.id, saved: true } });
}
