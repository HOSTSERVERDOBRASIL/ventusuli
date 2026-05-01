export type TrainingLoadAlertLevel = "OK" | "ATTENTION" | "HIGH";

interface TrainingLoadSessionInput {
  id: string;
  status: string;
  perceived_effort: number | null;
  actual_duration_minutes: number | null;
  actual_distance_m: number | null;
  training_day: {
    scheduled_date: Date;
    title: string;
    items?: Array<{
      duration_minutes: number | null;
      distance_meters: number | null;
      target_rpe: number | null;
    }>;
  };
  feedback?: {
    pain_level: number | null;
    actual_duration_minutes?: number | null;
    actual_distance_m?: number | null;
    perceived_effort?: number | null;
  } | null;
}

export interface TrainingLoadSessionMetric {
  sessionId: string;
  scheduledDate: string;
  title: string;
  status: string;
  durationMinutes: number | null;
  distanceM: number | null;
  perceivedEffort: number | null;
  painLevel: number | null;
  trainingLoad: number | null;
  plannedDurationMinutes: number | null;
  plannedDistanceM: number | null;
  plannedLoad: number | null;
}

export interface WeeklyTrainingLoadSummary {
  weekStart: string;
  weekEnd: string;
  label: string;
  sessionsDone: number;
  sessionsPlanned: number;
  totalLoad: number;
  averageLoad: number;
  totalDistanceM: number;
  averageEffort: number | null;
  averagePain: number | null;
  loadChangePercent: number | null;
  alertLevel: TrainingLoadAlertLevel;
  alertReason: string | null;
  sessions: TrainingLoadSessionMetric[];
}

export interface TrainingLoadMethodology {
  sessionFormula: string;
  weeklyFormula: string;
  painAlertThreshold: number;
  overloadIncreaseThresholdPercent: number;
  borgScale: Array<{ value: number | string; label: string }>;
  paceZones: Array<{ zone: string; label: string; paceRange: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const TRAINING_LOAD_METHODOLOGY: TrainingLoadMethodology = {
  sessionFormula: "carga da sessao = duracao em minutos x esforco percebido",
  weeklyFormula: "carga semanal = soma das cargas das sessoes realizadas na semana",
  painAlertThreshold: 6,
  overloadIncreaseThresholdPercent: 30,
  borgScale: [
    { value: 1, label: "muito leve" },
    { value: 2, label: "leve" },
    { value: 3, label: "moderada" },
    { value: 4, label: "intensa" },
    { value: 5, label: "maxima" },
  ],
  paceZones: [
    { zone: "Z1", label: "Regenerativo", paceRange: "8:45 - 7:50 min/km" },
    { zone: "Z2", label: "Aerobico leve", paceRange: "7:50 - 7:00 min/km" },
    { zone: "Z3", label: "Limiar", paceRange: "7:00 - 6:25 min/km" },
    { zone: "Z4", label: "Forte / intervalado", paceRange: "6:25 - 5:50 min/km" },
  ],
};

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function startOfWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  return start;
}

function endOfWeek(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(weekStart.getUTCDate() + 6);
  return end;
}

function weekLabel(weekStart: Date): string {
  const end = endOfWeek(weekStart);
  return `${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} - ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`;
}

function sumNumbers(values: Array<number | null | undefined>): number {
  return values.reduce<number>(
    (sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
    0,
  );
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (valid.length === 0) return null;
  return round1(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function calculateLoad(durationMinutes: number | null, perceivedEffort: number | null): number | null {
  if (!durationMinutes || !perceivedEffort) return null;
  return round1(durationMinutes * perceivedEffort);
}

function plannedDuration(session: TrainingLoadSessionInput): number | null {
  const total = sumNumbers(session.training_day.items?.map((item) => item.duration_minutes) ?? []);
  return total > 0 ? total : null;
}

function plannedDistance(session: TrainingLoadSessionInput): number | null {
  const total = sumNumbers(session.training_day.items?.map((item) => item.distance_meters) ?? []);
  return total > 0 ? total : null;
}

function plannedRpe(session: TrainingLoadSessionInput): number | null {
  return average(session.training_day.items?.map((item) => item.target_rpe) ?? []);
}

export function mapTrainingLoadSession(session: TrainingLoadSessionInput): TrainingLoadSessionMetric {
  const durationMinutes =
    session.actual_duration_minutes ?? session.feedback?.actual_duration_minutes ?? null;
  const distanceM = session.actual_distance_m ?? session.feedback?.actual_distance_m ?? null;
  const perceivedEffort =
    session.perceived_effort ?? session.feedback?.perceived_effort ?? null;
  const plannedDurationMinutes = plannedDuration(session);
  const plannedDistanceM = plannedDistance(session);
  const plannedLoad = calculateLoad(plannedDurationMinutes, plannedRpe(session));

  return {
    sessionId: session.id,
    scheduledDate: session.training_day.scheduled_date.toISOString(),
    title: session.training_day.title,
    status: session.status,
    durationMinutes,
    distanceM,
    perceivedEffort,
    painLevel: session.feedback?.pain_level ?? null,
    trainingLoad: calculateLoad(durationMinutes, perceivedEffort),
    plannedDurationMinutes,
    plannedDistanceM,
    plannedLoad,
  };
}

function buildEmptyWeek(weekStart: Date): WeeklyTrainingLoadSummary {
  return {
    weekStart: weekStart.toISOString(),
    weekEnd: endOfWeek(weekStart).toISOString(),
    label: weekLabel(weekStart),
    sessionsDone: 0,
    sessionsPlanned: 0,
    totalLoad: 0,
    averageLoad: 0,
    totalDistanceM: 0,
    averageEffort: null,
    averagePain: null,
    loadChangePercent: null,
    alertLevel: "OK",
    alertReason: null,
    sessions: [],
  };
}

function classifyWeek(
  week: WeeklyTrainingLoadSummary,
  previous: WeeklyTrainingLoadSummary | null,
): WeeklyTrainingLoadSummary {
  const loadChangePercent =
    previous && previous.totalLoad > 0
      ? round1(((week.totalLoad - previous.totalLoad) / previous.totalLoad) * 100)
      : null;

  let alertLevel: TrainingLoadAlertLevel = "OK";
  let alertReason: string | null = null;

  if ((week.averagePain ?? 0) >= TRAINING_LOAD_METHODOLOGY.painAlertThreshold) {
    alertLevel = "HIGH";
    alertReason = "Dor media elevada na semana.";
  } else if ((week.averageEffort ?? 0) >= 4.5) {
    alertLevel = "HIGH";
    alertReason = "Esforco medio muito alto.";
  } else if (
    loadChangePercent !== null &&
    loadChangePercent >= TRAINING_LOAD_METHODOLOGY.overloadIncreaseThresholdPercent
  ) {
    alertLevel = "ATTENTION";
    alertReason = `Carga subiu ${loadChangePercent}% vs. semana anterior.`;
  } else if (week.sessionsDone === 0 && week.sessionsPlanned > 0) {
    alertLevel = "ATTENTION";
    alertReason = "Semana com treinos planejados sem carga registrada.";
  }

  return {
    ...week,
    loadChangePercent,
    alertLevel,
    alertReason,
  };
}

export function buildWeeklyTrainingLoad(
  sessions: TrainingLoadSessionInput[],
  referenceDate = new Date(),
): WeeklyTrainingLoadSummary[] {
  const metrics = sessions.map(mapTrainingLoadSession);
  const weekMap = new Map<string, TrainingLoadSessionMetric[]>();

  for (const metric of metrics) {
    const weekStart = startOfWeek(new Date(metric.scheduledDate));
    const key = weekStart.toISOString().slice(0, 10);
    weekMap.set(key, [...(weekMap.get(key) ?? []), metric]);
  }

  const currentWeekStart = startOfWeek(referenceDate);
  for (let offset = -5; offset <= 1; offset += 1) {
    const weekStart = new Date(currentWeekStart.getTime() + offset * 7 * DAY_MS);
    const key = weekStart.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, []);
  }

  const baseWeeks = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, weekSessions]) => {
      const weekStart = new Date(`${key}T12:00:00.000Z`);
      const doneSessions = weekSessions.filter((session) => session.trainingLoad !== null);
      const totalLoad = round1(sumNumbers(doneSessions.map((session) => session.trainingLoad)));
      const totalDistanceM = Math.round(
        sumNumbers(weekSessions.map((session) => session.distanceM ?? session.plannedDistanceM)),
      );

      return {
        ...buildEmptyWeek(weekStart),
        sessionsDone: doneSessions.length,
        sessionsPlanned: weekSessions.length,
        totalLoad,
        averageLoad: doneSessions.length > 0 ? round1(totalLoad / doneSessions.length) : 0,
        totalDistanceM,
        averageEffort: average(doneSessions.map((session) => session.perceivedEffort)),
        averagePain: average(doneSessions.map((session) => session.painLevel)),
        sessions: weekSessions.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
      };
    });

  return baseWeeks.map((week, index) => classifyWeek(week, baseWeeks[index - 1] ?? null));
}

export function getCurrentAndPreviousLoadWeeks(
  weeks: WeeklyTrainingLoadSummary[],
  referenceDate = new Date(),
): {
  currentWeek: WeeklyTrainingLoadSummary;
  previousWeek: WeeklyTrainingLoadSummary;
  recentWeeks: WeeklyTrainingLoadSummary[];
} {
  const currentStartKey = startOfWeek(referenceDate).toISOString().slice(0, 10);
  const currentIndex = weeks.findIndex((week) => week.weekStart.slice(0, 10) === currentStartKey);
  const currentWeek =
    currentIndex >= 0 ? weeks[currentIndex] : buildEmptyWeek(startOfWeek(referenceDate));
  const previousWeek =
    currentIndex > 0
      ? weeks[currentIndex - 1]
      : buildEmptyWeek(new Date(startOfWeek(referenceDate).getTime() - 7 * DAY_MS));

  return {
    currentWeek,
    previousWeek,
    recentWeeks: weeks.slice(-6),
  };
}
