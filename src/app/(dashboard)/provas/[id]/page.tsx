"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CircleCheck, Clock3, MapPin, Route, Users } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { StatusBadge } from "@/components/system/status-badge";
import { getEventById } from "@/services/events-service";
import { ServiceEvent } from "@/services/types";
import { useInscricoesStore } from "@/store/inscricoes";
import { UserRole } from "@/types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ProvaDetalhePage() {
  const params = useParams<{ id: string }>();
  const { accessToken, userRole } = useAuthToken();
  const canRegister = userRole === UserRole.ATHLETE;
  const inscricoes = useInscricoesStore((state) => state.inscricoes);
  const hydrate = useInscricoesStore((state) => state.hydrate);
  const [event, setEvent] = useState<ServiceEvent | null>(null);
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
        const payload = await getEventById(params.id, accessToken);
        if (!cancelled) setEvent(payload);
      } catch {
        if (!cancelled) {
          setEvent(null);
          setError("Nao foi possivel carregar os dados da prova selecionada.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, params.id, reloadKey]);

  const inscritosNaProva = useMemo(() => {
    if (!event) return [];
    return inscricoes.filter((item) => item.eventId === event.id && item.status !== "CANCELLED");
  }, [event, inscricoes]);

  const totals = useMemo(() => {
    if (!event) return { inscritos: 0, vagas: 0 };
    const inscritos = event.distances.reduce(
      (sum, distance) => sum + (distance.registered_count ?? 0),
      0,
    );
    const vagas = event.distances.reduce((sum, distance) => sum + (distance.max_slots ?? 0), 0);
    return { inscritos, vagas };
  }, [event]);

  if (loading) {
    return <LoadingState lines={5} />;
  }

  if (!event) {
    return (
      <EmptyState
        title="Prova nao encontrada"
        description={error ?? "Nao foi possivel carregar os dados da prova selecionada."}
        action={
          <ActionButton intent="secondary" onClick={() => setReloadKey((prev) => prev + 1)}>
            Tentar novamente
          </ActionButton>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhe da prova"
        subtitle="Visao completa de percurso, vagas e inscricao."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/provas">Voltar para provas</Link>
          </ActionButton>
        }
      />

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#17385e,#0f233d)] text-white shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
        <div className="relative h-56 bg-[radial-gradient(circle_at_16%_18%,rgba(245,166,35,0.3),transparent_36%),linear-gradient(120deg,#0F2743,#1E3A5F)]">
          <div className="absolute left-4 top-4">
            <EventStatusBadge status={event.status} />
          </div>
          <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-[#081627] to-transparent px-6 pb-6 pt-16">
            <h1 className="text-3xl font-extrabold tracking-tight">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-[#d4e5ff]">
              <p className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />{" "}
                {format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
              </p>
              <p className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {event.city}/{event.state}
              </p>
              <p className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {totals.inscritos} inscritos
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <SectionCard
          title="Distancias e inscricao"
          description="Selecione a modalidade ideal para seu ritmo"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {event.distances.map((distance) => {
              const remaining = (distance.max_slots ?? 0) - (distance.registered_count ?? 0);
              const isSoldOut = distance.max_slots ? remaining <= 0 : false;
              const isRegistered = inscritosNaProva.some(
                (item) => item.distanceLabel === distance.label,
              );

              return (
                <article
                  key={distance.label}
                  className="rounded-2xl border border-white/10 bg-[#0f233d] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{distance.label}</p>
                      <p className="text-xs text-[#9fc2ea]">
                        {currency.format(distance.price_cents / 100)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={isSoldOut ? "danger" : "info"}
                      label={isSoldOut ? "Esgotado" : "Disponivel"}
                    />
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-slate-200">
                    <p className="inline-flex items-center gap-1">
                      <Route className="h-4 w-4 text-[#8fb6e5]" /> Percurso oficial
                    </p>
                    <p className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4 text-[#8fb6e5]" />{" "}
                      {distance.max_slots
                        ? `Vagas restantes: ${Math.max(remaining, 0)}`
                        : "Vagas ilimitadas"}
                    </p>
                  </div>

                  <div className="mt-4">
                    {isRegistered ? (
                      <ActionButton disabled className="w-full" intent="secondary">
                        <CircleCheck className="mr-2 h-4 w-4" /> Inscricao confirmada
                      </ActionButton>
                    ) : isSoldOut ? (
                      <ActionButton disabled className="w-full" intent="secondary">
                        Esgotado
                      </ActionButton>
                    ) : !canRegister ? (
                      <ActionButton disabled className="w-full" intent="secondary">
                        Somente atleta pode se inscrever
                      </ActionButton>
                    ) : (
                      <ActionButton asChild className="w-full">
                        <Link
                          href={`/provas/${event.id}/inscricao?distancia=${encodeURIComponent(distance.label)}`}
                        >
                          Fazer inscricao
                        </Link>
                      </ActionButton>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Resumo rapido" description="Informacoes essenciais para decisao">
            <div className="space-y-2 text-sm text-slate-200">
              <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-[#91b7e3]">Distancias</p>
                <p className="mt-1 text-xl font-bold text-white">{event.distances.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-[#91b7e3]">Inscritos</p>
                <p className="mt-1 text-xl font-bold text-white">{totals.inscritos}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-[#91b7e3]">
                  Capacidade total
                </p>
                <p className="mt-1 text-xl font-bold text-white">
                  {totals.vagas > 0 ? totals.vagas : "Ilimitada"}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Janela de inscricao"
            description="Planeje seu pagamento e confirmacao"
          >
            <p className="inline-flex items-center gap-1 text-sm text-slate-200">
              <Clock3 className="h-4 w-4 text-[#8fb6e5]" />
              Encerramento:{" "}
              {event.registration_deadline
                ? format(new Date(event.registration_deadline), "dd/MM/yyyy", { locale: ptBR })
                : "Sem prazo definido"}
            </p>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Descricao da prova" description="Contexto do evento e proposta esportiva">
        <p className="text-sm leading-relaxed text-slate-200">
          {event.description ??
            "Prova com percurso urbano, estrutura de apoio e experiencia completa para atletas de diferentes niveis."}
        </p>
      </SectionCard>
    </div>
  );
}
