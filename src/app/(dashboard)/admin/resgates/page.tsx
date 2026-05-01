"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, ClipboardList, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";

interface AdminRedemption {
  id: string;
  status: string;
  requestedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  pointsUsed: number;
  cashPaidCents: number;
  notes: string | null;
  user: { id: string; name: string | null; email: string | null };
  rewardItem: { id: string; name: string | null };
}

interface AdminRedemptionsResponse {
  data: AdminRedemption[];
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type RedemptionsTab = "overview" | "operation" | "delivered";

function toneByStatus(status: string): "positive" | "warning" | "danger" | "neutral" | "info" {
  if (status === "DELIVERED") return "positive";
  if (status === "APPROVED" || status === "SEPARATED") return "info";
  if (status === "PENDING_PAYMENT" || status === "REQUESTED") return "warning";
  if (status === "CANCELLED" || status === "PAYMENT_FAILED") return "danger";
  return "neutral";
}

function statusLabel(status: string): string {
  if (status === "REQUESTED") return "Solicitado";
  if (status === "PENDING_PAYMENT") return "Pagamento pendente";
  if (status === "APPROVED") return "Aprovado";
  if (status === "SEPARATED") return "Separado";
  if (status === "DELIVERED") return "Entregue";
  if (status === "CANCELLED") return "Cancelado";
  if (status === "PAYMENT_FAILED") return "Pagamento falhou";
  return status;
}

export default function AdminResgatesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminRedemption[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RedemptionsTab>("overview");

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/redemptions?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AdminRedemptionsResponse;
      if (!response.ok) throw new Error("redemptions_admin_unavailable");
      setRows(payload.data ?? []);
    } catch {
      toast.error("Nao foi possivel carregar os resgates administrativos.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [statusFilter]);

  const summary = useMemo(() => {
    const pending = rows.filter((row) => row.status === "PENDING_PAYMENT").length;
    const approved = rows.filter(
      (row) => row.status === "APPROVED" || row.status === "SEPARATED",
    ).length;
    const delivered = rows.filter((row) => row.status === "DELIVERED").length;
    return { pending, approved, delivered };
  }, [rows]);

  const tabs = useMemo<ModuleTabItem<RedemptionsTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Gestao",
        description: "Resumo de pedidos, pendencias e entregas.",
        icon: BarChart3,
        metricLabel: "Pendentes",
        metricValue: summary.pending,
        metricTone: summary.pending > 0 ? "warning" : "positive",
      },
      {
        key: "operation",
        label: "Operacao",
        audience: "Equipe",
        description: "Separar, entregar ou cancelar pedidos abertos.",
        icon: ClipboardList,
        metricLabel: "Em operacao",
        metricValue: summary.approved,
        metricTone: summary.approved > 0 ? "info" : "neutral",
      },
      {
        key: "delivered",
        label: "Entregues",
        audience: "Auditoria",
        description: "Pedidos finalizados e historico de entrega.",
        icon: PackageCheck,
        metricLabel: "Entregues",
        metricValue: summary.delivered,
        metricTone: "positive",
      },
    ],
    [summary],
  );

  const patchStatus = async (id: string, status: string) => {
    try {
      setUpdatingAction(`${id}:${status}`);
      const response = await fetch(`/api/admin/redemptions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("status_change_error");
      toast.success(`Status atualizado para ${statusLabel(status)}.`);
      await load();
    } catch {
      toast.error("Não foi possível atualizar o status do resgate.");
    } finally {
      setUpdatingAction(null);
    }
  };

  const columns: DataTableColumn<AdminRedemption>[] = [
    {
      key: "user",
      header: "Atleta",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.user.name ?? "Atleta"}</p>
          <p className="text-xs text-slate-400">{row.user.email ?? ""}</p>
        </div>
      ),
      className: "min-w-[220px]",
    },
    {
      key: "item",
      header: "Item",
      cell: (row) => row.rewardItem.name ?? "Item",
      className: "min-w-[180px]",
    },
    { key: "points", header: "Pontos", cell: (row) => `${row.pointsUsed} pts` },
    { key: "cash", header: "Dinheiro", cell: (row) => BRL.format(row.cashPaidCents / 100) },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge label={statusLabel(row.status)} tone={toneByStatus(row.status)} />
      ),
      className: "min-w-[150px]",
    },
    {
      key: "requestedAt",
      header: "Solicitado",
      cell: (row) => format(new Date(row.requestedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      className: "min-w-[170px]",
    },
    {
      key: "actions",
      header: "Fluxo",
      className: "min-w-[180px]",
      cell: (row) => (
        <div className="flex flex-nowrap gap-1.5">
          {row.status === "APPROVED" && (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#1E90FF]/30 bg-[#1E90FF]/10 px-2.5 text-[11px] font-semibold text-[#1E90FF] transition hover:bg-[#1E90FF]/20 whitespace-nowrap"
              disabled={updatingAction === `${row.id}:SEPARATED`}
              onClick={() => void patchStatus(row.id, "SEPARATED")}
            >
              Separar
            </button>
          )}
          {row.status === "SEPARATED" && (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#00C853]/30 bg-[#00C853]/10 px-2.5 text-[11px] font-semibold text-[#00C853] transition hover:bg-[#00C853]/20 whitespace-nowrap"
              disabled={updatingAction === `${row.id}:DELIVERED`}
              onClick={() => void patchStatus(row.id, "DELIVERED")}
            >
              Entregar
            </button>
          )}
          {row.status !== "DELIVERED" && row.status !== "CANCELLED" && (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#FF4444]/30 bg-[#FF4444]/10 px-2.5 text-[11px] font-semibold text-[#FF4444] transition hover:bg-[#FF4444]/20 whitespace-nowrap"
              disabled={updatingAction === `${row.id}:CANCELLED`}
              onClick={() => void patchStatus(row.id, "CANCELLED")}
            >
              Cancelar
            </button>
          )}
          {(row.status === "DELIVERED" || row.status === "CANCELLED") && (
            <span className="text-[11px] text-white/25">-</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resgates admin"
        subtitle="Operacao de separacao, entrega e cancelamento dos pedidos de recompensas."
        actions={
          <select
            className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-2 text-[13px] text-white"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">Todos</option>
            <option value="REQUESTED">Solicitado</option>
            <option value="PENDING_PAYMENT">Pagamento pendente</option>
            <option value="APPROVED">Aprovado</option>
            <option value="SEPARATED">Separado</option>
            <option value="DELIVERED">Entregue</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="PAYMENT_FAILED">Pagamento falhou</option>
          </select>
        }
      />

      <SectionCard
        title="Modulo de resgates"
        description="Separe acompanhamento, operacao e auditoria dos pedidos."
      >
        <ModuleTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            if (tab === "overview") setStatusFilter("ALL");
            if (tab === "operation") setStatusFilter("APPROVED");
            if (tab === "delivered") setStatusFilter("DELIVERED");
          }}
          columnsClassName="md:grid-cols-3"
        />
      </SectionCard>

      <div className={activeTab === "overview" ? "grid gap-3 sm:grid-cols-3" : "hidden"}>
        <MetricCard label="Pendentes de pagamento" value={String(summary.pending)} />
        <MetricCard label="Em operacao" value={String(summary.approved)} />
        <MetricCard label="Entregues" value={String(summary.delivered)} tone="highlight" />
      </div>

      <SectionCard
        className={activeTab === "operation" || activeTab === "delivered" ? undefined : "hidden"}
        title="Fila de resgates"
        description="Gerencie o status operacional do pedido ate a entrega final"
      >
        {loading ? (
          <LoadingState lines={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sem resgates"
            description="Nenhum pedido encontrado para os filtros atuais."
          />
        ) : (
          <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
        )}
      </SectionCard>
    </div>
  );
}
