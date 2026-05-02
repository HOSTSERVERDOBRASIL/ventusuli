import { DashboardData } from "@/services/types";
import { buildEmptyGamificationSnapshot } from "@/lib/gamification/snapshot";

// Development fixture only. Do not use as runtime fallback in production flows.
export const DEMO_DASHBOARD_EXPERIENCE: NonNullable<DashboardData["experience"]> = {
  greeting: {
    headline: "Bora correr, Maria!",
    subtitle: "Cada prova fortalece sua evolucao. Hoje o foco e consistencia e ritmo.",
  },
  financeBreakdown: [
    { name: "Inscricoes", value: 58, color: "#22d3ee" },
    { name: "Transporte", value: 19, color: "#38bdf8" },
    { name: "Hospedagem", value: 13, color: "#2563eb" },
    { name: "Outros", value: 10, color: "#F5A623" },
  ],
  evolutionSeries: [
    { month: "JAN", current: 38, previous: 24 },
    { month: "FEV", current: 44, previous: 31 },
    { month: "MAR", current: 53, previous: 36 },
    { month: "ABR", current: 67, previous: 41 },
    { month: "MAI", current: 79, previous: 48 },
    { month: "JUN", current: 94, previous: 55 },
    { month: "JUL", current: 108, previous: 62 },
    { month: "AGO", current: 129, previous: 68 },
    { month: "SET", current: 144, previous: 81 },
    { month: "OUT", current: 168, previous: 94 },
    { month: "NOV", current: 187, previous: 109 },
    { month: "DEZ", current: 204, previous: 124 },
  ],
  highlights: [
    { id: "completed", label: "Provas concluidas", value: "12" },
    { id: "distance", label: "KM acumulados", value: "1.248 km" },
    { id: "consistency", label: "Taxa de conclusao", value: "67%" },
    { id: "podium", label: "Podios", value: "2" },
    { id: "best5k", label: "Melhor 5K", value: "21:05" },
    { id: "best21k", label: "Melhor 21K", value: "1:38:42" },
    { id: "best42k", label: "Melhor 42K", value: "3:45:21" },
  ],
  distanceDistribution: [
    { name: "5K", value: 25, color: "#38bdf8" },
    { name: "10K", value: 33, color: "#0ea5e9" },
    { name: "21K", value: 25, color: "#2563eb" },
    { name: "42K", value: 17, color: "#F5A623" },
  ],
  achievements: [
    { id: "ach-maratonista", label: "Maratonista", tone: "info" },
    { id: "ach-consistencia", label: "Consistencia 8 semanas", tone: "warning" },
    { id: "ach-pr", label: "PR 21K", tone: "success" },
  ],
  sportsMetrics: [
    { id: "m1", label: "Ritmo medio 10K", value: "4:52/km", delta: "-0:11/km", trend: "up" },
    { id: "m2", label: "Volume 30 dias", value: "186 km", delta: "+14%", trend: "up" },
    { id: "m3", label: "Treinos concluidos", value: "22", delta: "+3", trend: "up" },
    { id: "m4", label: "Frequencia cardiaca media", value: "154 bpm", delta: "-2 bpm", trend: "stable" },
  ],
  personalRecords: [
    { id: "pr-5k", label: "5K", value: "21:05", event: "Corrida Noturna Centro", achievedAt: "2026-03-11" },
    { id: "pr-10k", label: "10K", value: "45:48", event: "Desafio Beira Mar", achievedAt: "2026-05-02" },
    { id: "pr-21k", label: "21K", value: "1:38:42", event: "Meia Serra Gaucha", achievedAt: "2026-09-20" },
    { id: "pr-42k", label: "42K", value: "3:45:21", event: "Maratona Ventu Suli", achievedAt: "2025-10-19" },
  ],
  groupRanking: {
    updatedAt: "2026-11-01T10:00:00.000Z",
    totalAthletes: 47,
    user: {
      name: "Maria Oliveira",
      position: 12,
      points: 1840,
      change: 3,
    },
    leaderboard: [
      { id: "rk-1", name: "Diego Farias", points: 2410, position: 1 },
      { id: "rk-2", name: "Carla Souza", points: 2335, position: 2 },
      { id: "rk-3", name: "Rafael Mendes", points: 2280, position: 3 },
      { id: "rk-12", name: "Maria Oliveira", points: 1840, position: 12 },
      { id: "rk-13", name: "Joao Pires", points: 1815, position: 13 },
    ],
  },
  gamification: buildEmptyGamificationSnapshot(),
  communityPreview: {
    tabs: ["Feed", "Treinos", "Eventos", "Resultados"],
    posts: [],
    source: "EMPTY",
    message: "Fixture isolada para desenvolvimento.",
  },
};
