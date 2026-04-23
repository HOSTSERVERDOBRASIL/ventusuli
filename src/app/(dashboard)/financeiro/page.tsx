"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { getRegistrations } from "@/services/registrations-service";
import { type Inscricao, useInscricoesStore } from "@/store/inscricoes";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

export default function FinanceiroAtletaPage() {
  const { accessToken } = useAuthToken();
  const inscricoes = useInscricoesStore((state) => state.inscricoes);
  const setInscricoes = useInscricoesStore((state) => state.setInscricoes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await getRegistrations(accessToken);
        if (!cancelled) setInscricoes(rows);
      } catch {
        if (!cancelled) {
          setError("Nao foi possivel carregar os lancamentos financeiros em tempo real.");
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

  const rows = useMemo(
    () =>
      [...inscricoes].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      ),
    [inscricoes],
  );

  const summary = useMemo(() => {
    const totalPago = rows
      .filter((item) => item.paymentStatus === "PAID")
      .reduce((sum, item) => sum + item.amountCents, 0);
    const totalPendente = rows
      .filter((item) => item.paymentStatus === "PENDING")
      .reduce((sum, item) => sum + item.amountCents, 0);
    const totalCancelado = rows
      .filter((item) => item.paymentStatus === "CANCELLED" || item.paymentStatus === "REFUNDED")
      .reduce((sum, item) => sum + item.amountCents, 0);
    return { totalPago, totalPendente, totalCancelado };
  }, [rows]);

  const columns: DataTableColumn<Inscricao>[] = [
    { key: "event", header: "Prova", cell: (row) => row.eventName, className: "min-w-[220px]" },
    {
      key: "distance",
      header: "Distancia",
      cell: (row) => row.distanceLabel,
      className: "min-w-[120px]",
    },
    {
      key: "amount",
      header: "Valor",
      cell: (row) => BRL.format(row.amountCents / 100),
      className: "min-w-[120px]",
    },
    {
      key: "status",
      header: "Status pagamento",
      cell: (row) => (
        <StatusBadge
          tone={PAYMENT_TONE[row.paymentStatus]}
          label={
            row.paymentStatus === "PAID"
              ? "Pago"
              : row.paymentStatus === "PENDING"
                ? "Pendente"
                : row.paymentStatus === "EXPIRED"
                  ? "Expirado"
                  : row.paymentStatus === "REFUNDED"
                    ? "Reembolsado"
                    : "Cancelado"
          }
        />
      ),
      className: "min-w-[170px]",
    },
    {
      key: "date",
      header: "Data da prova",
      cell: (row) => format(new Date(row.eventDate), "dd/MM/yyyy", { locale: ptBR }),
    },
    {
      key: "actions",
      header: "Ações",
      className: "min-w-[200px]",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.paymentStatus === "PENDING" ? (
            <ActionButton asChild size="sm">
              <Link
                href={`/provas/${row.eventId}/inscricao?distancia=${encodeURIComponent(row.distanceLabel)}`}
              >
                Pagar agora
              </Link>
            </ActionButton>
          ) : null}
          <ActionButton asChild size="sm" intent="secondary">
            <Link href="/minhas-inscricoes">Ver inscrição</Link>
          </ActionButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        subtitle="Visao financeira do atleta com cobrancas, pagamentos e historico."
        actions={
          <ActionButton asChild>
            <Link href="/minhas-inscricoes">Gerenciar inscricoes</Link>
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Total pago"
          value={BRL.format(summary.totalPago / 100)}
          tone="highlight"
        />
        <MetricCard label="Pendente" value={BRL.format(summary.totalPendente / 100)} />
        <MetricCard
          label="Cancelado / Reembolsado"
          value={BRL.format(summary.totalCancelado / 100)}
        />
      </div>

      <SectionCard title="Lancamentos financeiros" description="Registro consolidado por inscricao">
        {loading ? (
          <LoadingState lines={4} />
        ) : error ? (
          <EmptyState
            title="Financeiro indisponivel"
            description={error}
            action={
              <ActionButton onClick={() => setReloadKey((prev) => prev + 1)} intent="secondary">
                Tentar novamente
              </ActionButton>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sem lancamentos financeiros"
            description="Quando voce iniciar inscricoes, os valores aparecerao aqui."
          />
        ) : (
          <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
        )}
      </SectionCard>
    </div>
  );
}
