"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CopyPlus, Pencil, Rocket, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { ServiceEventRegistration, cancelAdminEvent, duplicateAdminEvent, getEventById, getEventRegistrations, publishAdminEvent } from "@/services/events-service";
import { ServiceEvent } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function toneFromStatus(status: string): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PUBLISHED" || status === "PAID" || status === "CONFIRMED") return "positive";
  if (status === "DRAFT" || status === "PENDING" || status === "PENDING_PAYMENT") return "warning";
  if (status === "CANCELLED" || status === "EXPIRED") return "danger";
  return "neutral";
}

export default function AdminEventoDetalhesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuthToken();
  const [event, setEvent] = useState<ServiceEvent | null>(null);
  const [registrations, setRegistrations] = useState<ServiceEventRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [eventPayload, registrationsPayload] = await Promise.all([
          getEventById(params.id, accessToken),
          getEventRegistrations(params.id, accessToken),
        ]);

        if (!cancelled) {
          setEvent(eventPayload);
          setRegistrations(registrationsPayload);
        }
      } catch {
        if (!cancelled) {
          setEvent(null);
          setRegistrations([]);
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

  const totalEstimatedRevenue = useMemo(
    () => registrations.reduce((sum, item) => sum + item.amount_cents, 0),
    [registrations],
  );

  const confirmedCount = useMemo(
    () => registrations.filter((item) => item.registration_status === "CONFIRMED").length,
    [registrations],
  );

  const pendingPayments = useMemo(
    () => registrations.filter((item) => item.payment_status === "PENDING").length,
    [registrations],
  );

  const registrationColumns: DataTableColumn<ServiceEventRegistration>[] = [
    { key: "athlete", header: "Atleta", cell: (row) => row.athlete_name, className: "min-w-[180px]" },
    { key: "email", header: "Email", cell: (row) => row.athlete_email, className: "min-w-[220px]" },
    { key: "distance", header: "Distância", cell: (row) => row.distance_label },
    {
      key: "registration_status",
      header: "Inscrição",
      cell: (row) => <StatusBadge tone={toneFromStatus(row.registration_status)} label={row.registration_status} />,
      className: "min-w-[140px]",
    },
    {
      key: "payment_status",
      header: "Pagamento",
      cell: (row) => <StatusBadge tone={toneFromStatus(row.payment_status)} label={row.payment_status} />,
      className: "min-w-[140px]",
    },
    { key: "amount", header: "Valor", cell: (row) => BRL.format(row.amount_cents / 100) },
    {
      key: "date",
      header: "Data",
      cell: (row) => format(new Date(row.registered_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      className: "min-w-[160px]",
    },
  ];

  if (loading) {
    return <LoadingState lines={5} />;
  }

  if (!event) {
    return <EmptyState title="Prova não encontrada" description="Não foi possível carregar os detalhes desta prova." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Prova: ${event.name}`}
        subtitle="Detalhes operacionais, performance de inscrições e situação financeira da prova."
        actions={
          <>
            <ActionButton asChild intent="secondary">
              <Link href={`/admin/eventos/${event.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Link>
            </ActionButton>
            {event.status === "DRAFT" ? (
              <ActionButton
                onClick={async () => {
                  try {
                    const updated = await publishAdminEvent(event.id, accessToken);
                    setEvent(updated);
                    toast.success("Prova publicada com sucesso.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Falha ao publicar prova.");
                  }
                }}
              >
                <Rocket className="mr-2 h-4 w-4" /> Publicar
              </ActionButton>
            ) : null}
            <ActionButton
              intent="secondary"
              onClick={async () => {
                try {
                  const duplicated = await duplicateAdminEvent(event.id, accessToken);
                  toast.success("Prova duplicada com sucesso.");
                  router.push(`/admin/eventos/${duplicated.id}/editar`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao duplicar prova.");
                }
              }}
            >
              <CopyPlus className="mr-2 h-4 w-4" /> Duplicar
            </ActionButton>
            <ActionButton
              intent="danger"
              onClick={async () => {
                try {
                  const updated = await cancelAdminEvent(event.id, accessToken);
                  setEvent(updated);
                  toast.success("Prova cancelada com sucesso.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao cancelar prova.");
                }
              }}
            >
              <XCircle className="mr-2 h-4 w-4" /> Cancelar
            </ActionButton>
          </>
        }
      />

      <SectionCard title="Resumo da prova" description="Visão executiva para decisão rápida">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">Status</p>
            <div className="mt-2"><StatusBadge tone={toneFromStatus(event.status)} label={event.status} /></div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">Data</p>
            <p className="mt-2 text-lg font-semibold text-white">{format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">Inscrições</p>
            <p className="mt-2 text-lg font-semibold text-white">{registrations.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">Confirmadas</p>
            <p className="mt-2 text-lg font-semibold text-white">{confirmedCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">Receita estimada</p>
            <p className="mt-2 text-lg font-semibold text-white">{BRL.format(totalEstimatedRevenue / 100)}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <p className="text-xs text-slate-300">Local</p>
            <p className="mt-1 text-sm font-semibold text-white">{event.city}/{event.state}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <p className="text-xs text-slate-300">Pendências de pagamento</p>
            <p className="mt-1 text-sm font-semibold text-white">{pendingPayments}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Distâncias da prova" description="Configuração comercial e operacional">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {event.distances.map((distance) => (
            <div key={distance.id ?? distance.label} className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
              <p className="text-sm font-semibold text-white">{distance.label}</p>
              <p className="mt-1 text-xs text-slate-300">{distance.distance_km} km</p>
              <p className="mt-2 text-sm font-semibold text-white">{BRL.format(distance.price_cents / 100)}</p>
              <p className="mt-1 text-xs text-slate-400">Vagas: {distance.max_slots ?? "Ilimitado"}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div id="inscritos">
        <SectionCard title="Inscritos" description="Controle de status de inscrição e pagamento">
          {registrations.length === 0 ? (
            <EmptyState title="Sem inscritos" description="Nenhum atleta inscrito nesta prova até o momento." />
          ) : (
            <DataTable columns={registrationColumns} data={registrations} getRowKey={(row) => row.registration_id} />
          )}
        </SectionCard>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton asChild intent="secondary">
          <Link href="/admin/eventos">
            <ArrowRight className="mr-2 h-4 w-4" /> Voltar para gestão de provas
          </Link>
        </ActionButton>
        <ActionButton asChild>
          <Link href={`/admin/eventos/${event.id}#inscritos`}>
            <Users className="mr-2 h-4 w-4" /> Ver inscritos
          </Link>
        </ActionButton>
      </div>
    </div>
  );
}
