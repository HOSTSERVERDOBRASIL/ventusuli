"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveAthlete,
  blockAthlete,
  createAthleteCharge,
  enrollAthleteInEvent,
  getAthleteDetail,
  rejectAthlete,
  saveAthleteInternalNote,
  updateAthlete,
} from "@/services/athletes-service";
import { getAdminEvents } from "@/services/events-service";
import { AthleteDetail, ServiceEvent } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function toneFromStatus(status: string): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PAID" || status === "CONFIRMED" || status === "PUBLISHED" || status === "ACTIVE")
    return "positive";
  if (status === "PENDING" || status === "PENDING_PAYMENT" || status === "DRAFT" || status === "PENDING_APPROVAL")
    return "warning";
  if (status === "CANCELLED" || status === "EXPIRED" || status === "REJECTED" || status === "BLOCKED")
    return "danger";
  return "neutral";
}

function athleteStatusLabel(status: AthleteDetail["profile"]["athleteStatus"]): string {
  if (status === "ACTIVE") return "Ativo";
  if (status === "PENDING_APPROVAL") return "Pendente";
  if (status === "REJECTED") return "Rejeitado";
  return "Bloqueado";
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AtletaDetalhePage() {
  const params = useParams<{ id: string }>();
  const { accessToken } = useAuthToken();

  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
  const [events, setEvents] = useState<ServiceEvent[]>([]);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDistanceId, setSelectedDistanceId] = useState("");
  const [selectedRegistrationToCharge, setSelectedRegistrationToCharge] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const loadData = async () => {
    const [detail, eventsPayload] = await Promise.all([
      getAthleteDetail(params.id, accessToken),
      getAdminEvents(accessToken),
    ]);

    setAthlete(detail);
    setEvents(eventsPayload.filter((item) => item.status === "PUBLISHED"));

    setEditName(detail.name);
    setEditEmail(detail.email);
    setEditCpf(detail.profile.cpf ?? "");
    setEditPhone(detail.profile.phone ?? "");
    setEditCity(detail.profile.city ?? "");
    setEditState(detail.profile.state ?? "");
    setInternalNote(detail.profile.internalNote ?? "");

    const firstEvent = eventsPayload.find((item) => item.status === "PUBLISHED");
    setSelectedEventId(firstEvent?.id ?? "");
    setSelectedDistanceId(firstEvent?.distances[0]?.id ?? "");

    const pendingRegistration = detail.registrations.find(
      (registration) => registration.payment?.status !== "PAID",
    );
    setSelectedRegistrationToCharge(pendingRegistration?.id ?? "");
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        await loadData();
      } catch {
        if (!cancelled) setAthlete(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, params.id]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const chargeOptions = useMemo(
    () =>
      (athlete?.registrations ?? []).filter((registration) => registration.payment?.status !== "PAID"),
    [athlete?.registrations],
  );

  const historyColumns: DataTableColumn<NonNullable<AthleteDetail>["registrations"][number]>[] = [
    {
      key: "event",
      header: "Prova",
      className: "min-w-[220px]",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.event.name}</p>
          <p className="text-xs text-slate-300">{format(new Date(row.event.eventDate), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
      ),
    },
    { key: "distance", header: "Distância", cell: (row) => row.distance.label },
    {
      key: "registrationStatus",
      header: "Inscrição",
      cell: (row) => <StatusBadge tone={toneFromStatus(row.status)} label={row.status} />,
      className: "min-w-[130px]",
    },
    {
      key: "paymentStatus",
      header: "Pagamento",
      cell: (row) =>
        row.payment ? <StatusBadge tone={toneFromStatus(row.payment.status)} label={row.payment.status} /> : "-",
      className: "min-w-[130px]",
    },
    {
      key: "amount",
      header: "Valor",
      cell: (row) => BRL.format((row.payment?.amountCents ?? row.distance.priceCents) / 100),
    },
    {
      key: "registeredAt",
      header: "Data",
      className: "min-w-[140px]",
      cell: (row) => format(new Date(row.registeredAt), "dd/MM/yyyy", { locale: ptBR }),
    },
  ];

  if (loading) {
    return <LoadingState lines={6} />;
  }

  if (!athlete) {
    return (
      <EmptyState
        title="Atleta não encontrado"
        description="Não foi possível carregar os dados do atleta."
      />
    );
  }

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        title={`Atleta: ${athlete.name}`}
        subtitle="CRM esportivo com visão de perfil, inscrições, financeiro e ações operacionais."
        actions={
          <>
            <ActionButton asChild intent="secondary">
              <Link href={`/admin/financeiro?status=PENDING&athlete=${encodeURIComponent(athlete.name)}`}>
                Ver cobranças
              </Link>
            </ActionButton>
            <ActionButton asChild intent="secondary">
              <Link href="/admin/atletas">Voltar para lista</Link>
            </ActionButton>
          </>
        }
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#152a45,#0f2138)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {athlete.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={athlete.avatarUrl}
              alt={`Foto de ${athlete.name}`}
              className="h-20 w-20 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0F2743] text-2xl font-bold text-[#F5A623]">
              {initialsFromName(athlete.name)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Nome completo
            </p>
            <h2 className="mt-1 break-words text-2xl font-bold text-white">{athlete.name}</h2>
            <p className="mt-1 break-words text-sm text-slate-300">{athlete.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <StatusBadge
            tone={toneFromStatus(athlete.profile.athleteStatus)}
            label={athleteStatusLabel(athlete.profile.athleteStatus)}
          />
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">
            {athlete.profile.memberNumber ?? "Sem matrícula"}
          </span>
          {(athlete.profile.city || athlete.profile.state) ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200">
              {[athlete.profile.city, athlete.profile.state].filter(Boolean).join(" - ")}
            </span>
          ) : null}
        </div>
      </section>

      {athlete.profile.athleteStatus === "PENDING_APPROVAL" && (
        <div
          id="athlete-approval"
          className="flex items-center justify-between gap-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4"
        >
          <div>
            <p className="font-semibold text-amber-200">Cadastro aguardando aprovação</p>
            <p className="mt-0.5 text-sm text-amber-300/80">
              Este atleta se cadastrou mas ainda não foi aprovado. Enquanto pendente, não pode realizar inscrições.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={async () => {
                try {
                  await approveAthlete(athlete.id, accessToken);
                  toast.success("Atleta aprovado com sucesso.");
                  await loadData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao aprovar atleta.");
                }
              }}
            >
              Aprovar atleta
            </ActionButton>
            <ActionButton
              intent="secondary"
              onClick={async () => {
                try {
                  await rejectAthlete(athlete.id, accessToken);
                  toast.success("Atleta rejeitado.");
                  await loadData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao rejeitar atleta.");
                }
              }}
            >
              Rejeitar
            </ActionButton>
          </div>
        </div>
      )}

      {athlete.profile.athleteStatus === "ACTIVE" ? (
        <div className="flex justify-end">
          <ActionButton
            intent="secondary"
            onClick={async () => {
              try {
                await blockAthlete(athlete.id, accessToken);
                toast.success("Atleta bloqueado.");
                await loadData();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Falha ao bloquear atleta.");
              }
            }}
          >
            Bloquear atleta
          </ActionButton>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-300">Inscrições</p>
          <p className="mt-2 text-2xl font-bold text-white">{athlete.summary.registrationsCount}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-300">Pendente</p>
          <p className="mt-2 text-2xl font-bold text-white">{BRL.format(athlete.summary.pendingAmountCents / 100)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-300">Pago</p>
          <p className="mt-2 text-2xl font-bold text-white">{BRL.format(athlete.summary.paidAmountCents / 100)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-300">Próxima prova</p>
          <p className="mt-2 text-sm font-semibold text-white">{athlete.summary.nextEventName ?? "Sem prova futura"}</p>
          {athlete.summary.nextEventDate ? (
            <p className="text-xs text-slate-300">{format(new Date(athlete.summary.nextEventDate), "dd/MM/yyyy", { locale: ptBR })}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div id="athlete-edit">
        <SectionCard title="Editar atleta" description="Atualize dados principais do corredor">
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Nome" className="border-white/15 bg-[#0F2743] text-white" />
            <Input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} placeholder="Email" className="border-white/15 bg-[#0F2743] text-white" />
            <Input value={editCpf} onChange={(event) => setEditCpf(event.target.value)} placeholder="CPF" className="border-white/15 bg-[#0F2743] text-white" />
            <Input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="Telefone" className="border-white/15 bg-[#0F2743] text-white" />
            <Input value={editCity} onChange={(event) => setEditCity(event.target.value)} placeholder="Cidade" className="border-white/15 bg-[#0F2743] text-white" />
            <Input value={editState} onChange={(event) => setEditState(event.target.value)} placeholder="UF" className="border-white/15 bg-[#0F2743] text-white" />
          </div>
          <div className="mt-3">
            <ActionButton
              onClick={async () => {
                try {
                  await updateAthlete(
                    athlete.id,
                    {
                      name: editName,
                      email: editEmail,
                      cpf: editCpf || null,
                      phone: editPhone || null,
                      city: editCity || null,
                      state: editState || null,
                    },
                    accessToken,
                  );
                  toast.success("Atleta atualizado com sucesso.");
                  await loadData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao atualizar atleta.");
                }
              }}
            >
              Salvar alterações
            </ActionButton>
          </div>
        </SectionCard>
        </div>

        <SectionCard title="Inscrever em prova" description="Crie nova inscricao para o atleta">
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              value={selectedEventId}
              onChange={(event) => {
                const nextEventId = event.target.value;
                setSelectedEventId(nextEventId);
                const nextEvent = events.find((item) => item.id === nextEventId);
                setSelectedDistanceId(nextEvent?.distances[0]?.id ?? "");
              }}
              className="border-white/15 bg-[#0F2743] text-white"
            >
              <option value="">Selecione a prova</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </Select>

            <Select
              value={selectedDistanceId}
              onChange={(event) => setSelectedDistanceId(event.target.value)}
              className="border-white/15 bg-[#0F2743] text-white"
            >
              <option value="">Selecione a distância</option>
              {(selectedEvent?.distances ?? []).map((distance) => (
                <option key={distance.id} value={distance.id}>
                  {distance.label} - {BRL.format(distance.price_cents / 100)}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-3">
            <ActionButton
              disabled={!selectedEventId || !selectedDistanceId}
              onClick={async () => {
                try {
                  await enrollAthleteInEvent(
                    athlete.id,
                    { eventId: selectedEventId, distanceId: selectedDistanceId },
                    accessToken,
                  );
                  toast.success("Atleta inscrito com sucesso.");
                  await loadData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao inscrever atleta.");
                }
              }}
            >
              Inscrever atleta
            </ActionButton>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Cobrar" description="Gere ou atualize cobrança para inscrições não pagas">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Select
              value={selectedRegistrationToCharge}
              onChange={(event) => setSelectedRegistrationToCharge(event.target.value)}
              className="border-white/15 bg-[#0F2743] text-white"
            >
              <option value="">Selecione a inscricao</option>
              {chargeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.event.name} - {item.distance.label} ({item.payment?.status ?? "SEM_PAGAMENTO"})
                </option>
              ))}
            </Select>
            <ActionButton
              disabled={!selectedRegistrationToCharge}
              onClick={async () => {
                try {
                  await createAthleteCharge(athlete.id, selectedRegistrationToCharge, accessToken);
                  toast.success("Cobranca gerada com sucesso.");
                  await loadData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao gerar cobrança.");
                }
              }}
            >
              Cobrar
            </ActionButton>
          </div>
        </SectionCard>

        <SectionCard title="Observação interna" description="Registre contexto de atendimento e acompanhamento">
          <Textarea
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            className="min-h-28 border-white/15 bg-[#0F2743] text-white"
            placeholder="Escreva observações internas sobre o atleta..."
          />
          <div className="mt-3">
            <ActionButton
              onClick={async () => {
                try {
                  await saveAthleteInternalNote(athlete.id, internalNote, accessToken);
                  toast.success("Observacao interna salva.");
                  await loadData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Falha ao salvar observação.");
                }
              }}
            >
              Salvar observação
            </ActionButton>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Histórico" description="Inscrições e pagamentos do atleta">
        {athlete.registrations.length === 0 ? (
          <EmptyState title="Sem histórico" description="Este atleta ainda não possui inscrições registradas." />
        ) : (
          <DataTable columns={historyColumns} data={athlete.registrations} getRowKey={(row) => row.id} />
        )}
      </SectionCard>
    </div>
  );
}
