"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Search } from "lucide-react";
import { EventCard } from "@/components/events/event-card";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import type { EventView } from "@/components/events/types";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { Select } from "@/components/ui/select";
import { getAthleteEvents } from "@/services/events-service";

export default function ProvasPage() {
  const { accessToken } = useAuthToken();
  const [events, setEvents] = useState<EventView[]>([]);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAthleteEvents(accessToken);
        if (!cancelled) setEvents(payload);
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

  const visibleEvents = useMemo(() => {
    return events
      .filter((event) => event.status !== "CANCELLED")
      .filter((event) => (cityFilter === "ALL" ? true : event.city === cityFilter))
      .filter((event) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        const target = `${event.name} ${event.city} ${event.state}`.toLowerCase();
        return target.includes(query);
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [cityFilter, events, search]);

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
        title="Catalogo de provas"
        description="Experiencia de selecao otimizada para atleta"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
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
