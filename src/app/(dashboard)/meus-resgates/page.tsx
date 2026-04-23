"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PixQrCode } from "@/components/payment/pix-qrcode";
import { ActionButton } from "@/components/system/action-button";
import { DataTable, type DataTableColumn } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { Modal } from "@/components/system/modal";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";

interface RedemptionRow {
  id: string;
  status: string;
  requestedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  pointsUsed: number;
  cashPaidCents: number;
  rewardItem: {
    name: string | null;
    imageUrl: string | null;
    category: string | null;
  };
}

interface RedemptionsResponse {
  data: RedemptionRow[];
  total: number;
  page: number;
  totalPages: number;
}

interface RedemptionPaymentData {
  redemptionId: string;
  rewardItemName: string | null;
  status: string;
  amountCents: number;
  paymentId: string;
  expiresAt: string;
  pixCode: string;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function toneByStatus(status: string): "positive" | "warning" | "danger" | "neutral" | "info" {
  if (status === "DELIVERED") return "positive";
  if (status === "APPROVED" || status === "SEPARATED") return "info";
  if (status === "PENDING_PAYMENT" || status === "REQUESTED") return "warning";
  if (status === "CANCELLED" || status === "PAYMENT_FAILED") return "danger";
  return "neutral";
}

function labelByStatus(status: string): string {
  if (status === "REQUESTED") return "Solicitado";
  if (status === "PENDING_PAYMENT") return "Pendente";
  if (status === "APPROVED") return "Aprovado";
  if (status === "SEPARATED") return "Separado";
  if (status === "DELIVERED") return "Entregue";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "PAYMENT_FAILED") return "Falha no pagamento";
  return status;
}

export default function MeusResgatesPage() {
  const { accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RedemptionRow[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<RedemptionPaymentData | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const loadRedemptions = async (cancelledRef?: { current: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rewards/redemptions/me?page=1&limit=50", {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const payload = (await response.json()) as RedemptionsResponse;
      if (!response.ok) {
        const message = (payload as unknown as { error?: { message?: string } })?.error?.message;
        throw new Error(message ?? "Nao foi possivel carregar os resgates.");
      }
      if (!cancelledRef?.current) setRows(payload.data ?? []);
    } catch (error) {
      if (!cancelledRef?.current) {
        setRows([]);
        setError(error instanceof Error ? error.message : "Nao foi possivel carregar os resgates.");
      }
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelledRef = { current: false };

    void loadRedemptions(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [accessToken]);

  const openPaymentModal = async (redemptionId: string) => {
    setLoadingPayment(true);
    try {
      const response = await fetch(`/api/rewards/redemptions/${redemptionId}/payment`, {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const payload = (await response.json()) as {
        data?: RedemptionPaymentData;
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Nao foi possivel carregar o pagamento.");
      }

      setSelectedPayment(payload.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao abrir pagamento.");
    } finally {
      setLoadingPayment(false);
    }
  };

  const confirmPayment = async () => {
    if (!selectedPayment) return;
    setConfirmingPayment(true);
    try {
      const response = await fetch(
        `/api/rewards/redemptions/${selectedPayment.redemptionId}/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ action: "MARK_PAID" }),
        },
      );
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Nao foi possivel confirmar o pagamento.");
      }
      toast.success("Pagamento confirmado. Resgate aprovado com sucesso.");
      setSelectedPayment(null);
      await loadRedemptions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao confirmar pagamento.");
    } finally {
      setConfirmingPayment(false);
    }
  };

  const summary = useMemo(() => {
    const totalPoints = rows.reduce((sum, row) => sum + row.pointsUsed, 0);
    const totalCash = rows.reduce((sum, row) => sum + row.cashPaidCents, 0);
    const delivered = rows.filter((row) => row.status === "DELIVERED").length;
    return { totalPoints, totalCash, delivered };
  }, [rows]);

  const columns: DataTableColumn<RedemptionRow>[] = [
    {
      key: "item",
      header: "Item",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.rewardItem.name ?? "Item"}</p>
          <p className="text-xs text-slate-400">{row.rewardItem.category ?? "Sem categoria"}</p>
        </div>
      ),
      className: "min-w-[220px]",
    },
    { key: "points", header: "Pontos", cell: (row) => `${row.pointsUsed} pts` },
    { key: "cash", header: "Dinheiro", cell: (row) => BRL.format(row.cashPaidCents / 100) },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <div className="space-y-2">
          <StatusBadge label={labelByStatus(row.status)} tone={toneByStatus(row.status)} />
          {row.status === "PENDING_PAYMENT" ? (
            <ActionButton
              intent="secondary"
              className="h-8 text-xs"
              onClick={() => void openPaymentModal(row.id)}
            >
              Pagar pendencia
            </ActionButton>
          ) : null}
        </div>
      ),
      className: "min-w-[160px]",
    },
    {
      key: "requestedAt",
      header: "Solicitado em",
      cell: (row) => format(new Date(row.requestedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      className: "min-w-[180px]",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus resgates"
        subtitle="Historico completo de recompensas solicitadas e entregues."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Pontos utilizados"
          value={`${summary.totalPoints} pts`}
          tone="highlight"
        />
        <MetricCard label="Dinheiro pago" value={BRL.format(summary.totalCash / 100)} />
        <MetricCard label="Entregues" value={String(summary.delivered)} />
      </div>

      <SectionCard
        title="Timeline de resgates"
        description="Status atualizado da solicitacao ate a entrega"
      >
        {loading ? (
          <LoadingState lines={4} />
        ) : error ? (
          <EmptyState
            title="Resgates indisponíveis"
            description={error}
            action={
              <ActionButton intent="secondary" onClick={() => void loadRedemptions()}>
                Tentar novamente
              </ActionButton>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhum resgate encontrado"
            description="Quando voce solicitar recompensas, elas aparecerao aqui."
          />
        ) : (
          <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
        )}
      </SectionCard>

      <Modal
        open={Boolean(selectedPayment) || loadingPayment}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPayment(null);
            setLoadingPayment(false);
          }
        }}
        title={
          selectedPayment
            ? `Pagamento - ${selectedPayment.rewardItemName ?? "Resgate"}`
            : "Carregando pagamento"
        }
        description="Finalize o pagamento pendente para concluir seu resgate."
        footer={
          selectedPayment ? (
            <>
              <ActionButton intent="secondary" onClick={() => setSelectedPayment(null)}>
                Fechar
              </ActionButton>
              <ActionButton disabled={confirmingPayment} onClick={() => void confirmPayment()}>
                {confirmingPayment ? "Confirmando..." : "Ja paguei, confirmar"}
              </ActionButton>
            </>
          ) : null
        }
      >
        {loadingPayment || !selectedPayment ? (
          <LoadingState lines={4} />
        ) : (
          <div className="space-y-3">
            <StatusBadge
              label={labelByStatus(selectedPayment.status)}
              tone={toneByStatus(selectedPayment.status)}
            />
            <PixQrCode
              pixCode={selectedPayment.pixCode}
              expiresAt={new Date(selectedPayment.expiresAt)}
              amountLabel={BRL.format(selectedPayment.amountCents / 100)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
