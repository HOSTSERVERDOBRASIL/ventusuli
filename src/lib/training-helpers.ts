import {
  AIRecommendationStatus,
  SportLevel,
  TrainingPlanStatus,
  WorkoutSessionStatus,
} from "@prisma/client";

export function normalizeSportLevel(value: SportLevel | null | undefined): string {
  if (value === "ELITE") return "Elite";
  if (value === "ADVANCED") return "Avancado";
  if (value === "INTERMEDIATE") return "Intermediario";
  if (value === "BEGINNER") return "Iniciante";
  return "Nao definido";
}

export function trainingPlanStatusLabel(status: TrainingPlanStatus): string {
  if (status === "ACTIVE") return "Ativo";
  if (status === "COMPLETED") return "Concluido";
  if (status === "ARCHIVED") return "Arquivado";
  return "Rascunho";
}

export function workoutStatusLabel(status: WorkoutSessionStatus): string {
  if (status === "COMPLETED") return "Concluido";
  if (status === "PARTIAL") return "Parcial";
  if (status === "MISSED") return "Nao realizado";
  return "Pendente";
}

export function aiRecommendationStatusLabel(status: AIRecommendationStatus): string {
  if (status === "APPLIED") return "Aplicada";
  if (status === "DISMISSED") return "Descartada";
  return "Pendente";
}

export function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}
