"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, LayoutGrid, List, Search, Trophy } from "lucide-react";
import { EventCard } from "@/components/events/event-card";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/system/status-badge";
import { getAthleteEvents } from "@/services/events-service";
import { getAthleteRacePlans, joinRacePlan } from "@/services/race-plans-service";
import { getAthleteIdentity, getRegistrations } from "@/services/registrations-service";
import type { AthleteIdentity, ServiceEvent, ServiceRacePlan } from "@/services/types";
import { getEventRecommendation, getFirstRaceGuidance } from "@/lib/race-recommendations";
import { useInscricoesStore, type Inscricao } from "@/store/inscricoes";
import { toast } from "sonner";

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
    <div className="inline-flex h-10 rounded-lg border border-white/10 bg-[#0F2743] p-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${
              active ? "bg-[#1E90FF] text-white" : "text-slate-300 hover:bg-white/[0.06]"
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

function formatRegistrationLabel(registration?: Inscricao): string {
  if (!registration) return "Escolher";
  if (registration.status === "CONFIRMED") return registration.distanceLabel;
  if (registration.status === "PENDING_PAYMENT") return "Pagamento pendente";
  if (registration.status === "INTERESTED") return "Interesse";
  return "Cancelada";
}

function racePlanParticipationLabel(plan: ServiceRacePlan): string {
  const status = plan.myParticipation?.status;
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "REGISTERED_EXTERNALLY") return "Inscrito fora";
  if (status === "IN_TEAM_REGISTRATION") return "Inscricao coletiva";
  if (status === "PENDING_PAYMENT") return "Pagamento pendente";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "ATTENDED") return "Presente";
  if (status === "NO_SHOW") return "Ausente";
  if (status === "INTERESTED") return "Interesse registrado";
  return "Aberta";
}

export default function ProvasPage() {
  const { accessToken } = useAuthToken();
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [racePlans, setRacePlans] = useState<ServiceRacePlan[]>([]);
  const [athlete, setAthlete] = useState<AthleteIdentity | null>(null);
  const inscricoes = useInscricoesStore((state) => state.inscricoes);
  const setInscricoes = useInscricoesStore((state) => state.setInscricoes);
  const hydrate = useInscricoesStore((state) => state.hydrate);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [fitFilter, setFitFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [payload, athletePayload, registrationPayload, racePlansPayload] = await Promise.all([
          getAthleteEvents(accessToken),
          getAthleteIdentity(accessToken).catch(() => null),
          getRegistrations(accessToken).catch(() => []),
          getAthleteRacePlans(accessToken).catch(() => []),
        ]);
        if (!cancelled) {
          setEvents(payload);
          setAthlete(athletePayload);
          setInscricoes(registrationPayload);
          setRacePlans(racePlansPayload);
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
          setError("Nao foi possivel carregar as provas em tempo real.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, reloadKey, setInscricoes]);

  const cities = useMemo(() => {
    const uniques = Array.from(new Set(events.map((event) => event.city)));
    return uniques.sort((a, b) => a.localeCompare(b));
  }, [events]);

  const activeEvents = useMemo(
    () => events.filter((event) => event.status !== "CANCELLED"),
    [events],
  );

  const visibleEvents = useMemo(() => {
    return activeEvents
      .filter((event) => (cityFilter === "ALL" ? true : event.city === cityFilter))
      .filter((event) => {
        if (fitFilter === "ALL") return true;
        const recommendation = getEventRecommendation(event, athlete);
        if (!recommendation) return false;
        if (fitFilter === "READY") return recommendation.tone === "positive";
        if (fitFilter === "BUILD") return recommendation.tone === "info";
        if (fitFilter === "CAUTION")
          return recommendation.tone === "warning" || recommendation.tone === "danger";
        return true;
      })
      .filter((event) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        const target = `${event.name} ${event.city} ${event.state}`.toLowerCase();
        return target.includes(query);
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [activeEvents, athlete, cityFilter, fitFilter, search]);

  const firstRaceGuidance = useMemo(
    () => getFirstRaceGuidance(athlete, activeEvents),
    [activeEvents, athlete],
  );

  const recommendationByEventId = useMemo(() => {
    return new Map(
      visibleEvents.map((event) => [event.id, getEventRecommendation(event, athlete)]),
    );
  }, [athlete, visibleEvents]);

  const registrationByEventId = useMemo(() => {
    return inscricoes.reduce<Map<string, Inscricao>>((acc, registration) => {
      if (registration.status === "CANCELLED") return acc;
      if (!acc.has(registration.eventId)) acc.set(registration.eventId, registration);
      return acc;
    }, new Map());
  }, [inscricoes]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provas"
        subtitle="Calendario de corridas com status, distancias e inscricao direta."
        actions={
          <ActionButton asChild>
            <Link href="/minhas-inscricoes">Minhas inscricoes</Link>
          </ActionButton>
        }
      />

      <SectionCard
        title="Minha primeira prova"
        description="Leitura rapida para escolher uma distancia compativel com seu momento"
      >
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-sky-200">Rota sugerida</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{firstRaceGuidance.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{firstRaceGuidance.description}</p>
            {athlete?.nextCompetitionDate ? (
              <p className="mt-3 text-xs font-semibold text-amber-200">
                Prova alvo: {new Date(athlete.nextCompetitionDate).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {firstRaceGuidance.checklist.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <StatusBadge
                    label={item.done ? "ok" : "pendente"}
                    tone={item.done ? "positive" : "warning"}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Provas da assessoria"
        description="Agenda oficial que a equipe abriu para participacao dos atletas"
      >
        {racePlans.length === 0 ? (
          <EmptyState
            title="Nenhuma prova aberta pela assessoria"
            description="Quando o admin abrir uma prova para o grupo, ela aparece aqui com a acao de participacao."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {racePlans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-lg border border-white/10 bg-[#0f233d] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-200" />
                      <p className="truncate text-sm font-bold text-white">{plan.event.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {plan.event.city}/{plan.event.state} |{" "}
                      {new Date(plan.event.eventDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <StatusBadge
                    label={racePlanParticipationLabel(plan)}
                    tone={plan.myParticipation ? "positive" : "info"}
                  />
                </div>

                {plan.instructions ? (
                  <p className="mt-3 text-xs leading-5 text-slate-300">{plan.instructions}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton asChild intent="secondary">
                    <Link href={`/provas/${plan.eventId}`}>Ver detalhes</Link>
                  </ActionButton>
                  <ActionButton
                    disabled={Boolean(plan.myParticipation)}
                    onClick={async () => {
                      try {
                        const participation = await joinRacePlan(plan.id, {}, accessToken);
                        setRacePlans((prev) =>
                          prev.map((item) =>
                            item.id === plan.id
                              ? { ...item, myParticipation: participation }
                              : item,
                          ),
                        );
                        toast.success("Participacao registrada para a assessoria.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Nao foi possivel registrar participacao.",
                        );
                      }
                    }}
                  >
                    {plan.myParticipation ? "Participacao registrada" : "Quero participar"}
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Catalogo de provas"
        description="Experiencia de selecao otimizada para atleta"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar prova por nome, cidade ou estado"
                className="border-white/15 bg-[#0F2743] pl-10 text-white placeholder:text-slate-400"
              />
            </div>

            <Select
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              className="border-white/15 bg-[#0F2743] text-white"
            >
              <option value="ALL">Todas as cidades</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>

            <Select
              value={fitFilter}
              onChange={(event) => setFitFilter(event.target.value)}
              className="border-white/15 bg-[#0F2743] text-white"
            >
              <option value="ALL">Todos os encaixes</option>
              <option value="READY">Prontas para mim</option>
              <option value="BUILD">Desafio controlado</option>
              <option value="CAUTION">Exigem cuidado</option>
            </Select>

            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f233d] px-3 py-2 text-xs text-slate-300">
              <CalendarRange className="h-4 w-4 text-[#98bce8]" />
              {visibleEvents.length} provas visiveis
            </div>

            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="surface-shimmer h-[390px] rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              title="Provas indisponiveis"
              description={error}
              action={
                <ActionButton onClick={() => setReloadKey((prev) => prev + 1)} intent="secondary">
                  Tentar novamente
                </ActionButton>
              }
            />
          ) : visibleEvents.length === 0 ? (
            <EmptyState
              title="Nenhuma prova encontrada"
              description="Ajuste os filtros para ver outras provas disponiveis."
            />
          ) : viewMode === "cards" ? (
            <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleEvents.map((event) => (
                (() => {
                  const registration = registrationByEventId.get(event.id);
                  return (
                    <Link key={event.id} href={`/provas/${event.id}`} className="flex">
                      <EventCard
                        event={event}
                        mode="athlete"
                        recommendation={recommendationByEventId.get(event.id)}
                        registration={
                          registration
                            ? {
                                status: registration.status,
                                distanceLabel: registration.distanceLabel,
                              }
                            : null
                        }
                        ctaLabel={event.status === "PUBLISHED" ? undefined : "Acompanhar"}
                        ctaDisabled={event.status !== "PUBLISHED"}
                      />
                    </Link>
                  );
                })()
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/10 bg-[#071b31]">
              {visibleEvents.map((event) => {
                const registration = registrationByEventId.get(event.id);
                const distanceLabel =
                  event.distances.map((distance) => distance.label).join(" / ") ||
                  "Distancia a definir";
                return (
                  <Link
                    key={event.id}
                    href={`/provas/${event.id}`}
                    className="grid gap-3 border-b border-white/10 px-3 py-3 transition last:border-b-0 hover:bg-white/[0.04] md:grid-cols-[minmax(0,1fr)_140px_150px_130px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{event.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {event.city}/{event.state} | {distanceLabel}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-slate-200">
                      {new Date(event.event_date).toLocaleDateString("pt-BR")}
                    </p>
                    <StatusBadge
                      label={formatRegistrationLabel(registration)}
                      tone={
                        registration?.status === "CONFIRMED"
                          ? "positive"
                          : registration?.status === "PENDING_PAYMENT"
                            ? "warning"
                            : registration?.status === "INTERESTED"
                              ? "info"
                              : "neutral"
                      }
                    />
                    <span className="inline-flex h-8 items-center justify-center rounded-md bg-[#0868bd] px-3 text-xs font-bold text-white">
                      {registration?.status === "PENDING_PAYMENT"
                        ? "Concluir"
                        : registration
                          ? "Ver prova"
                          : "Participar"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Status das provas" description="Leitura rapida para tomada de decisao">
        <div className="flex flex-wrap gap-2">
          <EventStatusBadge status="PUBLISHED" />
          <EventStatusBadge status="DRAFT" />
          <EventStatusBadge status="FINISHED" />
          <EventStatusBadge status="CANCELLED" />
        </div>
      </SectionCard>
    </div>
  );
}
