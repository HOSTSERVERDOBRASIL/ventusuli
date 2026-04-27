"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { getAthleteEvents } from "@/services/events-service";
import { ServiceEvent } from "@/services/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}

function daysUntil(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function eventTone(status: ServiceEvent["status"]): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PUBLISHED") return "positive";
  if (status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

export default function CoachCalendarioPage() {
  const { hydrated, accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ServiceEvent[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAthleteEvents(accessToken);
        if (!cancelled) setEvents(payload);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar calendario.");
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

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()),
    [events],
  );
  const upcoming = useMemo(
    () => sortedEvents.filter((event) => event.status === "PUBLISHED" && daysUntil(event.event_date) >= 0),
    [sortedEvents],
  );
  const next30 = useMemo(
    () => upcoming.filter((event) => daysUntil(event.event_date) <= 30),
    [upcoming],
  );

  const columns = useMemo<DataTableColumn<ServiceEvent>[]>(
    () => [
      {
        key: "event",
        header: "Prova",
        cell: (row) => (
          <div>
            <p className="font-medium text-white">{row.name}</p>
            <p className="text-xs text-slate-400">{row.city}/{row.state}</p>
          </div>
        ),
      },
      { key: "date", header: "Data", cell: (row) => formatDate(row.event_date) },
      {
        key: "status",
        header: "Status",
        cell: (row) => <StatusBadge tone={eventTone(row.status)} label={row.status} />,
      },
      { key: "deadline", header: "Inscricoes ate", cell: (row) => row.registration_deadline ? formatDate(row.registration_deadline) : "-" },
      { key: "registered", header: "Inscritos", cell: (row) => row.registrations_count },
      {
        key: "training",
        header: "Janela tecnica",
        cell: (row) => {
          const days = daysUntil(row.event_date);
          if (days < 0) return "Encerrada";
          if (days <= 7) return "Polimento";
          if (days <= 30) return "Bloco especifico";
          return "Base";
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario Tecnico"
        subtitle="Leitura das provas publicadas para planejamento do coach."
        actions={
          <Link
            href="/coach/treinos"
            className="rounded-xl border border-white/20 bg-[#0f1e35] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-[#153156]"
          >
            Ver treinos
          </Link>
        }
      />

      {loading ? (
        <LoadingState lines={5} />
      ) : error ? (
        <EmptyState title="Calendario indisponivel" description={error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Provas publicadas" value={upcoming.length} />
            <MetricCard label="Proximos 30 dias" value={next30.length} tone="highlight" />
            <MetricCard label="Total de inscritos" value={upcoming.reduce((total, event) => total + event.registrations_count, 0)} />
            <MetricCard label="Rascunhos/canceladas" value={events.length - upcoming.length} />
          </div>

          <SectionCard title="Agenda esportiva" description="Eventos que orientam comunicacao, treino e prioridades tecnicas">
            <DataTable columns={columns} data={sortedEvents} getRowKey={(row) => row.id} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
