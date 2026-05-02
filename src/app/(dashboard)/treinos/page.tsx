"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  HeartPulse,
  MapPin,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  checkInWorkoutSession,
  getAthleteTrainingDashboard,
  submitWorkoutFeedback,
} from "@/services/training-service";
import {
  AthleteTrainingDashboard,
  TrainingSessionFeedback,
  TrainingSessionSummary,
  WeeklyTrainingLoadSummary,
} from "@/services/types";

const EMPTY_WEEK_LOAD: WeeklyTrainingLoadSummary = {
  weekStart: "",
  weekEnd: "",
  label: "-",
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

const EMPTY_DASHBOARD: AthleteTrainingDashboard = {
  athleteId: "",
  athleteName: "",
  profile: null,
  currentPlan: null,
  todaySession: null,
  nextSessions: [],
  recentRecommendations: [],
  metrics: {
    completedSessions: 0,
    pendingSessions: 0,
    averageEffort: null,
    consistencyPercent: 0,
  },
  loadControl: {
    currentWeek: EMPTY_WEEK_LOAD,
    previousWeek: EMPTY_WEEK_LOAD,
    recentWeeks: [],
    methodology: {
      sessionFormula: "carga da sessao = duracao em minutos x esforco percebido",
      weeklyFormula: "carga semanal = soma das cargas das sessoes realizadas na semana",
      painAlertThreshold: 6,
      overloadIncreaseThresholdPercent: 30,
      borgScale: [],
      paceZones: [],
    },
  },
};

type FeedbackFormState = {
  completedFlag: "COMPLETED" | "PARTIAL" | "MISSED";
  perceivedEffort: string;
  painLevel: string;
  painArea: string;
  discomfortNotes: string;
  observation: string;
  actualDurationMinutes: string;
  actualLoad: string;
  actualDistanceM: string;
  actualPace: string;
  actualHeartRate: string;
};

type TrainingTab = "today" | "feedback" | "progress" | "upcoming";

const EMPTY_FORM: FeedbackFormState = {
  completedFlag: "COMPLETED",
  perceivedEffort: "",
  painLevel: "",
  painArea: "",
  discomfortNotes: "",
  observation: "",
  actualDurationMinutes: "",
  actualLoad: "",
  actualDistanceM: "",
  actualPace: "",
  actualHeartRate: "",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function workoutStatusLabel(status: TrainingSessionSummary["status"]): string {
  if (status === "COMPLETED") return "Concluido";
  if (status === "PARTIAL") return "Parcial";
  if (status === "MISSED") return "Nao realizado";
  return "Pendente";
}

function workoutStatusTone(
  status: TrainingSessionSummary["status"],
): "positive" | "warning" | "danger" | "neutral" {
  if (status === "COMPLETED") return "positive";
  if (status === "PARTIAL") return "warning";
  if (status === "MISSED") return "danger";
  return "neutral";
}

function recommendationTone(type: string): "info" | "warning" | "danger" | "positive" {
  if (type === "RECOVERY_ALERT") return "danger";
  if (type === "LOAD_REDUCTION" || type === "MONITORING") return "warning";
  if (type === "PROGRESSION") return "positive";
  return "info";
}

function loadAlertTone(
  level: WeeklyTrainingLoadSummary["alertLevel"],
): "positive" | "warning" | "danger" {
  if (level === "HIGH") return "danger";
  if (level === "ATTENTION") return "warning";
  return "positive";
}

function loadAlertLabel(level: WeeklyTrainingLoadSummary["alertLevel"]): string {
  if (level === "HIGH") return "Risco alto";
  if (level === "ATTENTION") return "Atencao";
  return "Estavel";
}

function formatLoadChange(value: number | null): string {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function formatKm(valueM: number): string {
  return `${(valueM / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function sessionDurationEstimate(session: TrainingSessionSummary | null): number | null {
  if (!session) return null;
  const total = session.exercises.reduce(
    (sum, exercise) => sum + (exercise.durationMinutes ?? 0),
    0,
  );
  return total > 0 ? total : null;
}

function createFormState(feedback: TrainingSessionFeedback | null | undefined): FeedbackFormState {
  if (!feedback) return EMPTY_FORM;
  return {
    completedFlag: feedback.completedFlag,
    perceivedEffort: feedback.perceivedEffort?.toString() ?? "",
    painLevel: feedback.painLevel?.toString() ?? "",
    painArea: feedback.painArea ?? "",
    discomfortNotes: feedback.discomfortNotes ?? "",
    observation: feedback.observation ?? "",
    actualDurationMinutes: feedback.actualDurationMinutes?.toString() ?? "",
    actualLoad: feedback.actualLoad ?? "",
    actualDistanceM: feedback.actualDistanceM?.toString() ?? "",
    actualPace: feedback.actualPace ?? "",
    actualHeartRate: feedback.actualHeartRate?.toString() ?? "",
  };
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 5_000 },
    );
  });
}

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AthleteTreinosPage() {
  const { hydrated, accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AthleteTrainingDashboard>(EMPTY_DASHBOARD);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [form, setForm] = useState<FeedbackFormState>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<TrainingTab>("today");
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getAthleteTrainingDashboard(accessToken);
      setDashboard(payload);
      const initialSession = payload.todaySession ?? payload.nextSessions[0] ?? null;
      setSelectedSessionId(initialSession?.id ?? "");
      setForm(createFormState(initialSession?.feedback));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar treinos.");
      setDashboard(EMPTY_DASHBOARD);
      setSelectedSessionId("");
      setForm(EMPTY_FORM);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  const allSessions = useMemo(() => {
    const sessions = [...dashboard.nextSessions];
    if (
      dashboard.todaySession &&
      !sessions.some((session) => session.id === dashboard.todaySession?.id)
    ) {
      sessions.unshift(dashboard.todaySession);
    }
    return sessions;
  }, [dashboard.nextSessions, dashboard.todaySession]);

  const selectedSession =
    allSessions.find((session) => session.id === selectedSessionId) ??
    dashboard.todaySession ??
    allSessions[0] ??
    null;

  const safetyLog = useMemo(
    () =>
      selectedSession?.athleteNotes
        ?.split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-3) ?? [],
    [selectedSession?.athleteNotes],
  );

  useEffect(() => {
    setForm(createFormState(selectedSession?.feedback));
    const startedAt = selectedSession?.startedAt
      ? new Date(selectedSession.startedAt).getTime()
      : null;
    const completedAt = selectedSession?.completedAt
      ? new Date(selectedSession.completedAt).getTime()
      : null;

    if (startedAt && Number.isFinite(startedAt)) {
      setWorkoutStarted(true);
      setTimerRunning(!completedAt && selectedSession?.status === "PENDING");
      const end = completedAt && Number.isFinite(completedAt) ? completedAt : Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((end - startedAt) / 1000)));
      return;
    }

    setWorkoutStarted(false);
    setTimerRunning(false);
    setElapsedSeconds(0);
  }, [
    selectedSessionId,
    selectedSession?.completedAt,
    selectedSession?.feedback,
    selectedSession?.startedAt,
    selectedSession?.status,
  ]);

  useEffect(() => {
    if (!timerRunning) return;

    const id = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [timerRunning]);

  const plannedSessions = useMemo(
    () =>
      dashboard.currentPlan?.weeks.reduce(
        (total, week) => total + week.days.filter((day) => !day.isRestDay).length,
        0,
      ) ?? 0,
    [dashboard.currentPlan],
  );

  const selectedDurationEstimate = sessionDurationEstimate(selectedSession);
  const completedUpcomingSessions = allSessions.filter(
    (session) => session.status === "COMPLETED",
  ).length;
  const tabItems = useMemo(
    () => [
      {
        key: "today" as const,
        label: "Treino do Dia",
        description: selectedSession ? selectedSession.title : "Sem sessao",
        icon: Timer,
      },
      {
        key: "feedback" as const,
        label: "Feedback",
        description: selectedSession?.feedback ? "Enviado" : "Pendente",
        icon: MessageSquareText,
      },
      {
        key: "progress" as const,
        label: "Progresso do Ciclo",
        description: `${dashboard.loadControl.currentWeek.totalLoad} carga`,
        icon: TrendingUp,
      },
      {
        key: "upcoming" as const,
        label: "Proximas Sessoes",
        description: `${completedUpcomingSessions}/${allSessions.length} concluidas`,
        icon: CalendarDays,
      },
    ],
    [
      allSessions.length,
      completedUpcomingSessions,
      dashboard.loadControl.currentWeek.totalLoad,
      selectedSession,
    ],
  );

  const handleWorkoutCheckIn = async (
    action: "START" | "SAFE_PING" | "CHECK_OUT",
    note: string,
  ) => {
    if (!selectedSession) {
      toast.error("Selecione uma sessao para registrar o check-in.");
      return;
    }

    setCheckInSaving(true);
    try {
      const position = await getCurrentPosition();
      await checkInWorkoutSession(
        selectedSession.id,
        {
          action,
          note,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
        },
        accessToken,
      );

      if (action === "START") {
        setWorkoutStarted(true);
        setTimerRunning(true);
      }
      if (action === "CHECK_OUT") {
        setTimerRunning(false);
      }

      toast.success(
        action === "START"
          ? "Check-in de treino salvo."
          : action === "CHECK_OUT"
            ? "Check-out seguro registrado."
            : "Ponto seguro registrado.",
      );
      await load();
    } catch (checkInError) {
      toast.error(
        checkInError instanceof Error ? checkInError.message : "Falha ao salvar check-in.",
      );
    } finally {
      setCheckInSaving(false);
    }
  };

  const handleResetTimer = () => {
    setWorkoutStarted(false);
    setTimerRunning(false);
    setElapsedSeconds(0);
  };

  const handleSubmit = async () => {
    if (!selectedSession) {
      toast.error("Selecione uma sessao para registrar o feedback.");
      return;
    }

    setSaving(true);
    try {
      await submitWorkoutFeedback(
        selectedSession.id,
        {
          completedFlag: form.completedFlag,
          perceivedEffort: parseOptionalNumber(form.perceivedEffort),
          painLevel: parseOptionalNumber(form.painLevel),
          painArea: form.painArea || null,
          discomfortNotes: form.discomfortNotes || null,
          observation: form.observation || null,
          actualDurationMinutes: parseOptionalNumber(form.actualDurationMinutes),
          actualLoad: form.actualLoad || null,
          actualDistanceM: parseOptionalNumber(form.actualDistanceM),
          actualPace: form.actualPace || null,
          actualHeartRate: parseOptionalNumber(form.actualHeartRate),
        },
        accessToken,
      );
      toast.success("Feedback enviado para o treinador.");
      await load();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error ? submitError.message : "Falha ao registrar feedback.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treinos"
        subtitle="Treino do dia, feedback, progresso do ciclo e proximas sessoes."
      />

      {loading ? (
        <LoadingState lines={6} />
      ) : error ? (
        <EmptyState title="Modulo de treinos indisponivel" description={error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Treinos concluidos"
              value={dashboard.metrics.completedSessions}
              icon={TrendingUp}
            />
            <MetricCard
              label="Treinos pendentes"
              value={dashboard.metrics.pendingSessions}
              icon={CalendarDays}
            />
            <MetricCard
              label="Consistencia"
              value={`${dashboard.metrics.consistencyPercent}%`}
              icon={Target}
              tone="highlight"
            />
            <MetricCard
              label="RPE medio"
              value={dashboard.metrics.averageEffort ?? "-"}
              icon={HeartPulse}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-4" role="tablist" aria-label="Modulos de treino">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.key)}
                  className={`min-h-[88px] rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-[#F5A623]/60 bg-[#F5A623]/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/65 hover:border-sky-300/40 hover:text-white"
                  }`}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <Icon className="h-4 w-4 text-sky-200" />
                    <span className="min-w-0 max-w-[140px] truncate text-[11px] uppercase tracking-[0.1em] text-white/35">
                      {tab.description}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{tab.label}</p>
                </button>
              );
            })}
          </div>

          {activeTab === "progress" ? (
            <SectionCard
              title="Controle de carga"
              description="Carga calculada com duracao em minutos multiplicada pelo esforco percebido."
              action={
                <StatusBadge
                  tone={loadAlertTone(dashboard.loadControl.currentWeek.alertLevel)}
                  label={loadAlertLabel(dashboard.loadControl.currentWeek.alertLevel)}
                />
              }
            >
              <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Semana atual</p>
                  <p className="mt-2 text-4xl font-bold text-white">
                    {dashboard.loadControl.currentWeek.totalLoad}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                    <span>Sessoes: {dashboard.loadControl.currentWeek.sessionsDone}</span>
                    <span>
                      Variacao:{" "}
                      {formatLoadChange(dashboard.loadControl.currentWeek.loadChangePercent)}
                    </span>
                    <span>
                      Volume: {formatKm(dashboard.loadControl.currentWeek.totalDistanceM)}
                    </span>
                    <span>RPE: {dashboard.loadControl.currentWeek.averageEffort ?? "-"}</span>
                  </div>
                  {dashboard.loadControl.currentWeek.alertReason ? (
                    <p className="mt-3 text-sm text-amber-100">
                      {dashboard.loadControl.currentWeek.alertReason}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {dashboard.loadControl.recentWeeks.slice(-6).map((week) => (
                    <div
                      key={week.weekStart}
                      className="rounded-xl border border-white/10 bg-[#0f233d] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                            {week.label}
                          </p>
                          <p className="mt-2 text-xl font-bold text-white">{week.totalLoad}</p>
                        </div>
                        <StatusBadge
                          tone={loadAlertTone(week.alertLevel)}
                          label={formatLoadChange(week.loadChangePercent)}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {week.sessionsDone}/{week.sessionsPlanned} sessoes |{" "}
                        {formatKm(week.totalDistanceM)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          ) : null}

          {activeTab === "today" ? (
            <div className="grid gap-4">
              <SectionCard
                title="Treino do dia"
                description={
                  selectedSession
                    ? `${formatDate(selectedSession.scheduledDate)} | ${selectedSession.title}`
                    : "Nenhuma sessao programada."
                }
                action={
                  selectedSession ? (
                    <StatusBadge
                      tone={workoutStatusTone(selectedSession.status)}
                      label={workoutStatusLabel(selectedSession.status)}
                    />
                  ) : null
                }
              >
                {!selectedSession ? (
                  <EmptyState
                    title="Sem sessao ativa"
                    description="Quando o treinador publicar seu ciclo, os treinos aparecerao aqui."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
                      <p className="text-sm font-semibold text-white">{selectedSession.title}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {selectedSession.objective ?? "Objetivo ainda nao detalhado."}
                      </p>
                      {selectedSession.coachNotes ? (
                        <p className="mt-2 text-xs text-sky-100/80">
                          Coach: {selectedSession.coachNotes}
                        </p>
                      ) : null}
                      <div className="mt-4 rounded-xl border border-white/10 bg-[#08182b] p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                              Timer de execucao
                            </p>
                            <p className="mt-1 font-mono text-3xl font-bold text-white">
                              {formatTimer(elapsedSeconds)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {selectedDurationEstimate
                                ? `Planejado: ${selectedDurationEstimate} min`
                                : "Sem tempo planejado"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!workoutStarted ? (
                              <ActionButton
                                disabled={checkInSaving}
                                onClick={() =>
                                  void handleWorkoutCheckIn(
                                    "START",
                                    "Inicio do treino pelo painel do atleta.",
                                  )
                                }
                              >
                                <PlayCircle className="mr-2 h-4 w-4" />
                                {checkInSaving ? "Salvando..." : "Iniciar treino"}
                              </ActionButton>
                            ) : (
                              <ActionButton
                                intent="secondary"
                                onClick={() => setTimerRunning((current) => !current)}
                              >
                                {timerRunning ? (
                                  <>
                                    <PauseCircle className="mr-2 h-4 w-4" />
                                    Pausar
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Retomar
                                  </>
                                )}
                              </ActionButton>
                            )}
                            <ActionButton intent="secondary" onClick={handleResetTimer}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Zerar
                            </ActionButton>
                          </div>
                        </div>
                        {workoutStarted ? (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                            <ActionButton
                              size="sm"
                              intent="secondary"
                              disabled={checkInSaving}
                              onClick={() =>
                                void handleWorkoutCheckIn(
                                  "SAFE_PING",
                                  "Atleta informou que esta bem durante o treino.",
                                )
                              }
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              Estou bem
                            </ActionButton>
                            <ActionButton
                              size="sm"
                              intent="secondary"
                              disabled={checkInSaving}
                              onClick={() =>
                                void handleWorkoutCheckIn(
                                  "CHECK_OUT",
                                  "Treino finalizado com check-out seguro.",
                                )
                              }
                            >
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              Check-out seguro
                            </ActionButton>
                          </div>
                        ) : null}
                        {safetyLog.length ? (
                          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                              Registro de seguranca
                            </p>
                            <div className="mt-2 space-y-1">
                              {safetyLog.map((line, index) => (
                                <p
                                  key={`${line}-${index}`}
                                  className="text-xs leading-5 text-slate-300"
                                >
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedSession.exercises.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-300">
                          Dia reservado para descanso ou recuperacao.
                        </div>
                      ) : (
                        selectedSession.exercises.map((exercise) => (
                          <div
                            key={exercise.id}
                            className="rounded-xl border border-white/10 bg-[#0f233d] p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {exercise.sortOrder}. {exercise.exerciseName}
                              </p>
                              {exercise.intensityLabel ? (
                                <StatusBadge label={exercise.intensityLabel} tone="info" />
                              ) : null}
                              {exercise.targetRpe ? (
                                <StatusBadge label={`RPE ${exercise.targetRpe}`} tone="warning" />
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
                              {exercise.durationMinutes ? (
                                <span className="inline-flex items-center gap-1">
                                  <Timer className="h-3.5 w-3.5 text-sky-300" />
                                  {exercise.durationMinutes} min
                                </span>
                              ) : null}
                              {exercise.distanceMeters ? (
                                <span>{exercise.distanceMeters} m</span>
                              ) : null}
                              {exercise.series ? <span>{exercise.series} series</span> : null}
                              {exercise.repetitions ? (
                                <span>{exercise.repetitions} reps</span>
                              ) : null}
                              {exercise.paceTarget ? <span>Pace {exercise.paceTarget}</span> : null}
                              {exercise.heartRateTarget ? (
                                <span>FC {exercise.heartRateTarget}</span>
                              ) : null}
                            </div>
                            {exercise.instructions ? (
                              <p className="mt-2 text-sm text-slate-200">{exercise.instructions}</p>
                            ) : null}
                            {exercise.loadDescription || exercise.notes ? (
                              <p className="mt-2 text-xs text-slate-400">
                                {[exercise.loadDescription, exercise.notes]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "feedback" ? (
            <div className="grid gap-4">
              <SectionCard
                title="Registrar feedback"
                description="Retorno da sessao para revisao tecnica."
              >
                {!selectedSession ? (
                  <EmptyState
                    title="Sem sessao selecionada"
                    description="Escolha uma sessao quando houver treinos disponiveis."
                  />
                ) : (
                  <div className="space-y-4">
                    <FormSection title="Sessao">
                      <FormField label="Treino">
                        <Select
                          value={selectedSessionId}
                          onChange={(event) => setSelectedSessionId(event.target.value)}
                        >
                          {allSessions.map((session) => (
                            <option key={session.id} value={session.id}>
                              {formatDate(session.scheduledDate)} | {session.title}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </FormSection>

                    <FormSection title="Status e resposta">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Execucao">
                          <Select
                            value={form.completedFlag}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                completedFlag: event.target
                                  .value as FeedbackFormState["completedFlag"],
                              }))
                            }
                          >
                            <option value="COMPLETED">Concluido</option>
                            <option value="PARTIAL">Parcial</option>
                            <option value="MISSED">Nao realizado</option>
                          </Select>
                        </FormField>
                        <FormField label="RPE 1-5">
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={form.perceivedEffort}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                perceivedEffort: event.target.value,
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="Dor 0-10">
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            value={form.painLevel}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, painLevel: event.target.value }))
                            }
                          />
                        </FormField>
                        <FormField label="Local da dor">
                          <Input
                            value={form.painArea}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, painArea: event.target.value }))
                            }
                          />
                        </FormField>
                      </div>
                    </FormSection>

                    <FormSection title="Metricas realizadas">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Tempo min">
                          <Input
                            type="number"
                            min={0}
                            value={form.actualDurationMinutes}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                actualDurationMinutes: event.target.value,
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="Distancia m">
                          <Input
                            type="number"
                            min={0}
                            value={form.actualDistanceM}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                actualDistanceM: event.target.value,
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="Carga">
                          <Input
                            value={form.actualLoad}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, actualLoad: event.target.value }))
                            }
                          />
                        </FormField>
                        <FormField label="Pace">
                          <Input
                            value={form.actualPace}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, actualPace: event.target.value }))
                            }
                          />
                        </FormField>
                        <FormField label="Frequencia cardiaca" className="sm:col-span-2">
                          <Input
                            type="number"
                            min={0}
                            max={260}
                            value={form.actualHeartRate}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                actualHeartRate: event.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                    </FormSection>

                    <FormSection title="Observacoes">
                      <div className="space-y-3">
                        <FormField label="Dor ou fadiga">
                          <Textarea
                            value={form.discomfortNotes}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                discomfortNotes: event.target.value,
                              }))
                            }
                            className="min-h-[96px]"
                          />
                        </FormField>
                        <FormField label="Resumo da sessao">
                          <Textarea
                            value={form.observation}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                observation: event.target.value,
                              }))
                            }
                            className="min-h-[112px]"
                          />
                        </FormField>
                      </div>
                    </FormSection>

                    {selectedSession.feedback?.submittedAt ? (
                      <p className="text-xs text-slate-400">
                        Ultimo envio em {formatDateTime(selectedSession.feedback.submittedAt)}.
                      </p>
                    ) : null}

                    <ActionButton
                      disabled={saving}
                      onClick={() => void handleSubmit()}
                      className="w-full"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {saving ? "Enviando feedback..." : "Enviar feedback"}
                    </ActionButton>
                  </div>
                )}
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "progress" ? (
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
              <SectionCard
                title="Progresso do ciclo"
                description={
                  dashboard.currentPlan
                    ? `${dashboard.currentPlan.name} | ${dashboard.currentPlan.cycleGoal}`
                    : "Nenhum ciclo ativo."
                }
              >
                {!dashboard.currentPlan ? (
                  <EmptyState
                    title="Sem ciclo ativo"
                    description="Quando a planilha for aprovada pelo treinador, ela aparecera aqui."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label="Ativo" tone="info" />
                        {dashboard.currentPlan.aiGenerated ? (
                          <StatusBadge label="Apoio de IA" tone="warning" />
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm text-slate-300">
                        {dashboard.currentPlan.objective ?? "Objetivo complementar nao registrado."}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {formatDate(dashboard.currentPlan.startDate)} a{" "}
                        {formatDate(dashboard.currentPlan.endDate)} | {plannedSessions} sessoes
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {dashboard.currentPlan.weeks.map((week) => (
                        <div
                          key={week.id}
                          className="rounded-xl border border-white/10 bg-[#0f233d] p-4"
                        >
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                            Semana {week.weekNumber}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {week.focus ?? "Progressao planejada"}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {week.days.filter((day) => !day.isRestDay).length} sessoes |{" "}
                            {week.days.filter((day) => day.status === "COMPLETED").length}{" "}
                            concluidas
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Resumo tecnico" description="Recomendacoes e fila de sessoes.">
                <div className="space-y-4">
                  {dashboard.recentRecommendations.length > 0 ? (
                    <div className="space-y-2.5">
                      {dashboard.recentRecommendations.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-[#0f233d] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              label={item.recommendationType}
                              tone={recommendationTone(item.recommendationType)}
                            />
                            <span className="text-xs text-slate-400">
                              {formatDateTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-white">{item.summary}</p>
                          {item.rationale ? (
                            <p className="mt-1 text-xs text-slate-400">{item.rationale}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Sem recomendacoes recentes"
                      description="Analises de carga e observacoes recentes aparecerao aqui."
                    />
                  )}

                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                      <ClipboardCheck className="h-4 w-4" />
                      Proximas sessoes
                    </div>
                    {allSessions.length === 0 ? (
                      <p className="text-sm text-slate-300">
                        Nenhuma sessao futura cadastrada no momento.
                      </p>
                    ) : (
                      allSessions.slice(0, 5).map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => setSelectedSessionId(session.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f233d] px-4 py-3 text-left transition hover:border-sky-300/30"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {session.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {formatDate(session.scheduledDate)}
                            </p>
                          </div>
                          <StatusBadge
                            tone={workoutStatusTone(session.status)}
                            label={workoutStatusLabel(session.status)}
                          />
                        </button>
                      ))
                    )}
                  </div>

                  {dashboard.profile ? (
                    <div className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                        <Activity className="h-4 w-4" />
                        Perfil esportivo
                      </div>
                      <p className="text-sm text-white">
                        {dashboard.profile.primaryModality ?? "Modalidade nao definida"} |{" "}
                        {dashboard.profile.sportGoal ?? "Objetivo nao definido"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {dashboard.profile.thresholdPace
                          ? `Pace referencia ${dashboard.profile.thresholdPace}`
                          : "Sem pace referencia"}
                      </p>
                    </div>
                  ) : null}

                  {dashboard.loadControl.methodology.paceZones.length > 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                        Zonas de pace
                      </p>
                      <div className="space-y-2">
                        {dashboard.loadControl.methodology.paceZones.map((zone) => (
                          <div
                            key={zone.zone}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="font-semibold text-white">
                              {zone.zone} | {zone.label}
                            </span>
                            <span className="text-slate-400">{zone.paceRange}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "upcoming" ? (
            <SectionCard
              title="Proximas sessoes"
              description="Agenda do ciclo com status planejado e concluido."
            >
              {allSessions.length === 0 ? (
                <EmptyState
                  title="Sem sessoes futuras"
                  description="Quando o treinador publicar o ciclo, as proximas sessoes aparecerao aqui."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {allSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setActiveTab("today");
                      }}
                      className="min-h-[128px] rounded-xl border border-white/10 bg-[#0f233d] p-4 text-left transition hover:border-sky-300/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {session.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(session.scheduledDate)}
                          </p>
                        </div>
                        <StatusBadge
                          tone={workoutStatusTone(session.status)}
                          label={workoutStatusLabel(session.status)}
                        />
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-slate-300">
                        {session.objective ?? "Objetivo nao detalhado."}
                      </p>
                      <p className="mt-3 text-xs text-slate-400">
                        {session.exercises.length} exercicio(s)
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}
