"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CircleCheck, Clock3, Handshake, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { Modal } from "@/components/system/modal";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import {
  cancelRegistration,
  confirmRegistrationPayment,
  getRegistrations,
  markRegistrationInterested,
} from "@/services/registrations-service";
import { type Inscricao, useInscricoesStore } from "@/store/inscricoes";
import { UserRole } from "@/types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<Inscricao["status"], string> = {
  CONFIRMED: "Confirmada",
  PENDING_PAYMENT: "Aguardando pagamento",
  INTERESTED: "Interesse",
  CANCELLED: "Cancelada",
};

const PAYMENT_LABEL: Record<Inscricao["paymentStatus"], string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
};

const STATUS_TONE: Record<Inscricao["status"], "positive" | "warning" | "info" | "danger"> = {
  CONFIRMED: "positive",
  PENDING_PAYMENT: "warning",
  INTERESTED: "info",
  CANCELLED: "danger",
};

const PAYMENT_TONE: Record<
  Inscricao["paymentStatus"],
  "positive" | "warning" | "danger" | "neutral"
> = {
  PAID: "positive",
  PENDING: "warning",
  EXPIRED: "danger",
  REFUNDED: "neutral",
  CANCELLED: "danger",
};

export default function MinhasInscricoesPage() {
  const { accessToken, userRole } = useAuthToken();
  const canPay = userRole === UserRole.ATHLETE;
  const inscricoes = useInscricoesStore((state) => state.inscricoes);
  const setInscricoes = useInscricoesStore((state) => state.setInscricoes);
  const hydrate = useInscricoesStore((state) => state.hydrate);
  const upsertInscricao = useInscricoesStore((state) => state.upsertInscricao);
  const [cancelTarget, setCancelTarget] = useState<Inscricao | null>(null);
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
        const rows = await getRegistrations(accessToken);
        if (!cancelled) {
          setInscricoes(rows);
        }
      } catch {
        if (!cancelled) {
          setError("Nao foi possivel carregar inscricoes em tempo real.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, setInscricoes, reloadKey]);

  const sortedRows = useMemo(
    () =>
      [...inscricoes].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      ),
    [inscricoes],
  );

  const btnBase =
    "inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition whitespace-nowrap";
  const btnDefault = `${btnBase} border border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.09] hover:text-white`;
  const btnPrimary = `${btnBase} bg-[#1E90FF] text-white hover:brightness-110`;
  const btnDanger = `${btnBase} border border-[#FF4444]/30 bg-[#FF4444]/10 text-[#FF4444] hover:bg-[#FF4444]/20`;

  const columns: DataTableColumn<Inscricao>[] = [
    {
      key: "event",
      header: "Prova",
      className: "min-w-[180px]",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.eventName}</p>
          <p className="text-[11px] text-white/40">{row.distanceLabel}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Data",
      className: "min-w-[90px]",
      cell: (row) => (
        <span className="text-[12px]">
          {format(new Date(row.eventDate), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-[130px]",
      cell: (row) => (
        <StatusBadge tone={STATUS_TONE[row.status]} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "payment",
      header: "Pagamento",
      className: "min-w-[140px]",
      cell: (row) => (
        <div className="space-y-1">
          <StatusBadge
            tone={PAYMENT_TONE[row.paymentStatus]}
            label={PAYMENT_LABEL[row.paymentStatus]}
          />
          <p className="text-[11px] text-white/40">{currency.format(row.amountCents / 100)}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "min-w-[220px]",
      cell: (row) => {
        if (row.status === "CONFIRMED") {
          return (
            <div className="flex flex-nowrap gap-1.5">
              <span
                className={`${btnBase} border border-[#00C853]/30 bg-[#00C853]/10 text-[#00C853]`}
              >
                <CircleCheck className="h-3.5 w-3.5" /> Confirmada
              </span>
              <button type="button" className={btnDanger} onClick={() => setCancelTarget(row)}>
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          );
        }
        if (row.status === "PENDING_PAYMENT") {
          return (
            <div className="flex flex-nowrap gap-1.5">
              <button
                type="button"
                className={btnPrimary}
                onClick={async () => {
                  try {
                    const updated = await confirmRegistrationPayment(row, accessToken);
                    upsertInscricao(updated);
                    toast.success("Pagamento confirmado.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível confirmar o pagamento.",
                    );
                  }
                }}
              >
                <Clock3 className="h-3.5 w-3.5" /> Confirmar
              </button>
              {canPay && (
                <Link
                  href={`/provas/${row.eventId}/inscricao?distancia=${encodeURIComponent(row.distanceLabel)}`}
                  className={btnDefault}
                >
                  Pagar
                </Link>
              )}
              <button type="button" className={btnDanger} onClick={() => setCancelTarget(row)}>
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          );
        }
        if (row.status === "INTERESTED") {
          return (
            <div className="flex flex-nowrap gap-1.5">
              <Link
                href={`/provas/${row.eventId}/inscricao?distancia=${encodeURIComponent(row.distanceLabel)}`}
                className={btnPrimary}
              >
                <Handshake className="h-3.5 w-3.5" /> Participar
              </Link>
              <button type="button" className={btnDanger} onClick={() => setCancelTarget(row)}>
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          );
        }
        return (
          <button
            type="button"
            className={btnDefault}
            onClick={async () => {
              try {
                const updated = await markRegistrationInterested(row, accessToken);
                upsertInscricao(updated);
                toast.success("Inscrição marcada como interesse.");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Não foi possível alterar o status.",
                );
              }
            }}
          >
            <Handshake className="h-3.5 w-3.5" /> Interesse
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas inscrições"
        subtitle="Simule e acompanhe o ciclo completo: interesse, pagamento, confirmação e cancelamento."
        actions={
          <ActionButton asChild>
            <Link href="/provas">Participar de uma prova</Link>
          </ActionButton>
        }
      />

      <SectionCard title="Histórico" description="Atualização visual em tempo real">
        {loading ? (
          <div className="space-y-2">
            <div className="surface-shimmer h-12 rounded-xl" />
            <div className="surface-shimmer h-12 rounded-xl" />
            <div className="surface-shimmer h-12 rounded-xl" />
          </div>
        ) : error ? (
          <EmptyState
            title="Inscricoes indisponiveis"
            description={error}
            action={
              <ActionButton onClick={() => setReloadKey((prev) => prev + 1)} intent="secondary">
                Tentar novamente
              </ActionButton>
            }
          />
        ) : sortedRows.length === 0 ? (
          <EmptyState
            title="Você ainda não possui inscrições"
            description="Acesse provas e simule sua primeira inscrição em poucos cliques."
            action={
              <ActionButton asChild>
                <Link href="/provas">Ver provas</Link>
              </ActionButton>
            }
          />
        ) : (
          <DataTable columns={columns} data={sortedRows} getRowKey={(row) => row.id} />
        )}
      </SectionCard>

      <Modal
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancelar inscrição"
        description={`Deseja cancelar a inscrição em ${cancelTarget?.eventName ?? ""}?`}
        footer={
          <>
            <ActionButton intent="secondary" onClick={() => setCancelTarget(null)}>
              Voltar
            </ActionButton>
            <ActionButton
              intent="danger"
              onClick={async () => {
                if (!cancelTarget) return;
                try {
                  const updated = await cancelRegistration(cancelTarget, accessToken);
                  upsertInscricao(updated);
                  toast.success("Inscrição cancelada com sucesso.");
                  setCancelTarget(null);
                } catch {
                  toast.error("Não foi possível cancelar a inscrição.");
                }
              }}
            >
              Confirmar cancelamento
            </ActionButton>
          </>
        }
      />
    </div>
  );
}
