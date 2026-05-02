"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Search } from "lucide-react";
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
import { getAthleteIdentity } from "@/services/registrations-service";
import type { AthleteIdentity, ServiceEvent } from "@/services/types";
import { getEventRecommendation, getFirstRaceGuidance } from "@/lib/race-recommendations";

export default function ProvasPage() {
  const { accessToken } = useAuthToken();
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [athlete, setAthlete] = useState<AthleteIdentity | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [fitFilter, setFitFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [payload, athletePayload] = await Promise.all([
          getAthleteEvents(accessToken),
          getAthleteIdentity(accessToken).catch(() => null),
        ]);
        if (!cancelled) {
          setEvents(payload);
          setAthlete(athletePayload);
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
  }, [accessToken, reloadKey]);

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
        title="Catalogo de provas"
        description="Experiencia de selecao otimizada para atleta"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
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
          ) : (
            <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleEvents.map((event) => (
                <Link key={event.id} href={`/provas/${event.id}`} className="flex">
                  <EventCard
                    event={event}
                    mode="athlete"
                    recommendation={recommendationByEventId.get(event.id)}
                    ctaLabel={event.status === "PUBLISHED" ? "Ver detalhes" : "Acompanhar"}
                    ctaDisabled={event.status !== "PUBLISHED"}
                  />
                </Link>
              ))}
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
