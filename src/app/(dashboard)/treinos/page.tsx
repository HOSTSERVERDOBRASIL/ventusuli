"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  HeartPulse,
  Send,
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

function loadAlertTone(level: WeeklyTrainingLoadSummary["alertLevel"]): "positive" | "warning" | "danger" {
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

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
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

  useEffect(() => {
    setForm(createFormState(selectedSession?.feedback));
  }, [selectedSessionId, selectedSession?.feedback]);

  const plannedSessions = useMemo(
    () =>
      dashboard.currentPlan?.weeks.reduce(
        (total, week) => total + week.days.filter((day) => !day.isRestDay).length,
        0,
      ) ?? 0,
    [dashboard.currentPlan],
  );

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
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  Semana atual
                </p>
                <p className="mt-2 text-4xl font-bold text-white">
                  {dashboard.loadControl.currentWeek.totalLoad}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <span>Sessoes: {dashboard.loadControl.currentWeek.sessionsDone}</span>
                  <span>Variacao: {formatLoadChange(dashboard.loadControl.currentWeek.loadChangePercent)}</span>
                  <span>Volume: {formatKm(dashboard.loadControl.currentWeek.totalDistanceM)}</span>
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
                      {week.sessionsDone}/{week.sessionsPlanned} sessoes | {formatKm(week.totalDistanceM)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
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
                            {exercise.repetitions ? <span>{exercise.repetitions} reps</span> : null}
                            {exercise.paceTarget ? <span>Pace {exercise.paceTarget}</span> : null}
                            {exercise.heartRateTarget ? <span>FC {exercise.heartRateTarget}</span> : null}
                          </div>
                          {exercise.instructions ? (
                            <p className="mt-2 text-sm text-slate-200">{exercise.instructions}</p>
                          ) : null}
                          {exercise.loadDescription || exercise.notes ? (
                            <p className="mt-2 text-xs text-slate-400">
                              {[exercise.loadDescription, exercise.notes].filter(Boolean).join(" | ")}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Registrar feedback" description="Retorno da sessao para revisao tecnica.">
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
                              completedFlag: event.target.value as FeedbackFormState["completedFlag"],
                            }))
                          }
                        >
                          <option value="COMPLETED">Concluido</option>
                          <option value="PARTIAL">Parcial</option>
                          <option value="MISSED">Nao realizado</option>
                        </Select>
                      </FormField>
                      <FormField label="RPE 1-10">
                        <Input
                          type="number"
                          min={1}
                          max={10}
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
                          {week.days.filter((day) => day.status === "COMPLETED").length} concluidas
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
                          <p className="truncate text-sm font-semibold text-white">{session.title}</p>
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
                        <div key={zone.zone} className="flex items-center justify-between gap-3 text-xs">
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
        </>
      )}
    </div>
  );
}
