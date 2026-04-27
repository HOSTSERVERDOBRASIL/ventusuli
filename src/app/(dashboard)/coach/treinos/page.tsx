"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { getAthletesList } from "@/services/athletes-service";
import { getAthleteEvents } from "@/services/events-service";
import { AthleteListRow, ServiceEvent } from "@/services/types";

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function daysUntil(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function trainingPhase(days: number): { label: string; tone: "positive" | "warning" | "danger" | "neutral" } {
  if (days < 0) return { label: "Pos-prova", tone: "neutral" };
  if (days <= 7) return { label: "Polimento", tone: "warning" };
  if (days <= 21) return { label: "Especifico", tone: "positive" };
  return { label: "Base", tone: "neutral" };
}

export default function CoachTreinosPage() {
  const { hydrated, accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AthleteListRow[]>([]);
  const [events, setEvents] = useState<ServiceEvent[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [athletesPayload, eventsPayload] = await Promise.all([
          getAthletesList({
            status: "ALL",
            sortBy: "nextEvent",
            sortDir: "asc",
            page: 1,
            pageSize: 100,
            accessToken,
          }),
          getAthleteEvents(accessToken),
        ]);
        if (!cancelled) {
          setAthletes(athletesPayload.data);
          setEvents(eventsPayload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar treinos.");
          setAthletes([]);
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, hydrated]);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === "PUBLISHED" && daysUntil(event.event_date) >= 0)
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
        .slice(0, 6),
    [events],
  );

  const activeAthletes = useMemo(() => athletes.filter((athlete) => athlete.status === "ACTIVE"), [athletes]);
  const pendingFinancial = useMemo(
    () => athletes.filter((athlete) => athlete.financialSituation === "PENDENTE"),
    [athletes],
  );

  const columns = useMemo<DataTableColumn<AthleteListRow>[]>(
    () => [
      {
        key: "athlete",
        header: "Atleta",
        cell: (row) => (
          <div>
            <p className="font-medium text-white">{row.name}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
        ),
      },
      { key: "next", header: "Proxima prova", cell: (row) => row.nextEventName ?? "Sem prova" },
      { key: "date", header: "Data", cell: (row) => formatDate(row.nextEventDate) },
      {
        key: "phase",
        header: "Fase sugerida",
        cell: (row) => {
          if (!row.nextEventDate) return <StatusBadge tone="neutral" label="Base" />;
          const phase = trainingPhase(daysUntil(row.nextEventDate));
          return <StatusBadge tone={phase.tone} label={phase.label} />;
        },
      },
      {
        key: "finance",
        header: "Financeiro",
        cell: (row) => (
          <StatusBadge
            tone={row.financialSituation === "PENDENTE" ? "warning" : "positive"}
            label={row.financialSituation === "PENDENTE" ? "Pendente" : "Ok"}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treinos"
        subtitle="Organizacao tecnica por proxima prova, fase de preparacao e pendencias que afetam acompanhamento."
      />

      {loading ? (
        <LoadingState lines={5} />
      ) : error ? (
        <EmptyState title="Treinos indisponiveis" description={error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Atletas ativos" value={activeAthletes.length} />
            <MetricCard label="Com proxima prova" value={athletes.filter((item) => item.nextEventDate).length} />
            <MetricCard label="Pendencia financeira" value={pendingFinancial.length} tone="highlight" />
            <MetricCard label="Provas publicadas" value={upcomingEvents.length} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard title="Fila de acompanhamento" description="Base para priorizar conversa, ajuste de carga e prova-alvo">
              <DataTable columns={columns} data={athletes} getRowKey={(row) => row.id} />
            </SectionCard>

            <SectionCard title="Provas que guiam os treinos" description="Use a proximidade da prova para calibrar volume e intensidade">
              {upcomingEvents.length === 0 ? (
                <EmptyState title="Sem provas futuras" description="Publique provas para gerar referencias de treino." />
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map((event) => {
                    const remaining = daysUntil(event.event_date);
                    const phase = trainingPhase(remaining);
                    return (
                      <Link
                        key={event.id}
                        href="/coach/calendario"
                        className="block rounded-xl border border-white/10 bg-[#0f233d] p-3 transition hover:border-[#2e6399]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{event.name}</p>
                            <p className="mt-1 text-xs text-slate-300">
                              {formatDate(event.event_date)} - {event.city}/{event.state}
                            </p>
                          </div>
                          <StatusBadge tone={phase.tone} label={phase.label} />
                        </div>
                        <div className="mt-3 flex gap-3 text-xs text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {remaining} dias
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {event.registrations_count} inscritos
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
