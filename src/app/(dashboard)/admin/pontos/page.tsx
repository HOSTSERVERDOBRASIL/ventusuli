"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/system/action-button";
import { DataTable, type DataTableColumn } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

interface PointsReport {
  period: { start: string; end: string };
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalPointsExpired: number;
  activeUsersWithBalance: number;
  cashCollectedCents: number;
  redemptionsByCategory: Array<{
    category: string;
    count: number;
    pointsUsed: number;
    cashCollectedCents: number;
  }>;
  topItems: Array<{ rewardItemId: string; name: string; count: number }>;
  redemptionsByStatus: Array<{ status: string; count: number }>;
}

interface ExpiringWarning {
  userId: string;
  userName: string;
  userEmail: string;
  pointsExpiring: number;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function AdminPontosPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<PointsReport | null>(null);
  const [warnings, setWarnings] = useState<ExpiringWarning[]>([]);
  const [dateRange, setDateRange] = useState(defaultDateRange());
  const [recurrenceMonth, setRecurrenceMonth] = useState<number>(new Date().getMonth() + 1);
  const [recurrenceYear, setRecurrenceYear] = useState<number>(new Date().getFullYear());
  const [processingRecurrence, setProcessingRecurrence] = useState(false);
  const [processingExpiration, setProcessingExpiration] = useState(false);

  const loadReport = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error("Informe data inicial e final para carregar o relatório.");
      return;
    }
    if (dateRange.start > dateRange.end) {
      toast.error("A data inicial não pode ser maior que a data final.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: `${dateRange.start}T00:00:00.000Z`,
        endDate: `${dateRange.end}T23:59:59.999Z`,
      });

      const [reportResponse, warningsResponse] = await Promise.all([
        fetch(`/api/admin/points/report?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/points/expiring-warnings?daysAhead=30", { cache: "no-store" }),
      ]);

      const reportPayload = (await reportResponse.json()) as PointsReport;
      const warningsPayload = (await warningsResponse.json()) as { data?: ExpiringWarning[] };

      if (!reportResponse.ok) throw new Error("points_report_unavailable");

      setReport(reportPayload);
      setWarnings(warningsPayload.data ?? []);
    } catch {
      toast.error("Nao foi possivel carregar o painel de pontos.");
      setReport(null);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  const runRecurrence = async () => {
    try {
      if (recurrenceMonth < 1 || recurrenceMonth > 12) {
        toast.error("Informe um mês válido entre 1 e 12.");
        return;
      }
      if (recurrenceYear < 2000 || recurrenceYear > 2100) {
        toast.error("Informe um ano válido entre 2000 e 2100.");
        return;
      }

      setProcessingRecurrence(true);
      const response = await fetch("/api/admin/points/process-recurrence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: recurrenceMonth, year: recurrenceYear }),
      });
      if (!response.ok) throw new Error("recurrence_error");
      const payload = (await response.json()) as {
        monthly?: { credited?: number };
        quarterly?: { credited?: number };
      };
      toast.success(
        `Recorrência concluída. Mensal: ${payload.monthly?.credited ?? 0} | Trimestral: ${payload.quarterly?.credited ?? 0}.`,
      );
      await loadReport();
    } catch {
      toast.error("Falha ao processar bônus de recorrência.");
    } finally {
      setProcessingRecurrence(false);
    }
  };

  const runExpiration = async () => {
    try {
      setProcessingExpiration(true);
      const response = await fetch("/api/admin/points/process-expiration", { method: "POST" });
      if (!response.ok) throw new Error("expiration_error");
      const payload = (await response.json()) as { usersAffected?: number; pointsExpired?: number };
      toast.success(
        `Expiração concluída. Usuários afetados: ${payload.usersAffected ?? 0} | Pontos expirados: ${payload.pointsExpired ?? 0}.`,
      );
      await loadReport();
    } catch {
      toast.error("Falha ao processar expiração de pontos.");
    } finally {
      setProcessingExpiration(false);
    }
  };

  const topItemsColumns: DataTableColumn<PointsReport["topItems"][number]>[] = [
    { key: "name", header: "Item", cell: (row) => row.name, className: "min-w-[220px]" },
    { key: "count", header: "Resgates", cell: (row) => String(row.count) },
  ];

  const categoryColumns: DataTableColumn<PointsReport["redemptionsByCategory"][number]>[] = [
    {
      key: "category",
      header: "Categoria",
      cell: (row) => row.category,
      className: "min-w-[180px]",
    },
    { key: "count", header: "Resgates", cell: (row) => String(row.count) },
    { key: "points", header: "Pontos", cell: (row) => `${row.pointsUsed} pts` },
    { key: "cash", header: "Caixa", cell: (row) => BRL.format(row.cashCollectedCents / 100) },
  ];

  const warningColumns: DataTableColumn<ExpiringWarning>[] = [
    {
      key: "user",
      header: "Atleta",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.userName}</p>
          <p className="text-xs text-slate-400">{row.userEmail}</p>
        </div>
      ),
      className: "min-w-[220px]",
    },
    { key: "points", header: "Pontos a expirar", cell: (row) => `${row.pointsExpiring} pts` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pontos admin"
        subtitle="Relatorios, recorrencia e expiracao do programa de recompensas."
        actions={
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void loadReport();
            }}
          >
            <input
              type="date"
              value={dateRange.start}
              onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
              className="rounded-lg border border-white/20 bg-[#0f2743] px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
              className="rounded-lg border border-white/20 bg-[#0f2743] px-3 py-2 text-sm text-white"
            />
            <ActionButton intent="secondary" type="submit">
              Atualizar
            </ActionButton>
          </form>
        }
      />

      {loading || !report ? (
        <LoadingState lines={6} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Pontos emitidos"
              value={`${report.totalPointsIssued} pts`}
              tone="highlight"
            />
            <MetricCard label="Pontos resgatados" value={`${report.totalPointsRedeemed} pts`} />
            <MetricCard label="Pontos expirados" value={`${report.totalPointsExpired} pts`} />
            <MetricCard label="Usuarios com saldo" value={String(report.activeUsersWithBalance)} />
            <MetricCard
              label="Caixa de resgates"
              value={BRL.format(report.cashCollectedCents / 100)}
            />
          </div>

          <SectionCard
            title="Automacoes"
            description="Dispare recorrencia mensal/trimestral e expiracao quando necessario"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#0c1f35] p-3">
                <p className="text-sm text-slate-200">Processar recorrencia</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={recurrenceMonth}
                    onChange={(event) => setRecurrenceMonth(Number(event.target.value))}
                    className="w-24 rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={recurrenceYear}
                    onChange={(event) => setRecurrenceYear(Number(event.target.value))}
                    className="w-28 rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                  />
                  <ActionButton
                    disabled={processingRecurrence}
                    onClick={() => void runRecurrence()}
                  >
                    {processingRecurrence ? "Processando..." : "Processar"}
                  </ActionButton>
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#0c1f35] p-3">
                <p className="text-sm text-slate-200">Processar expiracao</p>
                <ActionButton
                  intent="secondary"
                  disabled={processingExpiration}
                  onClick={() => void runExpiration()}
                >
                  {processingExpiration ? "Processando..." : "Rodar expiração agora"}
                </ActionButton>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Resgates por categoria"
              description="Performance comercial por classe de recompensa"
            >
              {report.redemptionsByCategory.length === 0 ? (
                <EmptyState
                  title="Sem dados"
                  description="Nenhum resgate no periodo selecionado."
                />
              ) : (
                <DataTable
                  columns={categoryColumns}
                  data={report.redemptionsByCategory}
                  getRowKey={(row) => row.category}
                />
              )}
            </SectionCard>

            <SectionCard title="Top itens" description="Itens com maior volume de resgate">
              {report.topItems.length === 0 ? (
                <EmptyState
                  title="Sem dados"
                  description="Nenhum item resgatado no periodo selecionado."
                />
              ) : (
                <DataTable
                  columns={topItemsColumns}
                  data={report.topItems}
                  getRowKey={(row) => row.rewardItemId}
                />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Avisos de expiracao"
            description="Usuarios com pontos prestes a expirar (30 dias)"
          >
            {warnings.length === 0 ? (
              <EmptyState title="Sem avisos" description="Nenhum usuario com expiracao proxima." />
            ) : (
              <DataTable columns={warningColumns} data={warnings} getRowKey={(row) => row.userId} />
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
