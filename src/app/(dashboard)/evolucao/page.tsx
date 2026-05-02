"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Copy,
  Crown,
  Download,
  Flag,
  Medal,
  Minus,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { AchievementGrid } from "@/components/gamification/AchievementGrid";
import { LevelProgressCard } from "@/components/gamification/LevelProgressCard";
import { XpBreakdownCard } from "@/components/gamification/XpBreakdownCard";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { downloadTextCardAsPng } from "@/lib/share-card";
import { getDashboardData } from "@/services/dashboard-service";
import { DashboardData, type DashboardRankingPeriod } from "@/services/types";

const RANKING_PERIOD_OPTIONS: Array<{ value: DashboardRankingPeriod; label: string }> = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "year", label: "Ano" },
];

const RANKING_PERIOD_LABEL: Record<DashboardRankingPeriod, string> = {
  "30d": "ultimos 30 dias",
  "90d": "ultimos 90 dias",
  year: "ano atual",
};

const HIGHLIGHT_ICON = {
  completed: Trophy,
  distance: Activity,
  consistency: Target,
  podium: Medal,
  best5k: Flag,
  best21k: Award,
  best42k: ShieldCheck,
};

const METRIC_TREND_STYLE = {
  up: {
    icon: ArrowUpRight,
    className: "text-emerald-300",
  },
  down: {
    icon: ArrowDownRight,
    className: "text-red-300",
  },
  stable: {
    icon: Minus,
    className: "text-slate-300",
  },
} as const;

export default function EvolucaoPage() {
  const { accessToken, userRole } = useAuthToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [rankingPeriod, setRankingPeriod] = useState<DashboardRankingPeriod>("90d");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getDashboardData({ accessToken, userRole, rankingPeriod });
        if (!cancelled) setData(result.data);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar evolução.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userRole, rankingPeriod, reloadKey]);

  const experience = data?.experience;
  const gamification = experience?.gamification;
  const warnings = data?.dataWarnings ?? [];
  const highlights = useMemo(() => experience?.highlights ?? [], [experience]);
  const hasExperienceContent = Boolean(
    experience &&
    (gamification ||
      experience.highlights.length > 0 ||
      experience.sportsMetrics.length > 0 ||
      experience.evolutionSeries.length > 0 ||
      experience.distanceDistribution.length > 0 ||
      experience.personalRecords.length > 0 ||
      (data?.metrics.kmNoAno ?? 0) > 0),
  );

  function buildEvolutionShareLines() {
    if (!experience) return [];
    return [
      ...highlights.slice(0, 4).map((item) => `${item.label}: ${item.value}`),
      experience.groupRanking
        ? `Ranking: #${experience.groupRanking.user.position} (${experience.groupRanking.user.points} pts)`
        : null,
    ].filter((item): item is string => Boolean(item));
  }

  async function copyEvolutionCard() {
    const lines = buildEvolutionShareLines();
    if (!lines.length) return;
    const text = ["Meu resumo de evolucao", ...lines, "Ventu Suli"].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumo de evolucao copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o resumo.");
    }
  }

  function downloadEvolutionCard() {
    const lines = buildEvolutionShareLines();
    if (!lines.length) return;
    downloadTextCardAsPng({
      title: "Meu corre em numeros",
      subtitle: experience?.groupRanking
        ? `Ranking #${experience.groupRanking.user.position} no grupo`
        : "Resumo esportivo Ventu Suli",
      lines,
      filename: "ventu-suli-evolucao.png",
    });
    toast.success("Card PNG gerado.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evolucao e Ranking"
        subtitle="Indicadores esportivos, recordes pessoais e posicionamento no grupo."
      />

      <div className="flex flex-wrap gap-2" aria-label="Filtro de periodo do ranking">
        {RANKING_PERIOD_OPTIONS.map((option) => {
          const active = rankingPeriod === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setRankingPeriod(option.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-[#F5A623]/60 bg-[#F5A623]/12 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:border-sky-300/40 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingState lines={6} />
      ) : error ? (
        <EmptyState
          title="Evolução indisponível"
          description={error}
          action={
            <ActionButton size="sm" onClick={() => setReloadKey((prev) => prev + 1)}>
              Tentar novamente
            </ActionButton>
          }
        />
      ) : !experience || !hasExperienceContent ? (
        <EmptyState
          title="Sem dados de evolucao disponiveis"
          description={
            warnings[0] ??
            "Conecte o Strava e sincronize atividades para gerar metricas reais de evolucao."
          }
          action={
            <ActionButton asChild size="sm">
              <Link href="/configuracoes/conta">Conectar integracoes</Link>
            </ActionButton>
          }
        />
      ) : (
        <>
          {warnings.length ? (
            <SectionCard
              title="Avisos de dados"
              description="Situacoes detectadas na consolidacao das metricas"
            >
              <div className="space-y-2">
                {warnings.map((warning, index) => (
                  <div
                    key={`${warning}-${index}`}
                    className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {gamification ? (
            <>
              <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]">
                <LevelProgressCard gamification={gamification} />
                <XpBreakdownCard totalXp={gamification.totalXp} items={gamification.breakdown} />
              </div>

              <AchievementGrid achievements={gamification.achievements} />
            </>
          ) : null}

          <SectionCard title="Destaques da temporada" description="Resumo de evolucao consolidada">
            {highlights.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {highlights.map((item) => {
                  const Icon = HIGHLIGHT_ICON[item.id];
                  return (
                    <div
                      key={item.id}
                      className="min-h-[120px] rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3"
                    >
                      <div className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#38bdf8]" />
                        <p className="text-[1.8rem] font-bold leading-none text-white">
                          {item.value}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[#8eb0dc]">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Sem destaques ainda"
                description="Sincronize atividades para gerar destaques da temporada."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Card compartilhavel"
            description="Resumo curto para postar no grupo, WhatsApp ou Instagram"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="rounded-xl border border-[#F5A623]/25 bg-[linear-gradient(135deg,#17385e,#0f233d)] p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-amber-200">
                  Meu corre em numeros
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {highlights.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                    >
                      <p className="text-xs text-white/45">{item.label}</p>
                      <p className="mt-1 text-2xl font-bold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                {experience.groupRanking ? (
                  <p className="mt-4 text-sm font-semibold text-sky-100">
                    Ranking do grupo: #{experience.groupRanking.user.position} com{" "}
                    {experience.groupRanking.user.points} pts
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col justify-center gap-2 lg:w-56">
                <ActionButton className="w-full" onClick={downloadEvolutionCard}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PNG
                </ActionButton>
                <ActionButton
                  className="w-full"
                  intent="secondary"
                  onClick={() => void copyEvolutionCard()}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar texto
                </ActionButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Metricas esportivas" description="Leitura de tendencia por ciclo">
            {(experience.sportsMetrics ?? []).length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(experience.sportsMetrics ?? []).map((metric) => {
                  const trend = METRIC_TREND_STYLE[metric.trend];
                  const TrendIcon = trend.icon;
                  return (
                    <div
                      key={metric.id}
                      className="rounded-xl border border-[#24486f] bg-[#0f233d] p-3"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-[#8eb0dc]">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">{metric.value}</p>
                      <p
                        className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${trend.className}`}
                      >
                        <TrendIcon className="h-3.5 w-3.5" />
                        {metric.delta}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Metricas indisponiveis"
                description="Ainda nao ha dados consolidados para este periodo."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Grafico de evolucao"
            description="Comparativo mensal da temporada atual"
          >
            <div className="grid gap-3 xl:grid-cols-[1.45fr_0.55fr]">
              <div className="h-64 rounded-xl border border-[#24486f] bg-[#0f233d] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={experience.evolutionSeries ?? []}>
                    <XAxis dataKey="month" stroke="#7fa0c8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#7fa0c8" tickLine={false} axisLine={false} width={30} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="current"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: "#38bdf8" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="previous"
                      stroke="#F5A623"
                      strokeWidth={2.5}
                      dot={{ r: 2.5, fill: "#F5A623" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <div className="h-32 rounded-xl border border-[#24486f] bg-[#0f233d] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={experience.distanceDistribution ?? []}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={32}
                        outerRadius={48}
                      >
                        {(experience.distanceDistribution ?? []).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-3">
                  <p className="mb-2 text-sm font-semibold text-white">Conquistas</p>
                  {(experience.achievements ?? []).length ? (
                    <div className="grid grid-cols-1 gap-2 text-center text-[11px]">
                      {(experience.achievements ?? []).map((achievement) => (
                        <StatusBadge
                          key={achievement.id}
                          label={achievement.label}
                          tone={
                            achievement.tone === "warning"
                              ? "warning"
                              : achievement.tone === "success"
                                ? "positive"
                                : "info"
                          }
                          className="justify-center rounded-lg px-2 py-2"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#8eb0dc]">Conquistas ainda nao liberadas.</p>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-3 xl:grid-cols-2">
            <SectionCard title="Recordes pessoais" description="Melhores marcas do atleta">
              {(experience.personalRecords ?? []).length ? (
                <div className="space-y-2">
                  {(experience.personalRecords ?? []).map((record) => (
                    <div
                      key={record.id}
                      className="rounded-lg border border-[#1f4064] bg-[#0b1d34] px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{record.label}</p>
                        <p className="text-lg font-bold text-[#38bdf8]">{record.value}</p>
                      </div>
                      <p className="text-xs text-[#9bb8dd]">{record.event}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sem recordes ainda"
                  description="As melhores marcas aparecerao apos a sincronizacao de corridas."
                />
              )}
            </SectionCard>

            <SectionCard
              title="Ranking do grupo"
              description={`Periodo: ${RANKING_PERIOD_LABEL[rankingPeriod]}`}
            >
              {experience.groupRanking ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#2e6399] bg-[#12355d] px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-[#a8cdf8]">Sua posicao</p>
                    <div className="mt-1 flex items-end justify-between">
                      <p className="inline-flex items-center gap-2 text-2xl font-bold text-white">
                        <Crown className="h-5 w-5 text-amber-300" /> #
                        {experience.groupRanking.user.position}
                      </p>
                      <p className="text-sm font-semibold text-[#bfe0ff]">
                        {experience.groupRanking.user.points} pts
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {experience.groupRanking.leaderboard.map((athlete) => {
                      const isCurrentAthlete = athlete.name === experience.groupRanking.user.name;
                      return (
                        <div
                          key={athlete.id}
                          className={`flex items-center justify-between rounded-lg border px-2.5 py-2 ${isCurrentAthlete ? "border-[#58a6ff] bg-[#14335a]" : "border-[#1f4064] bg-[#0b1d34]"}`}
                        >
                          <p className="inline-flex items-center gap-2 text-sm text-white">
                            <span className="w-6 text-[#9bb8dd]">#{athlete.position}</span>
                            {athlete.name}
                            {athlete.position <= 3 ? (
                              <Star className="h-3.5 w-3.5 text-amber-300" />
                            ) : null}
                          </p>
                          <p className="text-sm font-semibold text-[#d7eaff]">
                            {athlete.points} pts
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Ranking indisponivel"
                  description="Sem dados de ranking no momento."
                />
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
