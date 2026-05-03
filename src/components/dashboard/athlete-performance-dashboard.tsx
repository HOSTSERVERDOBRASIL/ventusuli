"use client";

import Link from "next/link";
import Image from "next/image";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  Award,
  CalendarDays,
  Flame,
  Flag,
  Heart,
  Medal,
  MessageCircle,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusBadge } from "@/components/system/status-badge";
import type { CommunityFeedData, DashboardData, RegistrationStatus } from "@/services/types";

export interface ManualActivityFormState {
  distanceKm: string;
  durationMinutes: string;
  activityDate: string;
  elevationGainM: string;
  note: string;
}

interface AthletePerformanceDashboardProps {
  data: DashboardData;
  warnings: string[];
  communityFeed: CommunityFeedData | null;
  communityError: string | null;
  manualActivity: ManualActivityFormState;
  setManualActivity: Dispatch<SetStateAction<ManualActivityFormState>>;
  onManualActivitySubmit: (event: FormEvent<HTMLFormElement>) => void;
  manualSubmitting: boolean;
  isPremiumAthlete: boolean;
}

const CARD_CLASS =
  "overflow-hidden rounded-lg border border-[#1f3654] bg-[#07192b]/94 text-white shadow-[0_18px_40px_rgba(0,0,0,0.2)]";

const TREND_CLASS = {
  up: "text-emerald-300",
  down: "text-red-300",
  stable: "text-slate-400",
};

function registrationLabel(status: RegistrationStatus): string {
  if (status === "CONFIRMED") return "Inscrito";
  if (status === "PENDING_PAYMENT") return "Pagamento";
  if (status === "CANCELLED") return "Cancelado";
  return "Inscrever-se";
}

function registrationTone(status: RegistrationStatus): "positive" | "warning" | "info" | "danger" {
  if (status === "CONFIRMED") return "positive";
  if (status === "PENDING_PAYMENT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "info";
}

function formatKm(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  })} km`;
}

function formatMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) return `${minutes}min`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function getMetric(data: DashboardData, id: string) {
  return data.experience?.sportsMetrics.find((metric) => metric.id === id) ?? null;
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${CARD_CLASS} ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  delta,
  trend,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "stable";
  icon: React.ElementType;
  tone: "blue" | "amber" | "cyan" | "green";
}) {
  const toneClass = {
    blue: "bg-sky-500/15 text-sky-300",
    amber: "bg-amber-400/15 text-amber-300",
    cyan: "bg-cyan-400/15 text-cyan-300",
    green: "bg-emerald-400/15 text-emerald-300",
  }[tone];

  return (
    <div className="min-w-0 rounded-lg border border-[#1f3654] bg-[#07192b]/94 p-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${toneClass}`}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-300">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold leading-none text-white">{value}</p>
          {delta ? (
            <p className={`mt-1 text-xs font-semibold ${TREND_CLASS[trend ?? "stable"]}`}>
              {trend === "up" ? "+" : trend === "down" ? "" : ""}
              {delta} vs periodo anterior
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AthletePerformanceDashboard({
  data,
  warnings,
  communityFeed,
  communityError,
  manualActivity,
  setManualActivity,
  onManualActivitySubmit,
  manualSubmitting,
  isPremiumAthlete,
}: AthletePerformanceDashboardProps) {
  const experience = data.experience;
  const trainingMetric = getMetric(data, "training-30d");
  const volumeMetric = getMetric(data, "volume-30d");
  const paceMetric = getMetric(data, "pace-30d");
  const durationMetric = getMetric(data, "duration-30d");
  const ranking = experience?.groupRanking.user;
  const rankingValue = ranking?.position ? `${ranking.position}º` : "—";
  const heroImage = data.proximasProvas.find((event) => event.image_url)?.image_url ?? null;
  const recentActivities = experience?.recentActivities ?? [];
  const evolutionSeries = experience?.evolutionSeries ?? [];
  const currentMonth =
    [...evolutionSeries].reverse().find((item) => item.current > 0 || (item.sessions ?? 0) > 0) ??
    evolutionSeries[evolutionSeries.length - 1];
  const communityPosts = communityFeed?.posts.slice(0, 2) ?? [];

  return (
    <div className="min-h-screen bg-[#04111f] p-3 text-white sm:p-4 lg:p-5">
      <div className="mx-auto max-w-[1440px] space-y-3">
        <section className={`${CARD_CLASS} relative min-h-[228px]`}>
          {heroImage ? (
            <Image
              src={heroImage}
              alt=""
              fill
              sizes="100vw"
              unoptimized
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,144,255,0.4),transparent_28%),linear-gradient(135deg,#102e57,#07192b_45%,#120f2a)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#04111f]/95 via-[#04111f]/35 to-[#04111f]/25" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#04111f]/95 to-transparent" />

          <div className="relative z-[1] flex min-h-[228px] flex-col justify-between gap-6 p-5 sm:p-6">
            <div className="flex justify-end">
              <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-3 py-2 backdrop-blur">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#123a63] text-xs font-bold text-white">
                  {ranking?.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("") || "AT"}
                  <span className="absolute -right-1 -top-1 rounded-full bg-amber-300 px-1 text-[10px] font-bold text-[#07111f]">
                    {ranking?.points ?? 0}
                  </span>
                </span>
                <div>
                  <p className="text-sm font-semibold">{ranking?.name ?? "Atleta"}</p>
                  <p className="text-xs text-slate-300">
                    {isPremiumAthlete ? "Atleta Premium" : "Atleta Free"}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-w-2xl">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {experience?.greeting.headline ?? "Bem-vindo(a), atleta!"}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">
                {experience?.greeting.subtitle ??
                  "Cada treino e cada prova entram na mesma leitura de desempenho."}
              </p>
            </div>
          </div>
        </section>

        {warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-300/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {warnings[0]}
          </div>
        ) : null}

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label={trainingMetric?.label ?? "Treinos 30 dias"}
            value={trainingMetric?.value ?? "0"}
            delta={trainingMetric?.delta}
            trend={trainingMetric?.trend}
            icon={Activity}
            tone="blue"
          />
          <MetricTile
            label={volumeMetric?.label ?? "Quilômetros"}
            value={
              volumeMetric?.value ?? (data.metrics.kmNoAno ? formatKm(data.metrics.kmNoAno) : "—")
            }
            delta={volumeMetric?.delta}
            trend={volumeMetric?.trend}
            icon={Flame}
            tone="amber"
          />
          <MetricTile
            label={paceMetric?.label ?? "Pace médio"}
            value={paceMetric?.value ?? "—"}
            delta={paceMetric?.delta}
            trend={paceMetric?.trend}
            icon={Timer}
            tone="cyan"
          />
          <MetricTile
            label="Colocação no ranking"
            value={rankingValue}
            delta={ranking?.change ? `${ranking.change} posições` : undefined}
            trend={ranking?.change && ranking.change > 0 ? "up" : "stable"}
            icon={Trophy}
            tone="green"
          />
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_1.05fr]">
          <Panel
            title="Próximas provas"
            action={
              <Link
                href="/provas"
                className="text-xs font-semibold text-sky-300 hover:text-sky-200"
              >
                Ver todas
              </Link>
            }
          >
            <div className="divide-y divide-white/10 px-4">
              {data.proximasProvas.slice(0, 3).map((event, index) => {
                const status = event.minhaInscricao?.status ?? "INTERESTED";
                const distanceLabel = event.distances.map((distance) => distance.label).join(" · ");
                return (
                  <Link
                    href={`/provas/${event.id}`}
                    key={event.id}
                    className="grid grid-cols-[104px_1fr_auto] items-center gap-4 py-3 transition hover:bg-white/[0.02]"
                  >
                    <div className="relative h-[68px] overflow-hidden rounded-md border border-white/10 bg-[#0d2a49]">
                      {event.image_url ? (
                        <Image
                          src={event.image_url}
                          alt={`Imagem da prova ${event.name}`}
                          fill
                          sizes="(min-width: 1024px) 280px, 100vw"
                          unoptimized
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-end bg-gradient-to-br from-sky-700 to-[#07192b] p-2">
                          <span className="text-[10px] font-bold uppercase leading-tight text-white">
                            Prova {index + 1}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{event.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <Flag className="h-3.5 w-3.5" />
                          {distanceLabel || "Distância a definir"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <StatusBadge
                      label={registrationLabel(status)}
                      tone={registrationTone(status)}
                      className="hidden sm:inline-flex"
                    />
                  </Link>
                );
              })}
              {data.proximasProvas.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Nenhuma prova publicada no momento.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Atividades recentes"
            action={
              <Link
                href="/evolucao"
                className="text-xs font-semibold text-sky-300 hover:text-sky-200"
              >
                Ver todas
              </Link>
            }
          >
            <div className="divide-y divide-white/10 px-4">
              {recentActivities.slice(0, 4).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
                      <Activity className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{activity.name}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        {formatKm(activity.distanceKm)} · {activity.pace ?? "pace indisponível"} ·{" "}
                        {formatMinutes(activity.durationMinutes)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDistanceToNowStrict(new Date(activity.activityDate), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              ))}
              {recentActivities.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Lance um treino manual ou conecte o Strava para preencher esta lista.
                </p>
              ) : null}
            </div>
          </Panel>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.15fr_0.9fr_0.95fr]">
          <Panel
            title="Desempenho mensal"
            action={
              <Link
                href="/evolucao"
                className="text-xs font-semibold text-sky-300 hover:text-sky-200"
              >
                Ver detalhes
              </Link>
            }
          >
            <div className="grid gap-4 p-4 lg:grid-cols-[1fr_180px]">
              <div className="h-[238px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={evolutionSeries}
                    margin={{ left: -18, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(226,232,240,0.7)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(226,232,240,0.55)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#07192b",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        color: "#fff",
                      }}
                      formatter={(value, name) => [
                        `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`,
                        name === "current" ? "Atual" : "Comparativo",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="current"
                      stroke="#18a7ff"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#18a7ff" }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="previous"
                      stroke="#f5c542"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#f5c542" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2">
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-slate-400">Distância do mês</p>
                  <p className="mt-1 text-xl font-bold">{formatKm(currentMonth?.current ?? 0)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Comparativo: {formatKm(currentMonth?.previous ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-slate-400">Tempo em treino</p>
                  <p className="mt-1 text-xl font-bold">
                    {durationMetric?.value ?? formatMinutes(currentMonth?.durationMinutes ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Mês anterior: {formatMinutes(currentMonth?.previousDurationMinutes ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs text-slate-400">Treinos no mês</p>
                  <p className="mt-1 text-xl font-bold">{currentMonth?.sessions ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Comparativo: {currentMonth?.previousSessions ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Ranking do grupo"
            action={
              <Link
                href="/recompensas"
                className="text-xs font-semibold text-sky-300 hover:text-sky-200"
              >
                Ver ranking
              </Link>
            }
          >
            <div className="space-y-2 p-4">
              {(experience?.groupRanking.leaderboard ?? []).slice(0, 4).map((entry) => {
                const isCurrentUser = entry.position === ranking?.position;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      isCurrentUser
                        ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                        {entry.position}
                      </span>
                      <p className="truncate text-sm font-semibold">
                        {isCurrentUser ? "Você" : entry.name}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      {entry.points.toLocaleString("pt-BR")} pts
                    </p>
                  </div>
                );
              })}
              {ranking &&
              !experience?.groupRanking.leaderboard.some(
                (entry) => entry.position === ranking.position,
              ) ? (
                <div className="flex items-center justify-between rounded-md border border-amber-300/60 bg-amber-300/15 px-3 py-2 text-amber-100">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-300/20 text-xs font-bold">
                      {ranking.position}
                    </span>
                    <p className="truncate text-sm font-semibold">Você</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {ranking.points.toLocaleString("pt-BR")} pts
                  </p>
                </div>
              ) : null}
              {!experience?.groupRanking.leaderboard.length ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  O ranking aparece quando houver atividades sincronizadas.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Mural do grupo"
            action={
              <Link
                href="/comunidade"
                className="text-xs font-semibold text-sky-300 hover:text-sky-200"
              >
                Ver tudo
              </Link>
            }
          >
            <div className="divide-y divide-white/10 px-4">
              {communityPosts.map((post) => (
                <article key={post.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-200">
                      {post.avatarInitials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{post.author}</p>
                        <span className="shrink-0 text-xs text-slate-400">{post.timeAgo}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-300">
                        {post.content}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 text-red-300">
                          <Heart className="h-3.5 w-3.5" />
                          {post.reactions.length}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {post.comments.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {communityPosts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  {communityError ?? communityFeed?.message ?? "Sem publicações recentes."}
                </p>
              ) : null}
            </div>
          </Panel>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel title="Registrar treino sem aplicativo">
            <form onSubmit={onManualActivitySubmit} className="grid gap-3 p-4 md:grid-cols-5">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Distância (km)</span>
                <input
                  type="number"
                  min="0.1"
                  max="120"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={manualActivity.distanceKm}
                  onChange={(event) =>
                    setManualActivity((current) => ({ ...current, distanceKm: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-sky-400"
                  placeholder="5.00"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Tempo (min)</span>
                <input
                  type="number"
                  min="1"
                  max="720"
                  step="1"
                  inputMode="numeric"
                  required
                  value={manualActivity.durationMinutes}
                  onChange={(event) =>
                    setManualActivity((current) => ({
                      ...current,
                      durationMinutes: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-sky-400"
                  placeholder="32"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">Elevação (m)</span>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  inputMode="numeric"
                  value={manualActivity.elevationGainM}
                  onChange={(event) =>
                    setManualActivity((current) => ({
                      ...current,
                      elevationGainM: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-sky-400"
                  placeholder="0"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-slate-300">Data e hora</span>
                <input
                  type="datetime-local"
                  required
                  value={manualActivity.activityDate}
                  onChange={(event) =>
                    setManualActivity((current) => ({
                      ...current,
                      activityDate: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-sky-400"
                />
              </label>
              <label className="space-y-1.5 md:col-span-4">
                <span className="text-xs font-semibold text-slate-300">Observação</span>
                <input
                  type="text"
                  maxLength={500}
                  value={manualActivity.note}
                  onChange={(event) =>
                    setManualActivity((current) => ({ ...current, note: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-sky-400"
                  placeholder="Ex.: treino regenerativo, rodagem, treino de ritmo"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-sky-500 px-4 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
                >
                  {manualSubmitting ? "Salvando..." : "Salvar treino"}
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="Provas e objetivos">
            <div className="grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Medal className="h-4 w-4 text-amber-300" />
                  Provas confirmadas
                </p>
                <p className="mt-1 text-2xl font-bold">{data.metrics.provasConfirmadas}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Award className="h-4 w-4 text-sky-300" />
                  Provas concluídas
                </p>
                <p className="mt-1 text-2xl font-bold">{data.metrics.provasConcluidas}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Zap className="h-4 w-4 text-emerald-300" />
                  Consistência
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {data.metrics.consistencia !== null
                    ? `${Math.round(data.metrics.consistencia)}%`
                    : "—"}
                </p>
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}
