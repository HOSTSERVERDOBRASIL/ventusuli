"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Banknote,
  Camera,
  ClipboardCheck,
  Megaphone,
  Shirt,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { getEventCockpit } from "@/services/event-cockpit-service";
import type { EventCockpitData } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function toneFromCockpitTone(
  tone: "done" | "warning" | "danger" | "neutral",
): "positive" | "warning" | "danger" | "neutral" {
  if (tone === "done") return "positive";
  return tone;
}

function toneFromChecklist(status: string): "positive" | "warning" | "neutral" {
  if (status === "done") return "positive";
  if (status === "attention") return "warning";
  return "neutral";
}

function checklistLabel(status: string): string {
  if (status === "done") return "Pronto";
  if (status === "attention") return "Atencao";
  return "Pendente";
}

function MetricTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-[#0f233d] p-3">
      <p className="truncate text-xs uppercase text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

export default function AdminEventoCockpitPage() {
  const params = useParams<{ id: string }>();
  const { accessToken } = useAuthToken();
  const [cockpit, setCockpit] = useState<EventCockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getEventCockpit(params.id, accessToken);
        if (!cancelled) setCockpit(payload);
      } catch (err) {
        if (!cancelled) {
          setCockpit(null);
          setError(err instanceof Error ? err.message : "Nao foi possivel carregar o cockpit.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, params.id]);

  const eventDate = useMemo(() => {
    if (!cockpit) return "";
    return format(new Date(cockpit.event.eventDate), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });
  }, [cockpit]);

  if (loading) return <LoadingState lines={6} />;

  if (!cockpit || error) {
    return (
      <EmptyState
        title="Cockpit indisponivel"
        description={error ?? "Nao foi possivel carregar a operacao desta prova."}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cockpit: ${cockpit.event.name}`}
        subtitle={`${eventDate} | ${cockpit.event.city ?? "Cidade pendente"}/${cockpit.event.state ?? "--"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ActionButton asChild intent="secondary">
              <Link href={`/admin/eventos/${cockpit.event.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Detalhes
              </Link>
            </ActionButton>
            <ActionButton asChild>
              <Link href={`/admin/eventos/${cockpit.event.id}/editar`}>Editar prova</Link>
            </ActionButton>
          </div>
        }
      />

      <SectionCard
        title="Visao operacional"
        description="Resumo vivo da prova, juntando inscricoes, pagamentos, presenca e agenda da assessoria."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Inscricoes"
            value={cockpit.metrics.registrations.total}
            detail={`${cockpit.metrics.registrations.confirmed} confirmadas | ${cockpit.metrics.registrations.conversionRate}% conversao`}
          />
          <MetricTile
            label="Receita paga"
            value={BRL.format(cockpit.metrics.financial.paidRevenueCents / 100)}
            detail={`${BRL.format(cockpit.metrics.financial.pendingRevenueCents / 100)} pendente`}
          />
          <MetricTile
            label="Presenca"
            value={`${cockpit.metrics.attendance.presenceRate}%`}
            detail={`${cockpit.metrics.attendance.present} presentes | ${cockpit.metrics.attendance.pending} pendentes`}
          />
          <MetricTile
            label="Lista da assessoria"
            value={cockpit.metrics.racePlan.total}
            detail={
              cockpit.metrics.racePlan.hasPlan
                ? `${cockpit.metrics.racePlan.interested} interessados`
                : "Ainda nao aberta"
            }
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Checklist da prova"
            description="Primeira versao calculada a partir dos dados existentes."
          >
            <div className="grid gap-2 md:grid-cols-2">
              {cockpit.checklist.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#071b31] p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-sky-200" />
                    <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                  </div>
                  <StatusBadge label={checklistLabel(item.status)} tone={toneFromChecklist(item.status)} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Inscritos recentes" description="Amostra operacional das inscricoes da prova.">
            {cockpit.registrations.length === 0 ? (
              <EmptyState title="Sem inscritos" description="Nenhuma inscricao criada para esta prova." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-white/10 bg-[#071b31]">
                {cockpit.registrations.map((registration) => (
                  <div
                    key={registration.id}
                    className="grid gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_130px_130px_130px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {registration.athleteName}
                      </p>
                      <p className="truncate text-xs text-slate-400">{registration.athleteEmail}</p>
                    </div>
                    <p className="text-xs font-semibold text-slate-200">{registration.distanceLabel}</p>
                    <StatusBadge
                      label={registration.status}
                      tone={toneFromCockpitTone(registration.tone)}
                    />
                    <p className="text-xs font-semibold text-slate-200">
                      {registration.paymentStatus ?? "Sem pagamento"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Lista da assessoria"
            description="Atletas que entraram pela agenda oficial da assessoria."
          >
            {!cockpit.racePlan ? (
              <EmptyState
                title="Agenda oficial ainda fechada"
                description="Abra esta prova na lista da assessoria para receber interesses dos atletas."
              />
            ) : cockpit.racePlan.participations.length === 0 ? (
              <EmptyState
                title="Nenhum atleta na lista"
                description="Quando atletas clicarem em Quero participar, eles aparecem aqui."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-white/10 bg-[#071b31]">
                {cockpit.racePlan.participations.map((participation) => (
                  <div
                    key={participation.id}
                    className="grid gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_150px_150px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {participation.athleteName}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {participation.athleteEmail}
                      </p>
                    </div>
                    <StatusBadge
                      label={participation.status}
                      tone={toneFromCockpitTone(participation.tone)}
                    />
                    <p className="text-xs font-semibold text-slate-200">
                      {participation.distanceLabel ?? "Distancia pendente"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Blocos conectados" description="Sinais dos modulos ao redor da prova.">
            <div className="grid gap-3">
              <MetricTile
                label="Inscricao coletiva"
                value={cockpit.metrics.collective.campaigns}
                detail={`${cockpit.metrics.collective.members} atletas em lotes`}
              />
              <MetricTile
                label="Patrocinadores"
                value={cockpit.metrics.sponsors.campaigns}
                detail="Campanhas vinculadas a esta prova"
              />
              <MetricTile
                label="Fotos"
                value={cockpit.metrics.media.photos}
                detail={`${cockpit.metrics.media.galleries} galerias vinculadas`}
              />
            </div>
          </SectionCard>

          <SectionCard title="Distancias" description="Capacidade e preco por percurso.">
            <div className="space-y-2">
              {cockpit.event.distances.map((distance) => (
                <div
                  key={distance.id}
                  className="rounded-lg border border-white/10 bg-[#071b31] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{distance.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{distance.distanceKm} km</p>
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {BRL.format(distance.priceCents / 100)}
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Vagas: {distance.maxSlots ?? "Ilimitado"} | Inscritos:{" "}
                    {distance.registeredCount}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Acoes sugeridas" description="Proximos atalhos operacionais.">
            <div className="grid gap-2">
              <ActionButton asChild intent="secondary" className="justify-start">
                <Link href={`/admin/eventos/${cockpit.event.id}#inscritos`}>
                  <Users className="mr-2 h-4 w-4" />
                  Revisar inscritos
                </Link>
              </ActionButton>
              <ActionButton asChild intent="secondary" className="justify-start">
                <Link href="/admin/avisos">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Criar comunicado
                </Link>
              </ActionButton>
              <ActionButton asChild intent="secondary" className="justify-start">
                <Link href="/admin/financeiro">
                  <Banknote className="mr-2 h-4 w-4" />
                  Abrir financeiro
                </Link>
              </ActionButton>
              <ActionButton asChild intent="secondary" className="justify-start">
                <Link href="/admin/fotos">
                  <Camera className="mr-2 h-4 w-4" />
                  Gerenciar fotos
                </Link>
              </ActionButton>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Resumo dos modulos" description="Leitura rapida para operacao e pos-prova.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-[#071b31] p-3">
            <Trophy className="h-5 w-5 text-amber-200" />
            <p className="mt-2 text-sm font-semibold text-white">Pontos pos-prova</p>
            <p className="mt-1 text-xs text-slate-400">Pronto para acionar quando a prova for finalizada.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#071b31] p-3">
            <Shirt className="h-5 w-5 text-sky-200" />
            <p className="mt-2 text-sm font-semibold text-white">Logistica e kits</p>
            <p className="mt-1 text-xs text-slate-400">Primeira versao usa checklist calculada.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#071b31] p-3">
            <Camera className="h-5 w-5 text-emerald-200" />
            <p className="mt-2 text-sm font-semibold text-white">Memoria da prova</p>
            <p className="mt-1 text-xs text-slate-400">Galerias vinculadas aparecem neste cockpit.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#071b31] p-3">
            <Sparkles className="h-5 w-5 text-fuchsia-200" />
            <p className="mt-2 text-sm font-semibold text-white">IA assistiva</p>
            <p className="mt-1 text-xs text-slate-400">Proximo passo: resumo operacional revisavel.</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
