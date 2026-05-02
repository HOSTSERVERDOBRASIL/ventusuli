import type {
  AthleteIdentity,
  ServiceEvent,
  ServiceEventDistance,
  SportLevel,
} from "@/services/types";

export type RaceRecommendationTone = "positive" | "warning" | "danger" | "neutral" | "info";

export interface RaceDistanceRecommendation {
  label: string;
  title: string;
  reason: string;
  tone: RaceRecommendationTone;
  score: number;
}

export interface FirstRaceGuidance {
  title: string;
  description: string;
  targetDistanceKm: number;
  checklist: Array<{
    label: string;
    done: boolean;
    hint: string;
  }>;
}

const LEVEL_TARGET_DISTANCE: Record<SportLevel, number> = {
  BEGINNER: 5,
  INTERMEDIATE: 10,
  ADVANCED: 21.1,
  ELITE: 42.2,
};

function goalDistanceKm(goal?: string | null): number | null {
  if (!goal) return null;
  const normalized = goal.toLowerCase();
  if (/(42|maratona|marathon)/.test(normalized)) return 42.2;
  if (/(21|meia|half)/.test(normalized)) return 21.1;
  if (/(10k|10 km|10km|\b10\b)/.test(normalized)) return 10;
  if (/(5k|5 km|5km|\b5\b)/.test(normalized)) return 5;
  return null;
}

function daysUntil(dateIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateIso);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function fallbackLevel(level?: SportLevel | null): SportLevel {
  return level ?? "BEGINNER";
}

function targetDistanceFor(athlete?: AthleteIdentity | null): number {
  const explicitGoal = goalDistanceKm(athlete?.sportGoal);
  if (explicitGoal) return explicitGoal;
  return LEVEL_TARGET_DISTANCE[fallbackLevel(athlete?.sportLevel)];
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function withScore(
  recommendation: RaceDistanceRecommendation,
  score: number,
): RaceDistanceRecommendation {
  return {
    ...recommendation,
    score: clampScore(score),
  };
}

function readinessByLevel(distanceKm: number, level: SportLevel): RaceDistanceRecommendation {
  if (level === "BEGINNER") {
    if (distanceKm <= 5) {
      return {
        label: "Boa estreia",
        title: "Boa para primeira prova",
        reason: "Distancia curta, controle melhor de ritmo e recuperacao.",
        tone: "positive",
        score: 95,
      };
    }
    if (distanceKm <= 10) {
      return {
        label: "Desafio controlado",
        title: "Desafio possivel com preparo",
        reason: "Boa evolucao depois de uma base consistente de treinos.",
        tone: "info",
        score: 78,
      };
    }
    return {
      label: "Pede ciclo",
      title: "Exige preparacao mais longa",
      reason: "Distancia alta para iniciante; vale planejar um ciclo antes.",
      tone: "warning",
      score: 45,
    };
  }

  if (level === "INTERMEDIATE") {
    if (distanceKm <= 10) {
      return {
        label: "Boa para pace",
        title: "Boa para buscar ritmo",
        reason: "Distancia equilibrada para testar consistencia e pace.",
        tone: "positive",
        score: 90,
      };
    }
    if (distanceKm <= 21.1) {
      return {
        label: "Desafio forte",
        title: "Desafio de ciclo",
        reason: "Combina com evolucao para meia maratona.",
        tone: "info",
        score: 76,
      };
    }
    return {
      label: "Agressiva",
      title: "Escolha agressiva",
      reason: "Melhor validar volume semanal e recuperacao antes.",
      tone: "warning",
      score: 52,
    };
  }

  if (level === "ADVANCED") {
    if (distanceKm <= 21.1) {
      return {
        label: "Boa para RP",
        title: "Boa para performance",
        reason: "Boa oportunidade para buscar recorde pessoal.",
        tone: "positive",
        score: 88,
      };
    }
    return {
      label: "Ciclo longo",
      title: "Exige bloco especifico",
      reason: "Boa meta se o ciclo de volume estiver em dia.",
      tone: "info",
      score: 74,
    };
  }

  return {
    label: "Performance",
    title: "Boa para performance",
    reason: "Adequada para atleta experiente com controle de carga.",
    tone: "positive",
    score: 86,
  };
}

export function getRaceDistanceRecommendation(
  distance: ServiceEventDistance,
  athlete: AthleteIdentity | null,
  eventDate: string,
): RaceDistanceRecommendation {
  const level = fallbackLevel(athlete?.sportLevel);
  const targetDistance = targetDistanceFor(athlete);
  const days = daysUntil(eventDate);
  const base = readinessByLevel(distance.distance_km, level);
  const delta = Math.abs(distance.distance_km - targetDistance);

  if (delta <= 1) {
    return withScore(
      {
        label: "Combina",
        title: "Combina com seu objetivo",
        reason: "A distancia conversa diretamente com sua meta atual.",
        tone: "positive",
        score: base.score + 10,
      },
      base.score + 10,
    );
  }

  if (
    days >= 0 &&
    days < 14 &&
    distance.distance_km >= 10 &&
    level !== "ADVANCED" &&
    level !== "ELITE"
  ) {
    return withScore(
      {
        label: "Em cima",
        title: "Pouco tempo para ajustar",
        reason: "Faltam poucos dias; escolha com cautela se o volume nao estiver pronto.",
        tone: "warning",
        score: Math.min(base.score, 50),
      },
      Math.min(base.score, 50),
    );
  }

  return withScore(base, base.score);
}

export function getEventRecommendation(
  event: ServiceEvent,
  athlete: AthleteIdentity | null,
): RaceDistanceRecommendation | null {
  if (event.distances.length === 0) return null;
  const availableDistances = event.distances.filter(
    (distance) => distance.max_slots == null || distance.registered_count < distance.max_slots,
  );
  const candidates = availableDistances.length > 0 ? availableDistances : event.distances;

  return candidates
    .map((distance) => getRaceDistanceRecommendation(distance, athlete, event.event_date))
    .sort((left, right) => right.score - left.score)[0];
}

export function getFirstRaceGuidance(
  athlete: AthleteIdentity | null,
  events: ServiceEvent[],
): FirstRaceGuidance {
  const targetDistanceKm = targetDistanceFor(athlete);
  const recommendedEvents = events.filter((event) => {
    const recommendation = getEventRecommendation(event, athlete);
    return recommendation?.tone === "positive" || recommendation?.tone === "info";
  });

  return {
    title: `Caminho sugerido: ${targetDistanceKm >= 21 ? `${targetDistanceKm.toFixed(1)}K` : `${targetDistanceKm}K`}`,
    description:
      athlete?.sportGoal ??
      "Comece por uma prova com distancia controlada, calendario claro e margem para treinar sem pressa.",
    targetDistanceKm,
    checklist: [
      {
        label: "Perfil esportivo",
        done: Boolean(athlete?.sportLevel || athlete?.sportGoal),
        hint: "Defina nivel e objetivo para melhorar as sugestoes.",
      },
      {
        label: "Provas compativeis",
        done: recommendedEvents.length > 0,
        hint: `${recommendedEvents.length} prova(s) com boa leitura para seu momento.`,
      },
      {
        label: "Contato de emergencia",
        done: Boolean(athlete?.emergencyContact),
        hint: "Ajuda a assessoria em treino, prova e deslocamento.",
      },
    ],
  };
}
