"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { getAthletesList } from "@/services/athletes-service";
import { getAthleteEvents } from "@/services/events-service";
import { getNotices } from "@/services/notice-service";
import { AthleteListRow, NoticeItem, ServiceEvent } from "@/services/types";

function eventStatusLabel(status: ServiceEvent["status"]): string {
  if (status === "DRAFT") return "Rascunho";
  if (status === "PUBLISHED") return "Publicado";
  if (status === "CANCELLED") return "Cancelado";
  return "Finalizado";
}

function eventStatusTone(
  status: ServiceEvent["status"],
): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PUBLISHED") return "positive";
  if (status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

export default function CoachHomePage() {
  const { hydrated, accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AthleteListRow[]>([]);
  const [events, setEvents] = useState<ServiceEvent[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [athletesPayload, eventsPayload, noticesPayload] = await Promise.all([
          getAthletesList({
            status: "ALL",
            sortBy: "nextEvent",
            sortDir: "asc",
            page: 1,
            pageSize: 50,
            accessToken,
          }),
          getAthleteEvents(accessToken),
          getNotices({ accessToken, status: "PUBLISHED" }),
        ]);

        if (!cancelled) {
          setAthletes(athletesPayload.data);
          setEvents(eventsPayload);
          setNotices(noticesPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Falha ao carregar o painel do coach.",
          );
          setAthletes([]);
          setEvents([]);
          setNotices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  const pendingApproval = useMemo(
    () => athletes.filter((item) => item.status === "PENDING_APPROVAL").length,
    [athletes],
  );
  const blocked = useMemo(
    () => athletes.filter((item) => item.status === "BLOCKED").length,
    [athletes],
  );
  const pendingFinancial = useMemo(
    () => athletes.filter((item) => item.financialSituation === "PENDENTE").length,
    [athletes],
  );
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((item) => new Date(item.event_date).getTime() >= now && item.status === "PUBLISHED")
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 5);
  }, [events]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Coach"
        subtitle="Acompanhamento técnico da assessoria com foco em atletas, calendário esportivo e comunicação."
      />

      {loading ? (
        <LoadingState lines={5} />
      ) : errorMessage ? (
        <EmptyState title="Painel indisponível" description={errorMessage} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Atletas no acompanhamento" value={athletes.length} />
            <MetricCard label="Pendentes de aprovação" value={pendingApproval} tone="highlight" />
            <MetricCard label="Pendência financeira" value={pendingFinancial} />
            <MetricCard label="Bloqueados" value={blocked} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <SectionCard
              title="Fila técnica prioritária"
              description="Atletas que precisam de ação imediata do coach"
            >
              {athletes.length === 0 ? (
                <EmptyState
                  title="Sem atletas vinculados"
                  description="Quando houver atletas na assessoria, eles aparecerão aqui."
                />
              ) : (
                <div className="space-y-2.5">
                  {athletes
                    .filter(
                      (item) =>
                        item.status === "PENDING_APPROVAL" ||
                        item.financialSituation === "PENDENTE",
                    )
                    .slice(0, 6)
                    .map((athlete) => (
                      <Link
                        key={athlete.id}
                        href={`/coach/atletas`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0f233d] px-3 py-2.5 transition hover:border-[#2e6399]"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{athlete.name}</p>
                          <p className="text-xs text-slate-300">{athlete.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            tone={athlete.status === "PENDING_APPROVAL" ? "warning" : "neutral"}
                            label={
                              athlete.status === "PENDING_APPROVAL"
                                ? "Aprovação pendente"
                                : "Revisar"
                            }
                          />
                        </div>
                      </Link>
                    ))}
                  {athletes.filter(
                    (item) =>
                      item.status === "PENDING_APPROVAL" || item.financialSituation === "PENDENTE",
                  ).length === 0 ? (
                    <EmptyState
                      title="Sem pendências prioritárias"
                      description="A base está estável no momento."
                    />
                  ) : null}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Próximas provas publicadas"
              description="Agenda esportiva para orientar treinos e estratégia"
            >
              {upcomingEvents.length === 0 ? (
                <EmptyState
                  title="Sem provas próximas"
                  description="As próximas provas publicadas aparecerão nesta seção."
                />
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-white/10 bg-[#0f233d] px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{event.name}</p>
                        <StatusBadge
                          tone={eventStatusTone(event.status)}
                          label={eventStatusLabel(event.status)}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })} •{" "}
                        {event.city}/{event.state}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Comunicados recentes"
            description="Últimos avisos institucionais disponíveis para o coach"
          >
            {notices.length === 0 ? (
              <EmptyState
                title="Sem avisos publicados"
                description="Quando houver comunicados, eles serão listados aqui."
              />
            ) : (
              <div className="space-y-2.5">
                {notices.slice(0, 3).map((notice) => (
                  <Link
                    key={notice.id}
                    href="/coach/avisos"
                    className="block rounded-xl border border-white/10 bg-[#0f233d] px-3 py-2.5 transition hover:border-[#2e6399]"
                  >
                    <p className="text-sm font-semibold text-white">{notice.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{notice.body}</p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
