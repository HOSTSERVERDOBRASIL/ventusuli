export type LevelTier = "INICIANTE" | "INTERMEDIARIO" | "AVANCADO" | "PRESTIGIO";

export type RunnerLevel = {
  id: string;
  order: number;
  name: string;
  tier: LevelTier;
  minXp: number;
  maxXp: number | null;
  color: string;
  description: string;
  unlocks: string[];
};

export const runnerLevels: RunnerLevel[] = [
  {
    id: "BRISA",
    order: 1,
    name: "Brisa",
    tier: "INICIANTE",
    minXp: 0,
    maxXp: 500,
    color: "#38bdf8",
    description: "Comecando a criar consistencia nos treinos.",
    unlocks: ["Perfil de atleta", "Primeiras conquistas"],
  },
  {
    id: "MARE",
    order: 2,
    name: "Mare",
    tier: "INICIANTE",
    minXp: 500,
    maxXp: 1500,
    color: "#0ea5e9",
    description: "Ja entrou no ritmo do grupo.",
    unlocks: ["Historico mensal", "Ranking basico"],
  },
  {
    id: "CORRENTEZA",
    order: 3,
    name: "Correnteza",
    tier: "INICIANTE",
    minXp: 1500,
    maxXp: 3000,
    color: "#0284c7",
    description: "Treina com regularidade e comeca a evoluir.",
    unlocks: ["Metas semanais", "Conquistas de sequencia"],
  },
  {
    id: "ONDA",
    order: 4,
    name: "Onda",
    tier: "INTERMEDIARIO",
    minXp: 3000,
    maxXp: 6000,
    color: "#2563eb",
    description: "Volume e pace comecam a ficar fortes.",
    unlocks: ["Comparacao com grupo", "Relatorios simples"],
  },
  {
    id: "MAR_ABERTO",
    order: 5,
    name: "Mar Aberto",
    tier: "INTERMEDIARIO",
    minXp: 6000,
    maxXp: 10000,
    color: "#1d4ed8",
    description: "Atleta consistente e preparado para provas maiores.",
    unlocks: ["Relatorios detalhados", "Metas por prova"],
  },
  {
    id: "VENTO_SUL",
    order: 6,
    name: "Vento Sul",
    tier: "INTERMEDIARIO",
    minXp: 10000,
    maxXp: 15000,
    color: "#f5a623",
    description: "Representa a energia do grupo Ventu Suli.",
    unlocks: ["Recomendacoes avancadas", "Destaque no mural"],
  },
  {
    id: "TEMPESTADE",
    order: 7,
    name: "Tempestade",
    tier: "AVANCADO",
    minXp: 15000,
    maxXp: 25000,
    color: "#a855f7",
    description: "Alta intensidade, constancia e performance.",
    unlocks: ["Ranking avancado", "Conquistas raras"],
  },
  {
    id: "FURACAO",
    order: 8,
    name: "Furacao",
    tier: "AVANCADO",
    minXp: 25000,
    maxXp: 40000,
    color: "#ec4899",
    description: "Atleta de impacto dentro da comunidade.",
    unlocks: ["Desafios especiais", "Conquistas premium"],
  },
  {
    id: "ELITE",
    order: 9,
    name: "Elite",
    tier: "AVANCADO",
    minXp: 40000,
    maxXp: 60000,
    color: "#f59e0b",
    description: "Performance de referencia no grupo.",
    unlocks: ["Selo Elite", "Prioridade em eventos"],
  },
  {
    id: "LENDARIO",
    order: 10,
    name: "Lendario",
    tier: "PRESTIGIO",
    minXp: 60000,
    maxXp: 100000,
    color: "#facc15",
    description: "Historia construida no grupo.",
    unlocks: ["Selo lendario", "Hall da fama"],
  },
  {
    id: "VENTU_MASTER",
    order: 11,
    name: "Ventu Master",
    tier: "PRESTIGIO",
    minXp: 100000,
    maxXp: 150000,
    color: "#fef3c7",
    description: "Um dos grandes nomes da comunidade.",
    unlocks: ["Perfil premium visual", "Destaque vitalicio"],
  },
  {
    id: "IMORTAL",
    order: 12,
    name: "Imortal",
    tier: "PRESTIGIO",
    minXp: 150000,
    maxXp: null,
    color: "#fde68a",
    description: "Status maximo, reservado para atletas historicos.",
    unlocks: ["Hall da fama maximo", "Selo Imortal"],
  },
];

export function getLevelByXp(xp: number): RunnerLevel {
  return (
    runnerLevels.find((level) => {
      const aboveMin = xp >= level.minXp;
      const belowMax = level.maxXp === null || xp < level.maxXp;
      return aboveMin && belowMax;
    }) ?? runnerLevels[0]
  );
}

export function getNextLevel(xp: number): RunnerLevel | null {
  const current = getLevelByXp(xp);
  return runnerLevels.find((level) => level.order === current.order + 1) ?? null;
}

export function getLevelProgress(xp: number) {
  const current = getLevelByXp(xp);
  const next = getNextLevel(xp);

  if (!next || current.maxXp === null) {
    return {
      current,
      next: null,
      percent: 100,
      xpIntoLevel: xp - current.minXp,
      xpForNext: 0,
      remainingXp: 0,
    };
  }

  const xpIntoLevel = xp - current.minXp;
  const xpForNext = current.maxXp - current.minXp;
  const remainingXp = current.maxXp - xp;

  return {
    current,
    next,
    percent: Math.min(100, Math.max(0, Math.round((xpIntoLevel / xpForNext) * 100))),
    xpIntoLevel,
    xpForNext,
    remainingXp,
  };
}
