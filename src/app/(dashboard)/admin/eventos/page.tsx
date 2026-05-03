"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  CircleDollarSign,
  CopyPlus,
  Eye,
  LayoutGrid,
  List,
  Megaphone,
  Pencil,
  Plus,
  Rocket,
  Search,
  TicketCheck,
  Users,
  XCircle,
} from "lucide-react";
import { EventCard } from "@/components/events/event-card";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Modal } from "@/components/system/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { type EventStatus, type EventView } from "@/components/events/types";
import {
  cancelAdminEvent,
  duplicateAdminEvent,
  getAdminEvents,
  publishAdminEvent,
} from "@/services/events-service";
import { openAdminRacePlan } from "@/services/race-plans-service";
import { toast } from "sonner";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type EventsTab = "upcoming" | "drafts" | "checkin" | "registrations" | "finished";
type ViewMode = "cards" | "list";

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  const items = [
    { value: "cards" as const, label: "Cards", icon: LayoutGrid },
    { value: "list" as const, label: "Lista", icon: List },
  ];

  return (
    <div className="inline-flex h-10 rounded-lg border border-white/10 bg-white/[0.05] p-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${
              active ? "bg-[#1E90FF] text-white" : "text-slate-300 hover:bg-white/[0.07]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* Botão ícone compacto para ações de evento */
function EventIconBtn({
  href,
  onClick,
  icon: Icon,
  title,
  variant = "default",
  disabled = false,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ElementType;
  title: string;
  variant?: "default" | "info" | "danger";
  disabled?: boolean;
}) {
  const styles = {
    default:
      "border border-white/[0.1] bg-white/[0.04] text-white/60 hover:bg-white/[0.09] hover:text-white",
    info: "border border-[#1E90FF]/30 bg-[#1E90FF]/10 text-[#1E90FF] hover:bg-[#1E90FF]/20",
    danger: "border border-[#FF4444]/30 bg-[#FF4444]/10 text-[#FF4444] hover:bg-[#FF4444]/20",
  };
  const cls = `inline-flex h-7 w-7 items-center justify-center rounded-lg transition flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`;
  if (href) {
    return (
      <Link
        href={disabled ? "#" : href}
        title={title}
        aria-label={title}
        className={cls}
        aria-disabled={disabled}
      >
        <Icon className="h-3.5 w-3.5" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cls}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function estimatedRevenue(event: EventView): number {
  const registrations = event.registrations_count ?? 0;
  if (registrations <= 0 || event.distances.length === 0) return 0;

  const avgTicket =
    event.distances.reduce((sum, distance) => sum + distance.price_cents, 0) /
    event.distances.length;

  return Math.round(avgTicket * registrations);
}

function eventStatusTone(status: EventStatus): "warning" | "positive" | "danger" | "neutral" {
  if (status === "DRAFT") return "warning";
  if (status === "PUBLISHED") return "positive";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function eventStatusLabel(status: EventStatus): string {
  if (status === "DRAFT") return "Rascunho";
  if (status === "PUBLISHED") return "Publicado";
  if (status === "CANCELLED") return "Cancelado";
  return "Finalizado";
}

function daysUntil(value: string): number {
  const now = new Date();
  const target = new Date(value);
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

function eventMatchesOperationalTab(event: EventView, tab: EventsTab): boolean {
  const diffDays = daysUntil(event.event_date);

  if (tab === "drafts") return event.status === "DRAFT";
  if (tab === "finished") return event.status === "FINISHED";
  if (tab === "checkin") {
    return event.status === "PUBLISHED" && diffDays >= -1 && diffDays <= 2;
  }
  if (tab === "registrations") {
    return event.status === "PUBLISHED" && diffDays >= 0;
  }
  return event.status === "PUBLISHED" && diffDays >= 0;
}

function operationalTabTitle(tab: EventsTab): string {
  if (tab === "drafts") return "Rascunhos";
  if (tab === "checkin") return "Check-in";
  if (tab === "registrations") return "Inscricoes";
  if (tab === "finished") return "Finalizadas";
  return "Proximas provas";
}

function operationalTabDescription(tab: EventsTab): string {
  if (tab === "drafts") return "Provas em preparacao que ainda precisam ser publicadas.";
  if (tab === "checkin") return "Provas em janela operacional para presenca, inscritos e apoio.";
  if (tab === "registrations") return "Provas publicadas com foco em conversao e acompanhamento.";
  if (tab === "finished") return "Historico de provas encerradas para consulta e auditoria.";
  return "Agenda publicada para coordenar proximas acoes do grupo.";
}

export default function AdminEventosPage() {
  const { accessToken } = useAuthToken();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | EventStatus>("ALL");
  const [windowFilter, setWindowFilter] = useState<"ALL" | "next14d">("ALL");
  const [cancelTarget, setCancelTarget] = useState<EventView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EventsTab>("upcoming");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  useEffect(() => {
    const statusParam = searchParams.get("status");
    const searchParam = searchParams.get("q");
    const windowParam = searchParams.get("window");

    if (
      statusParam === "DRAFT" ||
      statusParam === "PUBLISHED" ||
      statusParam === "CANCELLED" ||
      statusParam === "FINISHED"
    ) {
      setStatusFilter(statusParam);
    } else {
      setStatusFilter("ALL");
    }

    setSearch(searchParam ?? "");
    setWindowFilter(windowParam === "next14d" ? "next14d" : "ALL");
    if (statusParam === "DRAFT") setActiveTab("drafts");
    if (statusParam === "FINISHED") setActiveTab("finished");
    if (windowParam === "next14d" || statusParam === "PUBLISHED") setActiveTab("upcoming");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const payload = await getAdminEvents(accessToken);
        if (!cancelled) {
          setEvents(payload);
          setErrorMessage(null);
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
          setErrorMessage("Não foi possível carregar as provas administrativas agora.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const filtered = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      const matchesTab = eventMatchesOperationalTab(event, activeTab);
      const matchesSearch = event.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" ? true : event.status === statusFilter;
      const matchesWindow =
        windowFilter === "next14d"
          ? (() => {
              const eventDate = new Date(event.event_date);
              const diffDays = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
              return diffDays >= 0 && diffDays <= 14;
            })()
          : true;
      return matchesTab && matchesSearch && matchesStatus && matchesWindow;
    });
  }, [activeTab, events, search, statusFilter, windowFilter]);

  const metrics = useMemo(() => {
    const total = events.length;
    const published = events.filter((event) => event.status === "PUBLISHED").length;
    const draft = events.filter((event) => event.status === "DRAFT").length;
    const totalRegistrations = events.reduce(
      (sum, event) => sum + (event.registrations_count ?? 0),
      0,
    );
    const potentialRevenue = events.reduce((sum, event) => sum + estimatedRevenue(event), 0);

    return {
      total,
      published,
      draft,
      totalRegistrations,
      potentialRevenue,
    };
  }, [events]);

  const operationalCounts = useMemo(
    () => ({
      upcoming: events.filter((event) => eventMatchesOperationalTab(event, "upcoming")).length,
      drafts: events.filter((event) => eventMatchesOperationalTab(event, "drafts")).length,
      checkin: events.filter((event) => eventMatchesOperationalTab(event, "checkin")).length,
      registrations: events.filter((event) =>
        eventMatchesOperationalTab(event, "registrations"),
      ).length,
      finished: events.filter((event) => eventMatchesOperationalTab(event, "finished")).length,
    }),
    [events],
  );

  const tabs = useMemo<ModuleTabItem<EventsTab>[]>(
    () => [
      {
        key: "upcoming",
        label: "Proximas",
        audience: "Agenda",
        description: "Provas publicadas que ainda vao acontecer.",
        icon: CalendarCheck,
        metricLabel: "Abertas",
        metricValue: operationalCounts.upcoming,
        metricTone: "info",
      },
      {
        key: "drafts",
        label: "Rascunhos",
        audience: "Operacao",
        description: "Itens que precisam ser revisados e publicados.",
        icon: Rocket,
        metricLabel: "Rascunhos",
        metricValue: operationalCounts.drafts,
        metricTone: operationalCounts.drafts > 0 ? "warning" : "positive",
      },
      {
        key: "checkin",
        label: "Check-in",
        audience: "Dia da prova",
        description: "Janela de presenca e suporte operacional.",
        icon: TicketCheck,
        metricLabel: "Agora",
        metricValue: operationalCounts.checkin,
        metricTone: operationalCounts.checkin > 0 ? "warning" : "neutral",
      },
      {
        key: "registrations",
        label: "Inscricoes",
        audience: "Conversao",
        description: "Acompanhe inscritos e pagamentos por prova.",
        icon: Search,
        metricLabel: "Filtradas",
        metricValue: operationalCounts.registrations,
        metricTone: operationalCounts.registrations > 0 ? "positive" : "neutral",
      },
      {
        key: "finished",
        label: "Finalizadas",
        audience: "Historico",
        description: "Consulta e auditoria de provas encerradas.",
        icon: BarChart3,
        metricLabel: "Arquivo",
        metricValue: operationalCounts.finished,
        metricTone: "neutral",
      },
    ],
    [operationalCounts],
  );

  const renderEventActions = (event: EventView) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <EventIconBtn href={`/admin/eventos/${event.id}`} icon={Eye} title="Ver prova" />
      <EventIconBtn
        href={`/admin/eventos/${event.id}#inscritos`}
        icon={Users}
        title="Ver inscritos"
      />
      <EventIconBtn
        href={`/admin/financeiro?status=PENDING&event=${encodeURIComponent(event.name)}`}
        icon={CircleDollarSign}
        title="Ver financeiro"
      />
      <EventIconBtn
        href={`/admin/eventos/${event.id}/editar`}
        icon={Pencil}
        title="Editar prova"
      />
      {event.status === "DRAFT" && (
        <EventIconBtn
          icon={Rocket}
          title="Publicar prova"
          variant="info"
          disabled={actionInFlight === `${event.id}:publish`}
          onClick={async () => {
            try {
              setActionInFlight(`${event.id}:publish`);
              const updated = await publishAdminEvent(event.id, accessToken);
              setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              toast.success("Prova publicada com sucesso.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Falha ao publicar prova.");
            } finally {
              setActionInFlight(null);
            }
          }}
        />
      )}
      <EventIconBtn
        icon={Megaphone}
        title="Abrir na lista da produtora"
        variant="info"
        disabled={actionInFlight === `${event.id}:race-plan`}
        onClick={async () => {
          try {
            setActionInFlight(`${event.id}:race-plan`);
            await openAdminRacePlan(
              {
                eventId: event.id,
                athleteAction: "INTEREST",
                instructions:
                  "Prova adicionada a agenda oficial da produtora. Confirme seu interesse para a equipe acompanhar.",
              },
              accessToken,
            );
            toast.success("Prova aberta na lista oficial da produtora.");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Falha ao abrir prova para atletas.",
            );
          } finally {
            setActionInFlight(null);
          }
        }}
      />
      <EventIconBtn
        icon={CopyPlus}
        title="Duplicar prova"
        disabled={actionInFlight === `${event.id}:duplicate`}
        onClick={async () => {
          try {
            setActionInFlight(`${event.id}:duplicate`);
            const duplicated = await duplicateAdminEvent(event.id, accessToken);
            setEvents((prev) => [duplicated, ...prev]);
            toast.success("Prova duplicada com sucesso.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao duplicar prova.");
          } finally {
            setActionInFlight(null);
          }
        }}
      />
      <EventIconBtn
        icon={XCircle}
        title="Cancelar prova"
        variant="danger"
        disabled={actionInFlight === `${event.id}:cancel`}
        onClick={() => setCancelTarget(event)}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Provas"
        subtitle="Painel operacional para publicar, acompanhar e otimizar o calendário esportivo."
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionButton asChild intent="secondary">
              <Link href="/calendario">Ver calendário</Link>
            </ActionButton>
            <ActionButton asChild intent="secondary">
              <Link href="/admin/financeiro?status=PENDING&due=ALL">Ver financeiro</Link>
            </ActionButton>
            <ActionButton asChild>
              <Link href="/admin/eventos/novo">
                <Plus className="mr-2 h-4 w-4" /> Nova Prova
              </Link>
            </ActionButton>
          </div>
        }
      />

      <SectionCard
        title="Operacao de provas"
        description="Fluxo por etapa para coordenar agenda, publicacao, check-in, inscricoes e historico."
      >
        <ModuleTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          columnsClassName="md:grid-cols-5"
        />
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total de provas" value={metrics.total} />
        <MetricCard label="Publicadas" value={metrics.published} tone="highlight" />
        <MetricCard label="Rascunhos" value={metrics.draft} />
        <MetricCard label="Inscrições totais" value={metrics.totalRegistrations} />
        <MetricCard label="Receita estimada" value={BRL.format(metrics.potentialRevenue / 100)} />
      </div>

      <SectionCard
        title={operationalTabTitle(activeTab)}
        description={operationalTabDescription(activeTab)}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_240px_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome da prova"
                className="border-white/[0.1] bg-white/[0.05] pl-10 text-white placeholder:text-white/30"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | EventStatus)}
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="ALL">Todos os status</option>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="FINISHED">Finalizado</option>
            </Select>

            <Select
              value={windowFilter}
              onChange={(event) => setWindowFilter(event.target.value as "ALL" | "next14d")}
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="ALL">Janela (todas)</option>
              <option value="next14d">Próximos 14 dias</option>
            </Select>

            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>

          {loading ? (
            <LoadingState lines={5} />
          ) : errorMessage ? (
            <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              {errorMessage}
            </p>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhuma prova encontrada"
              description="Ajuste os filtros ou cadastre uma nova prova para continuar."
            />
          ) : viewMode === "cards" ? (
            <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  mode="admin"
                  actions={renderEventActions(event)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/10 bg-[#071b31]">
              {filtered.map((event) => {
                const distanceLabel =
                  event.distances.map((distance) => distance.label).join(" / ") ||
                  "Distancia a definir";
                return (
                  <div
                    key={event.id}
                    className="grid gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_120px_110px_110px_190px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{event.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {event.city}/{event.state} | {distanceLabel}
                      </p>
                    </div>
                    <StatusBadge
                      label={eventStatusLabel(event.status)}
                      tone={eventStatusTone(event.status)}
                    />
                    <p className="text-xs font-semibold text-slate-200">
                      {new Date(event.event_date).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="text-xs font-semibold text-slate-200">
                      {event.registrations_count ?? 0} inscr.
                    </p>
                    {renderEventActions(event)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <Modal
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancelar prova"
        description={`Deseja cancelar a prova ${cancelTarget?.name ?? ""}? Essa ação mudará o status para cancelado.`}
        footer={
          <>
            <ActionButton intent="secondary" onClick={() => setCancelTarget(null)}>
              Voltar
            </ActionButton>
            <ActionButton
              intent="danger"
              disabled={!cancelTarget || actionInFlight === `${cancelTarget.id}:cancel`}
              onClick={async () => {
                if (!cancelTarget) return;
                try {
                  setActionInFlight(`${cancelTarget.id}:cancel`);
                  const updated = await cancelAdminEvent(cancelTarget.id, accessToken);
                  setEvents((prev) =>
                    prev.map((event) => (event.id === updated.id ? updated : event)),
                  );
                  toast.success("Prova cancelada com sucesso.");
                  setCancelTarget(null);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao cancelar prova.");
                } finally {
                  setActionInFlight(null);
                }
              }}
            >
              Confirmar cancelamento
            </ActionButton>
          </>
        }
      />
    </div>
  );
}
