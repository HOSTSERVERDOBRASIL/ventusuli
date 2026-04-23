"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  MapPin,
  Medal,
  Minus,
  ShieldCheck,
  Target,
  Trophy,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { CommunityFeed } from "@/components/community/community-feed";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { StatusBadge } from "@/components/system/status-badge";
import { getCommunityFeed } from "@/services/community-service";
import { getDashboardData } from "@/services/dashboard-service";
import {
  CommunityFeedData,
  DashboardCalendarEntry,
  DashboardCalendarEntryType,
  DashboardData,
  PaymentStatus,
  RegistrationStatus,
} from "@/services/types";

// ─── Formatters ──────────────────────────────────────────────────────────────

const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function registrationLabel(status: RegistrationStatus): string {
  if (status === "CONFIRMED") return "CONFIRMADO";
  if (status === "INTERESTED") return "INTERESSE";
  if (status === "CANCELLED") return "CANCELADO";
  return "PENDENTE";
}

function registrationTone(status: RegistrationStatus): "positive" | "warning" | "info" | "danger" {
  if (status === "CONFIRMED") return "positive";
  if (status === "INTERESTED") return "info";
  if (status === "CANCELLED") return "danger";
  return "warning";
}

function paymentTone(status: PaymentStatus | null): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PAID") return "positive";
  if (status === "PENDING") return "warning";
  if (status === "CANCELLED" || status === "EXPIRED" || status === "REFUNDED") return "danger";
  return "neutral";
}

function paymentLabel(status: PaymentStatus | null): string {
  if (status === "PAID") return "PAGO";
  if (status === "PENDING") return "PENDENTE";
  if (status === "EXPIRED") return "EXPIRADO";
  if (status === "REFUNDED") return "REEMBOLSO";
  if (status === "CANCELLED") return "CANCELADO";
  return "—";
}

function calendarEntryType(entry: DashboardCalendarEntry): DashboardCalendarEntryType {
  return entry.entryType ?? "RACE";
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const CALENDAR_CONFIG: Record<
  DashboardCalendarEntryType,
  { label: string; tone: "positive" | "warning" | "info"; dayClass: string; dotClass: string }
> = {
  RACE: {
    label: "PROVA",
    tone: "positive",
    dayClass: "border border-emerald-400/40 bg-emerald-500/20 text-emerald-100",
    dotClass: "bg-emerald-400",
  },
  DEADLINE: {
    label: "PRAZO",
    tone: "warning",
    dayClass: "border border-[#F4C542]/40 bg-[#F4C542]/15 text-[#F4C542]",
    dotClass: "bg-[#F4C542]",
  },
  COMMITMENT: {
    label: "COMPROMISSO",
    tone: "info",
    dayClass: "border border-[#1E90FF]/40 bg-[#1E90FF]/15 text-[#1E90FF]",
    dotClass: "bg-[#1E90FF]",
  },
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

const METRIC_TREND = {
  up: { icon: ArrowUpRight, className: "text-[#00C853]" },
  down: { icon: ArrowDownRight, className: "text-[#FF4444]" },
  stable: { icon: Minus, className: "text-white/40" },
} as const;

const EVENT_GRADIENT = [
  "from-[#0c2d5c] to-[#1a4b8a]",
  "from-[#1a3d5c] to-[#0d5068]",
  "from-[#2d1a4d] to-[#4a2876]",
  "from-[#1a3d1a] to-[#0d5030]",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/55">
        {title}
      </h2>
      {action}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-white/[0.07] bg-[#112240] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.25)] ${className}`}
    >
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor,
  delta,
  deltaPositive,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  delta?: string;
  deltaPositive?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: `${iconColor}1f` }}
      >
        <Icon className="h-[18px] w-[18px]" style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-[11px] text-white/55">{label}</p>
        <p className="mt-1 text-[2rem] font-extrabold leading-none tracking-tight text-white">
          {value}
        </p>
        {delta ? (
          <p
            className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${deltaPositive ? "text-[#00C853]" : "text-[#FF4444]"}`}
          >
            {deltaPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {delta}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { accessToken, userRole } = useAuthToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [communityFeed, setCommunityFeed] = useState<CommunityFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statsPage, setStatsPage] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const setSelectedCalendarEntryId = useState<string | null>(null)[1];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setDashboardError(null);
      setCommunityError(null);
      try {
        const result = await getDashboardData({ accessToken, userRole });
        if (!cancelled) setData(result.data);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setDashboardError(
            loadError instanceof Error
              ? loadError.message
              : "Falha ao carregar dados do dashboard.",
          );
        }
      }
      try {
        const community = await getCommunityFeed({ accessToken });
        if (!cancelled) setCommunityFeed(community.data);
      } catch (communityLoadError) {
        if (!cancelled) {
          setCommunityFeed(null);
          setCommunityError(
            communityLoadError instanceof Error
              ? communityLoadError.message
              : "Falha ao carregar feed da comunidade.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userRole, reloadKey]);

  const experience = data?.experience;
  const warnings = data?.dataWarnings ?? [];
  const calendarEntries = useMemo(
    () =>
      (data?.calendario ?? [])
        .slice()
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()),
    [data],
  );

  useEffect(() => {
    if (!calendarEntries.length) return;
    const upcoming =
      calendarEntries.find((item) => new Date(item.event_date) >= new Date()) ?? calendarEntries[0];
    setCalendarMonth(startOfMonth(new Date(upcoming.event_date)));
    setSelectedDay(new Date(upcoming.event_date));
    setSelectedCalendarEntryId(upcoming.id);
  }, [calendarEntries]);

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }),
      }),
    [calendarMonth],
  );

  const monthEntries = useMemo(
    () => calendarEntries.filter((item) => isSameMonth(new Date(item.event_date), calendarMonth)),
    [calendarEntries, calendarMonth],
  );

  const selectedDayEntries = useMemo(
    () => calendarEntries.filter((item) => isSameDay(new Date(item.event_date), selectedDay)),
    [calendarEntries, selectedDay],
  );

  const nextEvents = useMemo(
    () => calendarEntries.filter((item) => new Date(item.event_date) >= new Date()).slice(0, 8),
    [calendarEntries],
  );

  const highlights = useMemo(() => experience?.highlights ?? [], [experience]);
  const statsPerPage = 4;
  const totalStatsPages = Math.max(1, Math.ceil(highlights.length / statsPerPage));
  const pagedStats = useMemo(
    () => highlights.slice(statsPage * statsPerPage, (statsPage + 1) * statsPerPage),
    [highlights, statsPage],
  );

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] p-6 space-y-5">
        <LoadingState lines={2} className="rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-white/[0.07] bg-[#112240] animate-pulse"
            />
          ))}
        </div>
        <LoadingState lines={5} className="rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] p-6">
        <EmptyState
          title="Dashboard indisponível"
          description={dashboardError ?? "Não foi possível carregar os dados."}
          action={
            <ActionButton size="sm" onClick={() => setReloadKey((prev) => prev + 1)}>
              Tentar novamente
            </ActionButton>
          }
        />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#0D1B2A] p-5 lg:p-6">
      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* ── Greeting banner ── */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              {experience?.greeting.headline ?? "Bora correr!"}
            </h1>
            <p className="mt-0.5 text-[13px] text-white/55">
              {experience?.greeting.subtitle ?? "Cada prova é uma nova história."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/provas"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1E90FF] px-4 text-[13px] font-semibold text-white transition hover:brightness-110 hover:-translate-y-px"
            >
              <Flag className="h-4 w-4" /> Ver provas
            </Link>
            <Link
              href="/minhas-inscricoes"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-4 text-[13px] font-semibold text-white transition hover:bg-white/5"
            >
              Minhas inscrições
            </Link>
          </div>
        </div>

        {/* ── KPI row ── */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {warnings[0]}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Próximas provas"
            value={data.metrics.provasConfirmadas}
            icon={CalendarDays}
            iconColor="#1E90FF"
          />
          <KpiCard
            label="KM no ano"
            value={data.metrics.kmNoAno !== null ? `${data.metrics.kmNoAno.toFixed(0)} km` : "—"}
            icon={Activity}
            iconColor="#00C853"
          />
          <KpiCard
            label="Provas concluídas"
            value={data.metrics.provasConcluidas}
            icon={Trophy}
            iconColor="#F4C542"
          />
          <KpiCard
            label="Ranking no grupo"
            value={data.metrics.rankingNoGrupo !== null ? `${data.metrics.rankingNoGrupo}°` : "—"}
            icon={Award}
            iconColor="#FF6835"
          />
          <KpiCard
            label="Consistência"
            value={
              data.metrics.consistencia !== null ? `${data.metrics.consistencia.toFixed(0)}%` : "—"
            }
            icon={Zap}
            iconColor="#1E90FF"
          />
        </div>

        {/* ── Main grid ── */}
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
          {/* ── Left column ── */}
          <div className="space-y-6">
            {/* Próximas Provas do Grupo */}
            <div>
              <SectionHeader
                title="Próximas provas do grupo"
                action={
                  <Link
                    href="/provas"
                    className="text-[11px] font-semibold text-[#1E90FF] hover:underline"
                  >
                    Ver todas
                  </Link>
                }
              />
              {data.proximasProvas.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {data.proximasProvas.map((event, idx) => {
                    const regStatus = event.minhaInscricao?.status ?? "INTERESTED";
                    const cta =
                      regStatus === "CONFIRMED"
                        ? "Ver detalhes"
                        : regStatus === "PENDING_PAYMENT"
                          ? "Pagar inscrição"
                          : "Tenho interesse";

                    return (
                      <article
                        key={event.id}
                        className="group overflow-hidden rounded-xl border border-white/[0.07] bg-[#112240] shadow-[0_4px_24px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:border-white/15"
                      >
                        <div
                          className={`h-[96px] bg-gradient-to-br ${EVENT_GRADIENT[idx % EVENT_GRADIENT.length]} relative flex items-end p-3`}
                        >
                          {event.image_url ? (
                            <>
                              <img
                                src={event.image_url}
                                alt={`Imagem da prova ${event.name}`}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/90 via-[#0A1628]/35 to-transparent" />
                            </>
                          ) : null}
                          <StatusBadge
                            tone={registrationTone(regStatus)}
                            label={registrationLabel(regStatus)}
                            className="relative z-[1] text-[10px]"
                          />
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-center gap-1 text-[10px] text-white/40">
                            <CalendarDays className="h-3 w-3" />
                            {format(new Date(event.event_date), "dd MMM yyyy", {
                              locale: ptBR,
                            }).toUpperCase()}
                          </div>
                          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">
                            {event.name}
                          </h3>
                          <div className="flex items-center gap-1 text-[11px] text-white/40">
                            <MapPin className="h-3 w-3" />
                            {event.city}/{event.state}
                          </div>
                          <p className="text-[10px] text-white/30">
                            {event.distances.map((d) => d.label).join(" · ")}
                          </p>
                          <Link
                            href={`/provas/${event.id}`}
                            className="mt-1 flex h-8 w-full items-center justify-center rounded-lg bg-[#1E90FF] text-[12px] font-semibold text-white transition hover:brightness-110"
                          >
                            {cta}
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <p className="text-center text-[13px] text-white/40">
                    Nenhuma prova agendada no momento.
                  </p>
                </Card>
              )}
            </div>

            {/* Minhas Inscrições + Financeiro */}
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              {/* Minhas Inscrições */}
              <Card>
                <SectionHeader
                  title="Minhas inscrições"
                  action={
                    <Link
                      href="/minhas-inscricoes"
                      className="text-[11px] font-semibold text-[#1E90FF] hover:underline"
                    >
                      Ver todas
                    </Link>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.03] bg-white/[0.03]">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                          Prova
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                          Modalidade
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                          Pagamento
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.minhasInscricoes.slice(0, 5).map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                        >
                          <td className="px-3 py-3 text-white">{item.event.name}</td>
                          <td className="px-3 py-3 font-semibold text-white/70">
                            {item.distance.label}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              tone={registrationTone(item.status)}
                              label={registrationLabel(item.status)}
                              className="text-[10px]"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge
                              tone={paymentTone(item.payment?.status ?? null)}
                              label={paymentLabel(item.payment?.status ?? null)}
                              className="text-[10px]"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.minhasInscricoes.length && (
                    <p className="py-6 text-center text-[13px] text-white/40">
                      Nenhuma inscrição registrada.
                    </p>
                  )}
                </div>
              </Card>

              {/* Financeiro */}
              <Card>
                <SectionHeader
                  title="Financeiro"
                  action={
                    <Link
                      href="/financeiro"
                      className="text-[11px] font-semibold text-[#1E90FF] hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  }
                />
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
                      <p className="text-[11px] text-white/40">Total gasto (ano)</p>
                      <p className="mt-1 text-xl font-bold text-white">
                        {BRL_COMPACT.format(data.financeiro.totalGastoAno / 100)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
                      <p className="text-[11px] text-white/40">Pendente</p>
                      <p className="mt-1 text-xl font-bold text-[#F4C542]">
                        {BRL_COMPACT.format(data.financeiro.pendente / 100)}
                      </p>
                    </div>
                  </div>
                  {data.financeiro.proximaCobranca && (
                    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3">
                      <p className="text-[11px] text-white/40">Próxima cobrança</p>
                      <p className="mt-1 text-[13px] font-semibold text-white">
                        {data.financeiro.proximaCobranca.expires_at
                          ? format(
                              new Date(data.financeiro.proximaCobranca.expires_at),
                              "dd/MM/yyyy",
                            )
                          : "Sem prazo definido"}
                      </p>
                    </div>
                  )}
                  {(experience?.financeBreakdown ?? []).length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="h-32 w-32 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={experience!.financeBreakdown}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={36}
                              outerRadius={52}
                            >
                              {experience!.financeBreakdown.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="flex-1 space-y-2 text-[12px]">
                        {experience!.financeBreakdown.map((item) => (
                          <li key={item.name} className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-white/55">
                              <span
                                className="h-2 w-2 rounded-full flex-shrink-0"
                                style={{ background: item.color }}
                              />
                              {item.name}
                            </span>
                            <span className="font-semibold text-white">{item.value}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Minha Evolução */}
            <div>
              <SectionHeader
                title="Minha evolução"
                action={
                  <Link
                    href="/evolucao"
                    className="text-[11px] font-semibold text-[#1E90FF] hover:underline"
                  >
                    Ver histórico completo
                  </Link>
                }
              />
              <Card>
                <div className="space-y-5">
                  {/* KPI highlights paginados */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[11px] text-white/40">
                        Indicadores — {statsPage + 1}/{totalStatsPages}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStatsPage((p) => Math.max(0, p - 1))}
                          disabled={statsPage === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/55 transition hover:bg-white/[0.07] disabled:opacity-30"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatsPage((p) => Math.min(totalStatsPages - 1, p + 1))}
                          disabled={statsPage === totalStatsPages - 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/55 transition hover:bg-white/[0.07] disabled:opacity-30"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {pagedStats.map((item) => {
                        const Icon = HIGHLIGHT_ICON[item.id] ?? TrendingUp;
                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-white/15"
                          >
                            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E90FF]/10">
                              <Icon className="h-4 w-4 text-[#1E90FF]" />
                            </div>
                            <p className="text-[1.6rem] font-extrabold leading-none text-white">
                              {item.value}
                            </p>
                            <p className="mt-1.5 text-[12px] text-white/40">{item.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sports metrics */}
                  {(experience?.sportsMetrics ?? []).length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {experience!.sportsMetrics.map((metric) => {
                        const trend = METRIC_TREND[metric.trend];
                        const TrendIcon = trend.icon;
                        return (
                          <div
                            key={metric.id}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-white/40">
                              {metric.label}
                            </p>
                            <p className="mt-2 text-xl font-bold text-white">{metric.value}</p>
                            <p
                              className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${trend.className}`}
                            >
                              <TrendIcon className="h-3 w-3" /> {metric.delta}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Charts row */}
                  <div className="grid gap-4 xl:grid-cols-[1.5fr_0.5fr]">
                    {/* Line chart */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-white/40">
                        Evolução de KM — 2024 vs 2023
                      </p>
                      <div className="h-52 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={experience?.evolutionSeries ?? []}>
                            <XAxis
                              dataKey="month"
                              stroke="#ffffff22"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 10, fill: "#ffffff55" }}
                            />
                            <YAxis
                              stroke="#ffffff22"
                              tickLine={false}
                              axisLine={false}
                              width={28}
                              tick={{ fontSize: 10, fill: "#ffffff55" }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#112240",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              labelStyle={{ color: "#fff" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="current"
                              stroke="#1E90FF"
                              strokeWidth={2}
                              dot={{ r: 2.5, fill: "#1E90FF" }}
                              name="2024"
                            />
                            <Line
                              type="monotone"
                              dataKey="previous"
                              stroke="#F4C542"
                              strokeWidth={2}
                              dot={{ r: 2.5, fill: "#F4C542" }}
                              name="2023"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Distribution + Conquistas */}
                    <div className="space-y-3">
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-white/40">
                          Distâncias
                        </p>
                        <div className="h-28 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={experience?.distanceDistribution ?? []}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={28}
                                outerRadius={44}
                              >
                                {(experience?.distanceDistribution ?? []).map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {(experience?.achievements ?? []).length > 0 && (
                        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-white/40">
                            Conquistas
                          </p>
                          <div className="space-y-1.5">
                            {experience!.achievements.map((a) => (
                              <StatusBadge
                                key={a.id}
                                label={a.label}
                                tone={
                                  a.tone === "success"
                                    ? "positive"
                                    : a.tone === "warning"
                                      ? "warning"
                                      : "info"
                                }
                                className="w-full justify-center rounded-lg text-[10px]"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* ── Right column ── */}
          <aside className="space-y-5">
            {/* Calendar */}
            <Card className="p-4">
              <SectionHeader
                title="Calendário do grupo"
                action={
                  <Link
                    href="/calendario"
                    className="text-[11px] font-semibold text-[#1E90FF] hover:underline"
                  >
                    Ver calendário completo
                  </Link>
                }
              />

              {/* Month nav */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((m) => startOfMonth(subMonths(m, 1)))}
                  aria-label="Mês anterior"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] text-white/55 transition hover:bg-white/[0.05]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <p className="text-[13px] font-semibold capitalize text-white">
                  {format(calendarMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((m) => startOfMonth(addMonths(m, 1)))}
                  aria-label="Próximo mês"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] text-white/55 transition hover:bg-white/[0.05]"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"].map((d) => (
                  <span
                    key={d}
                    className="py-1 text-[9px] font-semibold tracking-[0.08em] text-white/25"
                  >
                    {d}
                  </span>
                ))}
                {calendarDays.map((day) => {
                  const dayEntries = monthEntries.filter((item) =>
                    isSameDay(new Date(item.event_date), day),
                  );
                  const primaryType = dayEntries[0] ? calendarEntryType(dayEntries[0]) : null;
                  const isSelected = isSameDay(day, selectedDay);
                  const toneClass = primaryType
                    ? CALENDAR_CONFIG[primaryType].dayClass
                    : "text-white/50";

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day);
                        if (dayEntries[0]) setSelectedCalendarEntryId(dayEntries[0].id);
                      }}
                      className={`relative min-h-9 rounded-lg text-[11px] font-semibold transition ${
                        isSameMonth(day, calendarMonth) ? toneClass : "text-white/20"
                      } ${isSelected ? "ring-2 ring-[#1E90FF] ring-offset-1 ring-offset-[#112240]" : "hover:brightness-125"}`}
                    >
                      {format(day, "d")}
                      {dayEntries.length > 0 && (
                        <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                          {dayEntries.slice(0, 3).map((entry) => (
                            <span
                              key={entry.id}
                              className={`h-1 w-1 rounded-full ${CALENDAR_CONFIG[calendarEntryType(entry)].dotClass}`}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected day */}
              {selectedDayEntries.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-white/40">
                    {format(selectedDay, "dd/MM", { locale: ptBR })}
                  </p>
                  {selectedDayEntries.map((entry) => {
                    const type = calendarEntryType(entry);
                    return (
                      <Link
                        key={entry.id}
                        href={entry.linkHref ?? "/provas"}
                        className="block rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 transition hover:border-white/15"
                        onMouseEnter={() => setSelectedCalendarEntryId(entry.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-white">{entry.name}</p>
                          <StatusBadge
                            label={CALENDAR_CONFIG[type].label}
                            tone={CALENDAR_CONFIG[type].tone}
                            className="text-[9px]"
                          />
                        </div>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {entry.subtitle ?? [entry.city, entry.state].filter(Boolean).join(" / ")}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Upcoming list */}
              {nextEvents.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-white/[0.07] pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-white/40">
                    Próximos eventos
                  </p>
                  {nextEvents.map((entry) => {
                    const type = calendarEntryType(entry);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          const d = new Date(entry.event_date);
                          setCalendarMonth(startOfMonth(d));
                          setSelectedDay(d);
                          setSelectedCalendarEntryId(entry.id);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-white/15"
                      >
                        <span
                          className={`h-2 w-2 flex-shrink-0 rounded-full ${CALENDAR_CONFIG[type].dotClass}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-white">
                            {entry.name}
                          </p>
                          <p className="text-[10px] text-white/40">
                            {format(new Date(entry.event_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Comunidade */}
            <Card className="p-4">
              <SectionHeader
                title="Comunidade"
                action={
                  <Link
                    href="/comunidade"
                    className="text-[11px] font-semibold text-[#1E90FF] hover:underline"
                  >
                    Ver feed
                  </Link>
                }
              />
              {communityFeed ? (
                <CommunityFeed data={communityFeed} maxPosts={1} showComments={false} compact />
              ) : (
                <div className="py-4 text-center">
                  <p className="text-[13px] text-white/40">
                    {communityError ?? "Feed temporariamente indisponível."}
                  </p>
                </div>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
