"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Sparkles,
  UserRound,
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
import { getAthleteDetail, getAthletesList } from "@/services/athletes-service";
import {
  generateTrainingPlanWithAI,
  getCoachTrainingDashboard,
  getExerciseLibrary,
  getTrainingPlans,
  updateAthleteTrainingProfile,
  updateTrainingPlan,
} from "@/services/training-service";
import {
  AthleteDetail,
  AthleteListRow,
  CoachTrainingDashboard,
  ExerciseLibraryItem,
  TrainingPlanSummary,
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

const EMPTY_DASHBOARD: CoachTrainingDashboard = {
  metrics: {
    activeAthletes: 0,
    activePlans: 0,
    pendingSessions: 0,
    completedSessions: 0,
    overloadRiskAthletes: 0,
    pendingRecommendations: 0,
    currentWeekLoad: 0,
  },
  priorityAthletes: [],
  recentRecommendations: [],
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

const todayIso = new Date().toISOString().slice(0, 10);

function statusTone(status: TrainingPlanSummary["status"]): "positive" | "warning" | "neutral" {
  if (status === "ACTIVE") return "positive";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

function statusLabel(status: TrainingPlanSummary["status"]): string {
  if (status === "ACTIVE") return "Ativo";
  if (status === "COMPLETED") return "Concluido";
  if (status === "ARCHIVED") return "Arquivado";
  return "Rascunho";
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEquipment(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIsoFromDate(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toISOString();
}

function toIsoFromDateTime(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
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
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 pt-5 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-sky-300" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-200">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function CoachTreinosPage() {
  const { hydrated, accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CoachTrainingDashboard>(EMPTY_DASHBOARD);
  const [athletes, setAthletes] = useState<AthleteListRow[]>([]);
  const [plans, setPlans] = useState<TrainingPlanSummary[]>([]);
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [selectedAthleteDetail, setSelectedAthleteDetail] = useState<AthleteDetail | null>(null);
  const [form, setForm] = useState({
    planName: "",
    cycleGoal: "",
    objective: "",
    focusModality: "Corrida",
    startDate: `${todayIso}T12:00:00.000Z`,
    weeks: "4",
    sessionsPerWeek: "4",
    coachNotes: "",
    primaryModality: "Corrida",
    sportLevel: "INTERMEDIATE",
    sportGoal: "",
    weeklyAvailability: "Seg, Qua, Sex e Sab",
    injuryHistory: "",
    medicalRestrictions: "",
    availableEquipment: "peso corporal, elastico, halteres",
    restingHeartRate: "",
    thresholdPace: "",
    maxLoadNotes: "",
    nextCompetitionDate: "",
    coachProfileNotes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardPayload, athletesPayload, plansPayload, exercisePayload] = await Promise.all([
        getCoachTrainingDashboard(accessToken),
        getAthletesList({
          status: "ALL",
          sortBy: "nextEvent",
          sortDir: "asc",
          page: 1,
          pageSize: 100,
          accessToken,
        }),
        getTrainingPlans({ accessToken }),
        getExerciseLibrary({ accessToken }),
      ]);

      setDashboard(dashboardPayload);
      setAthletes(athletesPayload.data);
      setPlans(plansPayload);
      setExercises(exercisePayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar modulo de treinos.");
      setDashboard(EMPTY_DASHBOARD);
      setAthletes([]);
      setPlans([]);
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  useEffect(() => {
    if (!selectedAthleteId) {
      setSelectedAthleteDetail(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const detail = await getAthleteDetail(selectedAthleteId, accessToken);
        if (cancelled) return;
        setSelectedAthleteDetail(detail);
        setForm((current) => ({
          ...current,
          planName: current.planName || `Plano ${detail.name}`,
          cycleGoal: current.cycleGoal || detail.trainingProfile?.sportGoal || "Evolucao de performance",
          objective: current.objective || detail.trainingProfile?.sportGoal || "",
          focusModality: detail.trainingProfile?.primaryModality || current.focusModality,
          primaryModality: detail.trainingProfile?.primaryModality || current.primaryModality,
          sportLevel: detail.trainingProfile?.sportLevel || current.sportLevel,
          sportGoal: detail.trainingProfile?.sportGoal || current.sportGoal,
          weeklyAvailability:
            (detail.trainingProfile?.weeklyAvailability?.summary as string | undefined) ||
            current.weeklyAvailability,
          injuryHistory: detail.trainingProfile?.injuryHistory || current.injuryHistory,
          medicalRestrictions:
            detail.trainingProfile?.medicalRestrictions || current.medicalRestrictions,
          availableEquipment:
            detail.trainingProfile?.availableEquipment?.join(", ") || current.availableEquipment,
          restingHeartRate:
            detail.trainingProfile?.restingHeartRate?.toString() || current.restingHeartRate,
          thresholdPace: detail.trainingProfile?.thresholdPace || current.thresholdPace,
          maxLoadNotes: detail.trainingProfile?.maxLoadNotes || current.maxLoadNotes,
          nextCompetitionDate:
            detail.trainingProfile?.nextCompetitionDate?.slice(0, 10) ||
            current.nextCompetitionDate,
          coachProfileNotes: detail.trainingProfile?.coachNotes || current.coachProfileNotes,
        }));
      } catch {
        if (!cancelled) setSelectedAthleteDetail(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedAthleteId, accessToken]);

  const activePlanCount = useMemo(
    () => plans.filter((plan) => plan.status === "ACTIVE").length,
    [plans],
  );

  const handleGenerate = async () => {
    if (!selectedAthleteId) {
      toast.error("Selecione um atleta para gerar a planilha.");
      return;
    }
    if (!form.planName.trim() || !form.cycleGoal.trim()) {
      toast.error("Preencha nome do plano e objetivo do ciclo.");
      return;
    }

    setSaving(true);
    try {
      await updateAthleteTrainingProfile(
        selectedAthleteId,
        {
          primaryModality: form.primaryModality || null,
          sportLevel: (form.sportLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ELITE") || null,
          sportGoal: form.sportGoal || null,
          injuryHistory: form.injuryHistory || null,
          weeklyAvailability: form.weeklyAvailability
            ? { summary: form.weeklyAvailability }
            : null,
          medicalRestrictions: form.medicalRestrictions || null,
          availableEquipment: parseEquipment(form.availableEquipment),
          restingHeartRate: parseOptionalNumber(form.restingHeartRate),
          thresholdPace: form.thresholdPace || null,
          maxLoadNotes: form.maxLoadNotes || null,
          nextCompetitionDate: toIsoFromDate(form.nextCompetitionDate),
          coachNotes: form.coachProfileNotes || null,
        },
        accessToken,
      );

      const created = await generateTrainingPlanWithAI(
        {
          athleteId: selectedAthleteId,
          planName: form.planName,
          cycleGoal: form.cycleGoal,
          objective: form.objective || null,
          focusModality: form.focusModality || null,
          startDate: form.startDate,
          weeks: Number(form.weeks),
          sessionsPerWeek: Number(form.sessionsPerWeek),
          coachNotes: form.coachNotes || null,
        },
        accessToken,
      );

      toast.success(`Rascunho gerado para ${created.athleteName}.`);
      await load();
    } catch (generateError) {
      toast.error(generateError instanceof Error ? generateError.message : "Falha ao gerar planilha.");
    } finally {
      setSaving(false);
    }
  };

  const activatePlan = async (planId: string) => {
    try {
      await updateTrainingPlan(planId, { status: "ACTIVE" }, accessToken);
      toast.success("Planilha aprovada e enviada ao atleta.");
      await load();
    } catch (activateError) {
      toast.error(activateError instanceof Error ? activateError.message : "Falha ao publicar planilha.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treinos com IA"
        subtitle="Planilhas, feedbacks, alertas de carga e biblioteca tecnica no mesmo fluxo."
      />

      {loading ? (
        <LoadingState lines={5} />
      ) : error ? (
        <EmptyState title="Modulo indisponivel" description={error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <MetricCard label="Atletas ativos" value={dashboard.metrics.activeAthletes} />
            <MetricCard label="Planilhas ativas" value={activePlanCount} tone="highlight" />
            <MetricCard label="Treinos pendentes" value={dashboard.metrics.pendingSessions} />
            <MetricCard label="Treinos concluidos" value={dashboard.metrics.completedSessions} />
            <MetricCard label="Risco de sobrecarga" value={dashboard.metrics.overloadRiskAthletes} />
            <MetricCard label="Sugestoes IA" value={dashboard.metrics.pendingRecommendations} />
            <MetricCard label="Carga semana" value={dashboard.metrics.currentWeekLoad} />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <SectionCard
              title="Gerar planilha"
              description="A sugestao nasce em rascunho e so chega ao atleta depois da aprovacao."
            >
              <div className="space-y-5">
                <FormSection icon={UserRound} title="Atleta e ciclo">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <FormField label="Atleta">
                      <Select
                        value={selectedAthleteId}
                        onChange={(event) => setSelectedAthleteId(event.target.value)}
                      >
                        <option value="">Selecione</option>
                        {athletes.map((athlete) => (
                          <option key={athlete.id} value={athlete.id}>
                            {athlete.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Nome do plano">
                      <Input
                        value={form.planName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, planName: event.target.value }))
                        }
                      />
                    </FormField>
                    <FormField label="Objetivo do ciclo">
                      <Input
                        value={form.cycleGoal}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, cycleGoal: event.target.value }))
                        }
                      />
                    </FormField>
                    <FormField label="Meta principal">
                      <Input
                        value={form.objective}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, objective: event.target.value }))
                        }
                      />
                    </FormField>
                    <FormField label="Inicio do ciclo">
                      <Input
                        type="datetime-local"
                        value={form.startDate.slice(0, 16)}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            startDate: toIsoFromDateTime(event.target.value),
                          }))
                        }
                      />
                    </FormField>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="Semanas">
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          value={form.weeks}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, weeks: event.target.value }))
                          }
                        />
                      </FormField>
                      <FormField label="Sessoes/semana">
                        <Input
                          type="number"
                          min={2}
                          max={6}
                          value={form.sessionsPerWeek}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              sessionsPerWeek: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                </FormSection>

                <FormSection icon={ClipboardList} title="Perfil esportivo">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <FormField label="Modalidade">
                      <Input
                        value={form.primaryModality}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            primaryModality: event.target.value,
                            focusModality: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Nivel">
                      <Select
                        value={form.sportLevel}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, sportLevel: event.target.value }))
                        }
                      >
                        <option value="BEGINNER">Iniciante</option>
                        <option value="INTERMEDIATE">Intermediario</option>
                        <option value="ADVANCED">Avancado</option>
                        <option value="ELITE">Elite</option>
                      </Select>
                    </FormField>
                    <FormField label="Proxima prova">
                      <Input
                        type="date"
                        value={form.nextCompetitionDate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            nextCompetitionDate: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Disponibilidade" className="lg:col-span-2">
                      <Input
                        value={form.weeklyAvailability}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            weeklyAvailability: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="FC repouso">
                      <Input
                        type="number"
                        min={0}
                        max={260}
                        value={form.restingHeartRate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            restingHeartRate: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Pace ou zona">
                      <Input
                        value={form.thresholdPace}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            thresholdPace: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Cargas maximas" className="lg:col-span-2">
                      <Input
                        value={form.maxLoadNotes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            maxLoadNotes: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Equipamentos" className="lg:col-span-3">
                      <Input
                        value={form.availableEquipment}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            availableEquipment: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection icon={AlertTriangle} title="Seguranca e contexto">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <FormField label="Objetivo esportivo">
                      <Textarea
                        value={form.sportGoal}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, sportGoal: event.target.value }))
                        }
                        className="min-h-[112px]"
                      />
                    </FormField>
                    <FormField label="Historico de lesoes">
                      <Textarea
                        value={form.injuryHistory}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            injuryHistory: event.target.value,
                          }))
                        }
                        className="min-h-[112px]"
                      />
                    </FormField>
                    <FormField label="Restricoes medicas">
                      <Textarea
                        value={form.medicalRestrictions}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            medicalRestrictions: event.target.value,
                          }))
                        }
                        className="min-h-[112px]"
                      />
                    </FormField>
                    <FormField label="Notas tecnicas do perfil">
                      <Textarea
                        value={form.coachProfileNotes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            coachProfileNotes: event.target.value,
                          }))
                        }
                        className="min-h-[112px]"
                      />
                    </FormField>
                    <FormField label="Orientacoes para IA" className="lg:col-span-2">
                      <Textarea
                        value={form.coachNotes}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, coachNotes: event.target.value }))
                        }
                        className="min-h-[112px]"
                      />
                    </FormField>
                  </div>

                  {selectedAthleteDetail?.trainingProfile ? (
                    <p className="mt-3 text-xs text-white/50">
                      Perfil atual:{" "}
                      {selectedAthleteDetail.trainingProfile.primaryModality ?? "modalidade nao definida"}{" "}
                      | {selectedAthleteDetail.trainingProfile.sportGoal ?? "objetivo nao definido"}
                    </p>
                  ) : null}
                </FormSection>

                <div className="flex justify-end border-t border-white/10 pt-5">
                  <ActionButton
                    disabled={saving}
                    onClick={() => void handleGenerate()}
                    className="w-full sm:w-auto"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {saving ? "Gerando rascunho..." : "Gerar rascunho com IA"}
                  </ActionButton>
                </div>
              </div>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Controle de carga" description="Resumo semanal baseado em minutos x RPE.">
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                          Semana atual
                        </p>
                        <p className="mt-2 text-3xl font-bold text-white">
                          {dashboard.loadControl.currentWeek.totalLoad}
                        </p>
                      </div>
                      <StatusBadge
                        tone={loadAlertTone(dashboard.loadControl.currentWeek.alertLevel)}
                        label={loadAlertLabel(dashboard.loadControl.currentWeek.alertLevel)}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <span>Sessoes: {dashboard.loadControl.currentWeek.sessionsDone}</span>
                      <span>Variacao: {formatLoadChange(dashboard.loadControl.currentWeek.loadChangePercent)}</span>
                      <span>RPE medio: {dashboard.loadControl.currentWeek.averageEffort ?? "-"}</span>
                      <span>Dor media: {dashboard.loadControl.currentWeek.averagePain ?? "-"}</span>
                    </div>
                    {dashboard.loadControl.currentWeek.alertReason ? (
                      <p className="mt-3 text-xs text-amber-100">
                        {dashboard.loadControl.currentWeek.alertReason}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {dashboard.loadControl.recentWeeks.slice(-4).map((week) => (
                      <div
                        key={week.weekStart}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{week.label}</p>
                          <p className="text-xs text-slate-400">
                            {week.sessionsDone}/{week.sessionsPlanned} sessoes
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">{week.totalLoad}</p>
                          <p className="text-xs text-slate-400">{formatLoadChange(week.loadChangePercent)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Fila tecnica" description="Dor, fadiga, pendencias e baixa adesao.">
                {dashboard.priorityAthletes.length === 0 ? (
                  <EmptyState
                    title="Sem alertas prioritarios"
                    description="Os sinais de fadiga e pendencias aparecerao aqui."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {dashboard.priorityAthletes.map((athlete) => (
                      <div
                        key={athlete.athleteId}
                        className="min-w-0 rounded-xl border border-white/10 bg-[#0f233d] px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {athlete.athleteName}
                            </p>
                            <p className="truncate text-xs text-slate-300">
                              {athlete.athleteEmail}
                            </p>
                          </div>
                          <StatusBadge
                            tone={
                              athlete.recentPainAlerts > 0
                                ? "danger"
                                : athlete.pendingSessions > 1
                                  ? "warning"
                                  : "neutral"
                            }
                            label={athlete.recentPainAlerts > 0 ? "Dor" : "Monitorar"}
                          />
                        </div>
                        <p className="mt-2 text-xs text-white/60">
                          Pendentes: {athlete.pendingSessions} | Dor: {athlete.recentPainAlerts} |
                          RPE medio: {athlete.averageEffort ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-white/60">
                          Carga: {athlete.currentWeekLoad} | Semana ant.: {athlete.previousWeekLoad} |
                          Variacao: {formatLoadChange(athlete.loadChangePercent)}
                        </p>
                        {athlete.loadAlertReason ? (
                          <p className="mt-1 text-xs text-amber-100">{athlete.loadAlertReason}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Biblioteca" description="Base ativa de exercicios e estimulos.">
                {exercises.length === 0 ? (
                  <EmptyState
                    title="Biblioteca vazia"
                    description="Cadastre exercicios para acelerar a montagem manual dos ciclos."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {exercises.slice(0, 6).map((exercise) => (
                      <div
                        key={exercise.id}
                        className="rounded-xl border border-white/10 bg-[#0f233d] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {exercise.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {exercise.modality} | {exercise.stimulusType ?? "Estimulo livre"}
                            </p>
                          </div>
                          {exercise.intensityLabel ? (
                            <StatusBadge tone="info" label={exercise.intensityLabel} />
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                          {exercise.instructions ?? "Sem instrucao registrada."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>

          <SectionCard
            title="Planilhas do coach"
            description="Rascunhos gerados, ciclos ativos e historico recente."
          >
            {plans.length === 0 ? (
              <EmptyState
                title="Sem planilhas ainda"
                description="Gere o primeiro rascunho com IA ou comece criando a estrutura do ciclo."
              />
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-base font-semibold text-white">{plan.name}</p>
                          <StatusBadge tone={statusTone(plan.status)} label={statusLabel(plan.status)} />
                          {plan.aiGenerated ? <StatusBadge tone="info" label="IA" /> : null}
                        </div>
                        <p className="mt-1 text-sm text-white/70">
                          {plan.athleteName} | {plan.cycleGoal}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {formatDate(plan.startDate)} a {formatDate(plan.endDate)} |{" "}
                          {plan.weeks.length} semana(s)
                        </p>
                      </div>
                      {plan.status === "DRAFT" ? (
                        <ActionButton
                          size="sm"
                          onClick={() => void activatePlan(plan.id)}
                          className="w-full sm:w-auto"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Aprovar e enviar
                        </ActionButton>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {plan.weeks.slice(0, 4).map((week) => (
                        <div key={week.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                            Semana {week.weekNumber}
                          </p>
                          <p className="mt-1 text-sm text-white">{week.focus ?? "Progressao"}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {week.days.filter((day) => !day.isRestDay).length} sessoes planejadas
                          </p>
                        </div>
                      ))}
                    </div>

                    {plan.recommendations[0] ? (
                      <div className="mt-3 rounded-lg border border-[#1E90FF]/20 bg-[#1E90FF]/10 p-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-[#9fd1ff]" />
                          <p className="text-xs uppercase tracking-wide text-[#9fd1ff]">
                            Ultima recomendacao IA
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-white">{plan.recommendations[0].summary}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
