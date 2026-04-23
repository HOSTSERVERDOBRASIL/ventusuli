import { AchievementItem, ActivitySummary } from "@/lib/dashboard/types";

export function roundTwo(value: number): number {
  return Number(value.toFixed(2));
}

export function formatDistanceKm(valueKm: number): string {
  return `${Math.round(valueKm).toLocaleString("pt-BR")} km`;
}

export function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")}/km`;
}

export function monthlyDeltaLabel(current: number, previous: number): { trend: "up" | "down" | "stable"; delta: string } {
  if (previous <= 0 && current > 0) return { trend: "up", delta: "+100%" };
  if (previous <= 0 && current <= 0) return { trend: "stable", delta: "0%" };

  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 0.5) return { trend: "stable", delta: "0%" };

  const signal = delta > 0 ? "+" : "";
  return {
    trend: delta > 0 ? "up" : "down",
    delta: `${signal}${Math.round(delta)}%`,
  };
}

export function buildAchievements(summary: ActivitySummary, best5kPace: number | null): AchievementItem[] {
  const achievements: AchievementItem[] = [];

  if (summary.kmNoAno >= 100) {
    achievements.push({ id: "km-100", label: "100 km no ano", tone: "success" });
  }
  if (summary.kmNoAno >= 500) {
    achievements.push({ id: "km-500", label: "500 km acumulados", tone: "success" });
  }
  if (summary.consistencyPercent >= 50) {
    achievements.push({ id: "consistency-50", label: "Consistencia 50%+", tone: "info" });
  }
  if (summary.consistencyPercent >= 75) {
    achievements.push({ id: "consistency-75", label: "Alta consistencia 75%+", tone: "success" });
  }
  if (best5kPace !== null && best5kPace <= 300) {
    achievements.push({ id: "pace-sub5", label: "Ritmo sub 5:00/km", tone: "warning" });
  }

  return achievements;
}

export function buildYearWarning(hasConnection: boolean, hasActivities: boolean): string | null {
  if (!hasConnection) {
    return "Conta Strava nao conectada. Conecte o Strava para habilitar metricas reais de evolucao.";
  }

  if (!hasActivities) {
    return "Nenhuma atividade sincronizada encontrada para este atleta. Execute uma sincronizacao para preencher o dashboard.";
  }

  return null;
}
