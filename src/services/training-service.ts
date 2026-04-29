import { buildAuthHeaders } from "@/services/runtime";
import {
  AthleteTrainingDashboard,
  AthleteTrainingProfile,
  CoachTrainingDashboard,
  ExerciseLibraryItem,
  TrainingPlanSummary,
} from "@/services/types";

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return new Error(payload.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function getCoachTrainingDashboard(accessToken?: string | null): Promise<CoachTrainingDashboard> {
  const response = await fetch("/api/coach/training/dashboard", {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel carregar dashboard tecnico.");
  const payload = (await response.json()) as { data: CoachTrainingDashboard };
  return payload.data;
}

export async function getTrainingPlans(
  input: { athleteId?: string; status?: string; accessToken?: string | null } = {},
): Promise<TrainingPlanSummary[]> {
  const query = new URLSearchParams();
  if (input.athleteId) query.set("athleteId", input.athleteId);
  if (input.status) query.set("status", input.status);
  const response = await fetch(`/api/coach/training/plans?${query.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(input.accessToken),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel carregar planilhas.");
  const payload = (await response.json()) as { data: TrainingPlanSummary[] };
  return payload.data;
}

export async function generateTrainingPlanWithAI(
  input: {
    athleteId: string;
    planName: string;
    cycleGoal: string;
    objective?: string | null;
    focusModality?: string | null;
    startDate: string;
    weeks: number;
    sessionsPerWeek: number;
    coachNotes?: string | null;
  },
  accessToken?: string | null,
): Promise<TrainingPlanSummary> {
  const response = await fetch("/api/coach/training/ai/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel gerar planilha com IA.");
  const payload = (await response.json()) as { data: TrainingPlanSummary };
  return payload.data;
}

export async function updateTrainingPlan(
  planId: string,
  input: { status?: string; notes?: string | null },
  accessToken?: string | null,
): Promise<TrainingPlanSummary> {
  const response = await fetch(`/api/coach/training/plans/${planId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel atualizar planilha.");
  const payload = (await response.json()) as { data: TrainingPlanSummary };
  return payload.data;
}

export async function getExerciseLibrary(
  input: { modality?: string; q?: string; accessToken?: string | null } = {},
): Promise<ExerciseLibraryItem[]> {
  const query = new URLSearchParams();
  if (input.modality) query.set("modality", input.modality);
  if (input.q) query.set("q", input.q);
  const response = await fetch(`/api/coach/training/exercises?${query.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(input.accessToken),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel carregar exercicios.");
  const payload = (await response.json()) as { data: ExerciseLibraryItem[] };
  return payload.data;
}

export async function getAthleteTrainingDashboard(
  accessToken?: string | null,
): Promise<AthleteTrainingDashboard> {
  const response = await fetch("/api/me/training/dashboard", {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel carregar treino do atleta.");
  const payload = (await response.json()) as { data: AthleteTrainingDashboard };
  return payload.data;
}

export async function submitWorkoutFeedback(
  sessionId: string,
  input: {
    completedFlag: "COMPLETED" | "PARTIAL" | "MISSED";
    perceivedEffort?: number | null;
    painLevel?: number | null;
    painArea?: string | null;
    discomfortNotes?: string | null;
    observation?: string | null;
    actualDurationMinutes?: number | null;
    actualLoad?: string | null;
    actualDistanceM?: number | null;
    actualPace?: string | null;
    actualHeartRate?: number | null;
  },
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/me/training/sessions/${sessionId}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel registrar feedback.");
}

export async function updateAthleteTrainingProfile(
  athleteId: string,
  input: Partial<AthleteTrainingProfile>,
  accessToken?: string | null,
): Promise<AthleteTrainingProfile | null> {
  const response = await fetch(`/api/athletes/${athleteId}/training-profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await parseError(response, "Nao foi possivel atualizar perfil esportivo.");
  const payload = (await response.json()) as { data: AthleteTrainingProfile | null };
  return payload.data;
}
