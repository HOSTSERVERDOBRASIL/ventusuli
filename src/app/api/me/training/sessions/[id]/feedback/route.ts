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

function mergeAthleteNotes(
  current: string | null,
  observation?: string | null,
  discomfortNotes?: string | null,
): string | null {
  const feedbackNote = (observation || discomfortNotes || "").trim();
  if (!feedbackNote) return current;

  const entry = `[feedback] ${feedbackNote}`;
  if (!current) return entry;
  if (current.includes(entry)) return current;
  return `${current}\n${entry}`;
}

function buildFeedbackSuggestion(input: z.infer<typeof feedbackSchema>) {
  const painLevel = input.painLevel ?? 0;
  const effort = input.perceivedEffort ?? 0;
  const duration = input.actualDurationMinutes ?? 0;
  const distance = input.actualDistanceM ?? 0;
  const painArea = input.painArea?.trim();

  if (painLevel >= 8) {
    return {
      type: "RECOVERY_ALERT",
      summary: "Dor alta registrada. Recomenda-se pausar intensidade e revisar a próxima sessão.",
      rationale: `Dor ${painLevel}/10${painArea ? ` em ${painArea}` : ""} exige revisão humana antes de nova carga.`,
      action: "Reduzir volume por 48-72h, priorizar mobilidade leve e orientar avaliação caso a dor persista.",
    };
  }

  if (painLevel >= 5) {
    return {
      type: "PAIN_MONITORING",
      summary: "Desconforto moderado. Próxima sessão deve ser conservadora.",
      rationale: `Dor ${painLevel}/10 indica risco de piora se houver progressão automática.`,
      action: "Manter treino leve, evitar estímulos intensos e pedir novo feedback pós-sessão.",
    };
  }

  if (input.completedFlag === "MISSED") {
    return {
      type: "ADHERENCE_CHECK",
      summary: "Sessão não realizada. Vale ajustar agenda ou remover carga acumulada.",
      rationale: "Treinos perdidos não devem ser compensados automaticamente sem revisão do coach.",
      action: "Reagendar sessão-chave ou manter semana atual sem compensação agressiva.",
    };
  }

  if (input.completedFlag === "PARTIAL") {
    return {
      type: "LOAD_ADJUSTMENT",
      summary: "Sessão parcial. IA sugere manter carga ou reduzir progressão da semana.",
      rationale: "Conclusão parcial sinaliza que a prescrição pode estar acima da disponibilidade atual.",
      action: "Revisar duração prevista e remover um bloco de intensidade se necessário.",
    };
  }

  if (effort >= 5) {
    return {
      type: "LOAD_REDUCTION",
      summary: "Esforço máximo registrado. Considere descanso adicional ou redução de intensidade.",
      rationale: "RPE 5/5 reduz margem de recuperação e aumenta risco de sobrecarga.",
      action: "Inserir sessão regenerativa antes do próximo treino de qualidade.",
    };
  }

  if (input.completedFlag === "COMPLETED" && effort <= 2 && (duration >= 30 || distance >= 3000)) {
    return {
      type: "PROGRESSION",
      summary: "Sessão bem tolerada. Progressão gradual pode ser considerada.",
      rationale: "Boa tolerância subjetiva com volume suficiente permite avanço moderado.",
      action: "Aumentar volume em até 5-10% ou manter volume e melhorar técnica.",
    };
  }

  return {
    type: "MONITORING",
    summary: "Sessão registrada. Manter monitoramento e comparar próximas respostas.",
    rationale: "Sem sinal crítico; o histórico deve orientar a revisão humana.",
    action: "Manter plano atual e acompanhar tendência de esforço, dor e adesão.",
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
      athlete_notes: true,
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
        athlete_notes: mergeAthleteNotes(
          session.athlete_notes,
          parsed.data.observation,
          parsed.data.discomfortNotes,
        ),
        completed_at: parsed.data.completedFlag === "MISSED" ? null : new Date(),
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

    const suggestion = buildFeedbackSuggestion(parsed.data);

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
