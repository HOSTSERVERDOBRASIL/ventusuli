import { SportLevel } from "@prisma/client";

interface AthleteContext {
  athleteId: string;
  athleteName: string;
  primaryModality: string | null;
  sportLevel: SportLevel | null;
  sportGoal: string | null;
  injuryHistory: string | null;
  availableEquipment: string[];
  weeklyAvailability: Record<string, unknown> | null;
  nextCompetitionDate: Date | null;
  medicalRestrictions: string | null;
}

interface GenerateTrainingPlanInput {
  athlete: AthleteContext;
  planName: string;
  cycleGoal: string;
  objective?: string | null;
  focusModality?: string | null;
  startDate: Date;
  weeks: number;
  sessionsPerWeek: number;
  coachNotes?: string | null;
}

interface GeneratedDayItem {
  exerciseName: string;
  instructions?: string;
  intensityLabel?: string;
  durationMinutes?: number;
  series?: number;
  repetitions?: string;
  loadDescription?: string;
  distanceMeters?: number;
  paceTarget?: string;
  heartRateTarget?: string;
  targetRpe?: number;
  notes?: string;
}

export interface GeneratedTrainingWeek {
  weekNumber: number;
  focus: string;
  days: Array<{
    scheduledDate: Date;
    title: string;
    objective: string;
    isRestDay: boolean;
    coachNotes?: string;
    items: GeneratedDayItem[];
  }>;
}

export interface GeneratedTrainingPlan {
  summary: string;
  rationale: string;
  weeks: GeneratedTrainingWeek[];
}

function modalityLabel(value: string | null | undefined): string {
  return value?.trim() || "corrida";
}

function sessionsForLevel(level: SportLevel | null): number {
  if (level === "ELITE") return 6;
  if (level === "ADVANCED") return 5;
  if (level === "INTERMEDIATE") return 4;
  return 3;
}

function baseDuration(level: SportLevel | null): number {
  if (level === "ELITE") return 80;
  if (level === "ADVANCED") return 65;
  if (level === "INTERMEDIATE") return 50;
  return 35;
}

function createRunWorkout(
  title: string,
  objective: string,
  durationMinutes: number,
  distanceMeters: number,
  rpe: number,
  notes: string,
): GeneratedDayItem[] {
  return [
    {
      exerciseName: "Aquecimento",
      instructions: "Mobilidade leve e trote progressivo.",
      durationMinutes: 10,
      intensityLabel: "Leve",
      targetRpe: 3,
    },
    {
      exerciseName: title,
      instructions: objective,
      durationMinutes,
      distanceMeters,
      intensityLabel: rpe >= 7 ? "Moderada/Alta" : "Moderada",
      targetRpe: rpe,
      notes,
    },
    {
      exerciseName: "Desaquecimento",
      instructions: "Trote leve e alongamento rapido.",
      durationMinutes: 8,
      intensityLabel: "Leve",
      targetRpe: 2,
    },
  ];
}

function createStrengthWorkout(
  level: SportLevel | null,
  availableEquipment: string[],
): GeneratedDayItem[] {
  const equipment = availableEquipment.join(", ") || "peso corporal";
  return [
    {
      exerciseName: "Agachamento",
      series: level === "ADVANCED" || level === "ELITE" ? 4 : 3,
      repetitions: level === "BEGINNER" ? "10" : "8-10",
      loadDescription: `Carga progressiva conforme tecnica. Equipamentos: ${equipment}.`,
      targetRpe: level === "BEGINNER" ? 5 : 6,
      intensityLabel: "Forca",
    },
    {
      exerciseName: "Avanco alternado",
      series: 3,
      repetitions: "10 cada perna",
      targetRpe: 6,
      intensityLabel: "Estabilidade",
    },
    {
      exerciseName: "Core + prancha",
      series: 3,
      repetitions: "30-45 segundos",
      targetRpe: 5,
      intensityLabel: "Controle",
    },
  ];
}

export function generateAiTrainingPlan(input: GenerateTrainingPlanInput): GeneratedTrainingPlan {
  const totalWeeks = Math.max(1, input.weeks);
  const modality = modalityLabel(input.focusModality ?? input.athlete.primaryModality);
  const plannedSessions = Math.max(
    2,
    Math.min(6, input.sessionsPerWeek || sessionsForLevel(input.athlete.sportLevel)),
  );
  const duration = baseDuration(input.athlete.sportLevel);
  const weeks: GeneratedTrainingWeek[] = [];

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber += 1) {
    const weekStart = new Date(input.startDate);
    weekStart.setDate(input.startDate.getDate() + (weekNumber - 1) * 7);

    const days: GeneratedTrainingWeek["days"] = [];
    for (let sessionIndex = 0; sessionIndex < 7; sessionIndex += 1) {
      const scheduledDate = new Date(weekStart);
      scheduledDate.setDate(weekStart.getDate() + sessionIndex);
      const trainingSlot = sessionIndex < plannedSessions;

      if (!trainingSlot) {
        days.push({
          scheduledDate,
          title: "Recuperacao / descanso",
          objective: "Consolidar adaptacao e reduzir fadiga.",
          isRestDay: true,
          coachNotes: "Usar para descanso, mobilidade leve ou caminhada.",
          items: [],
        });
        continue;
      }

      if (sessionIndex === plannedSessions - 1) {
        days.push({
          scheduledDate,
          title: `${modality} longo controlado`,
          objective: "Desenvolver base aerobica e tolerancia ao volume.",
          isRestDay: false,
          coachNotes: "Manter tecnica, hidratacao e cadencia estavel.",
          items: createRunWorkout(
            "Bloco principal continuo",
            "Ritmo controlado e progressao suave no final.",
            duration + weekNumber * 5,
            5000 + weekNumber * 1000,
            6,
            "Nao ultrapassar a sensacao de controle tecnico.",
          ),
        });
        continue;
      }

      if (sessionIndex === 1) {
        days.push({
          scheduledDate,
          title: "Forca e tecnica",
          objective: "Dar suporte estrutural para progressao de carga.",
          isRestDay: false,
          coachNotes: "Priorizar tecnica e amplitude segura.",
          items: createStrengthWorkout(input.athlete.sportLevel, input.athlete.availableEquipment),
        });
        continue;
      }

      days.push({
        scheduledDate,
        title: `${modality} ritmado`,
        objective: "Estimular ritmo de prova e economia de movimento.",
        isRestDay: false,
        coachNotes: "Controlar respiracao e postura; registrar RPE ao final.",
        items: createRunWorkout(
          "Intervalos progressivos",
          "Alternar blocos moderados com recuperacao curta.",
          duration,
          3500 + weekNumber * 500,
          7,
          "Se houver dor ou fadiga alta, converter em rodagem leve.",
        ),
      });
    }

    weeks.push({
      weekNumber,
      focus:
        weekNumber === totalWeeks
          ? "Consolidacao e ajuste fino"
          : weekNumber === 1
            ? "Adaptacao e encaixe de rotina"
            : "Progressao controlada de volume e intensidade",
      days,
    });
  }

  return {
    summary: `Sugestao de plano com ${totalWeeks} semana(s), foco em ${input.cycleGoal.toLowerCase()} e ${plannedSessions} sessoes por semana.`,
    rationale: `A IA considerou modalidade ${modality}, nivel ${input.athlete.sportLevel ?? "BEGINNER"}, objetivo ${input.objective ?? input.athlete.sportGoal ?? "condicionamento"} e restricoes: ${input.athlete.medicalRestrictions ?? input.athlete.injuryHistory ?? "sem restricoes registradas"}. O plano segue progressao gradual e exige revisao do coach antes da publicacao.`,
    weeks,
  };
}
