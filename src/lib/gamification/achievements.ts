export type AchievementCategory =
  | "DISTANCIA"
  | "CONSISTENCIA"
  | "PROVA"
  | "PERFORMANCE"
  | "COMUNIDADE"
  | "ESPECIAL";

export type AchievementId =
  | "PRIMEIRO_TREINO"
  | "PRIMEIROS_5K"
  | "PRIMEIROS_10K"
  | "MEIA_MARATONA"
  | "MARATONISTA"
  | "STREAK_7"
  | "STREAK_30"
  | "PRIMEIRA_PROVA"
  | "PERSONAL_RECORD"
  | "TREINO_COLETIVO";

export type Achievement = {
  id: AchievementId;
  name: string;
  description: string;
  category: AchievementCategory;
  badge: string;
  xpReward: number;
};

export type AchievementRuleStats = {
  completedRuns: number;
  completedRaces: number;
  maxDistanceKm: number;
  personalRecords: number;
  groupTrainings: number;
  bestStreakDays: number;
};

export const achievements: Achievement[] = [
  {
    id: "PRIMEIRO_TREINO",
    name: "Primeiro treino",
    description: "Completou o primeiro treino no Ventu Suli.",
    category: "CONSISTENCIA",
    badge: "1x",
    xpReward: 50,
  },
  {
    id: "PRIMEIROS_5K",
    name: "Primeiros 5K",
    description: "Completou uma atividade de pelo menos 5 km.",
    category: "DISTANCIA",
    badge: "5K",
    xpReward: 80,
  },
  {
    id: "PRIMEIROS_10K",
    name: "Primeiros 10K",
    description: "Completou uma atividade de pelo menos 10 km.",
    category: "DISTANCIA",
    badge: "10K",
    xpReward: 120,
  },
  {
    id: "MEIA_MARATONA",
    name: "Meia maratona",
    description: "Completou 21 km ou mais em uma atividade.",
    category: "DISTANCIA",
    badge: "21K",
    xpReward: 250,
  },
  {
    id: "MARATONISTA",
    name: "Maratonista",
    description: "Completou 42 km ou mais em uma atividade.",
    category: "DISTANCIA",
    badge: "42K",
    xpReward: 500,
  },
  {
    id: "STREAK_7",
    name: "7 dias no ritmo",
    description: "Manteve 7 dias de sequencia.",
    category: "CONSISTENCIA",
    badge: "S7",
    xpReward: 150,
  },
  {
    id: "STREAK_30",
    name: "30 dias imparavel",
    description: "Manteve 30 dias de sequencia.",
    category: "CONSISTENCIA",
    badge: "S30",
    xpReward: 600,
  },
  {
    id: "PRIMEIRA_PROVA",
    name: "Primeira prova",
    description: "Concluiu a primeira prova oficial.",
    category: "PROVA",
    badge: "P1",
    xpReward: 200,
  },
  {
    id: "PERSONAL_RECORD",
    name: "Recorde pessoal",
    description: "Registrou uma melhor marca em distancia ou pace.",
    category: "PERFORMANCE",
    badge: "RP",
    xpReward: 150,
  },
  {
    id: "TREINO_COLETIVO",
    name: "Juntos, mais longe",
    description: "Participou de um treino acompanhado pelo grupo.",
    category: "COMUNIDADE",
    badge: "GR",
    xpReward: 80,
  },
];

export function getAchievementById(id: string) {
  return achievements.find((achievement) => achievement.id === id);
}

export function getUnlockedAchievementIds(stats: AchievementRuleStats): AchievementId[] {
  const unlocked: AchievementId[] = [];

  if (stats.completedRuns > 0) unlocked.push("PRIMEIRO_TREINO");
  if (stats.maxDistanceKm >= 5) unlocked.push("PRIMEIROS_5K");
  if (stats.maxDistanceKm >= 10) unlocked.push("PRIMEIROS_10K");
  if (stats.maxDistanceKm >= 21) unlocked.push("MEIA_MARATONA");
  if (stats.maxDistanceKm >= 42) unlocked.push("MARATONISTA");
  if (stats.bestStreakDays >= 7) unlocked.push("STREAK_7");
  if (stats.bestStreakDays >= 30) unlocked.push("STREAK_30");
  if (stats.completedRaces > 0) unlocked.push("PRIMEIRA_PROVA");
  if (stats.personalRecords > 0) unlocked.push("PERSONAL_RECORD");
  if (stats.groupTrainings > 0) unlocked.push("TREINO_COLETIVO");

  return unlocked;
}
