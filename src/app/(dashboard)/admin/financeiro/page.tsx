"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Copy, Download, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { PixQrCode } from "@/components/payment/pix-qrcode";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { Modal } from "@/components/system/modal";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  cancelPayment,
  getPaymentDetail,
  getPayments,
  markPaymentExpired,
  PaymentDetail,
  PaymentFilterOptions,
  PaymentQueueSummary,
  PaymentRow,
  reopenPayment,
  simulatePayment,
} from "@/services/payment-service";
import { PaymentDueFilter, PaymentSortBy, PaymentSortDir, PaymentSummary } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const todayIso = new Date().toISOString().slice(0, 10);

const EMPTY_SUMMARY: PaymentSummary = {
  totalCobrado: 0,
  totalPago: 0,
  totalPendente: 0,
  totalExpirado: 0,
  totalCancelado: 0,
};

const EMPTY_QUEUE: PaymentQueueSummary = {
  totalOpenCount: 0,
  totalOpenAmount: 0,
  overdueCount: 0,
  overdueAmount: 0,
  dueTodayCount: 0,
  dueSoonCount: 0,
  noDueDateCount: 0,
  recentSettlementsCount: 0,
};

const EMPTY_FILTERS: PaymentFilterOptions = {
  athletes: [],
  events: [],
};

function paymentTone(status: PaymentRow["status"]): "positive" | "warning" | "danger" | "neutral" {
  if (status === "PAID") return "positive";
  if (status === "PENDING") return "warning";
  if (status === "EXPIRED") return "danger";
  return "neutral";
}

function dueLabel(row: PaymentRow): string {
  if (row.dueState === "NO_DUE_DATE") return "Sem vencimento";
  if (!row.expiresAt) return "-";
  if (row.dueState === "OVERDUE") return `Atrasado (${Math.abs(row.daysUntilDue ?? 0)}d)`;
  if (row.dueState === "DUE_TODAY") return "Vence hoje";
  return `Vence em ${Math.max(0, row.daysUntilDue ?? 0)}d`;
}

function dueTone(row: PaymentRow): "warning" | "danger" | "neutral" | "positive" {
  if (row.dueState === "OVERDUE") return "danger";
  if (row.dueState === "DUE_TODAY") return "warning";
  if (row.dueState === "DUE_SOON") return "neutral";
  return row.status === "PAID" ? "positive" : "neutral";
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export default function AdminFinanceiroPage() {
  const { accessToken } = useAuthToken();
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState<"MONTH" | "YEAR" | "CUSTOM">("MONTH");
  const [status, setStatus] = useState<"ALL" | "PENDING" | "PAID" | "EXPIRED" | "CANCELLED">("ALL");
  const [due, setDue] = useState<PaymentDueFilter>("ALL");
  const [athlete, setAthlete] = useState("");
  const [eventName, setEventName] = useState("");
  const [sortBy, setSortBy] = useState<PaymentSortBy>("createdAt");
  const [sortDir, setSortDir] = useState<PaymentSortDir>("desc");
  const [customStart, setCustomStart] = useState(todayIso);
  const [customEnd, setCustomEnd] = useState(todayIso);

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>(EMPTY_SUMMARY);
  const [queue, setQueue] = useState<PaymentQueueSummary>(EMPTY_QUEUE);
  const [filterOptions, setFilterOptions] = useState<PaymentFilterOptions>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetail | null>(null);
  const [loadingPaymentDetail, setLoadingPaymentDetail] = useState(false);
  const [runningAction, setRunningAction] = useState(false);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    const dueParam = searchParams.get("due");
    const athleteParam = searchParams.get("athlete");
    const eventParam = searchParams.get("event");
    const periodParam = searchParams.get("period");

    if (statusParam === "PENDING" || statusParam === "PAID" || statusParam === "EXPIRED" || statusParam === "CANCELLED") {
      setStatus(statusParam);
    } else {
      setStatus("ALL");
    }

    if (dueParam === "OVERDUE" || dueParam === "TODAY" || dueParam === "NEXT_7_DAYS" || dueParam === "NO_DUE_DATE") {
      setDue(dueParam);
    } else {
      setDue("ALL");
    }

    if (periodParam === "YEAR" || periodParam === "CUSTOM") {
      setPeriod(periodParam);
    } else {
      setPeriod("MONTH");
    }

    setAthlete(athleteParam ?? "");
    setEventName(eventParam ?? "");
  }, [searchParams]);

  const filters = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    if (period === "CUSTOM") {
      return {
        startDate: `${customStart}T00:00:00.000Z`,
        endDate: `${customEnd}T23:59:59.999Z`,
      };
    }
    if (period === "YEAR") {
      return { startDate: yearStart.toISOString(), endDate: now.toISOString() };
    }
    return { startDate: monthStart.toISOString(), endDate: now.toISOString() };
  }, [customEnd, customStart, period]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getPayments({
        startDate: filters.startDate,
        endDate: filters.endDate,
        status,
        athlete: athlete || undefined,
        event: eventName || undefined,
        due,
        sortBy,
        sortDir,
        accessToken,
      });

      setRows(payload.rows);
      setSummary(payload.summary);
      setQueue(payload.queue);
      setFilterOptions(payload.filters);
      setErrorMessage(null);
    } catch {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setQueue(EMPTY_QUEUE);
      setFilterOptions(EMPTY_FILTERS);
      setErrorMessage("Não foi possível carregar os dados financeiros no momento.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, athlete, due, eventName, filters.endDate, filters.startDate, sortBy, sortDir, status]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (!selectedPaymentId) {
      setSelectedPayment(null);
      return;
    }

    let cancelled = false;
    const loadDetail = async () => {
      setLoadingPaymentDetail(true);
      try {
        const detail = await getPaymentDetail(selectedPaymentId, accessToken);
        if (!cancelled) setSelectedPayment(detail);
      } catch (error) {
        if (!cancelled) {
          setSelectedPayment(null);
          toast.error(error instanceof Error ? error.message : "Falha ao carregar detalhes da cobranca.");
        }
      } finally {
        if (!cancelled) setLoadingPaymentDetail(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedPaymentId]);

  const queueRows = useMemo(
    () =>
      rows
        .filter((row) => row.status === "PENDING")
        .sort((a, b) => {
          const aTs = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
          const bTs = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
          return aTs - bTs;
        })
        .slice(0, 8),
    [rows],
  );

  const exportCsv = () => {
    const header = [
      "TxId",
      "Atleta",
      "Email",
      "Prova",
      "Distancia",
      "Valor BRL",
      "Status",
      "Consolidacao",
      "Vencimento",
      "Criado em",
      "Atualizado em",
    ];
    const lines = rows.map((row) => [
      row.txId,
      row.athleteName,
      row.athleteEmail,
      row.eventName,
      row.distanceLabel,
      (row.amountCents / 100).toFixed(2),
      row.status,
      row.reconciliationStatus,
      formatDateTime(row.expiresAt),
      formatDateTime(row.createdAt),
      formatDateTime(row.updatedAt),
    ]);

    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const csvWithBom = `\uFEFF${csv}`;

    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `financeiro-conciliacao-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Exportacao financeira concluida.");
  };

  const queueColumns: DataTableColumn<PaymentRow>[] = [
    {
      key: "athlete",
      header: "Atleta",
      className: "min-w-[150px]",
      cell: (row) => <span className="font-semibold text-white">{row.athleteName}</span>,
    },
    {
      key: "event",
      header: "Prova",
      className: "min-w-[160px]",
      cell: (row) => <span className="text-[13px]">{row.eventName}</span>,
    },
    {
      key: "amount",
      header: "Valor",
      className: "min-w-[90px]",
      cell: (row) => <span className="font-semibold text-white">{BRL.format(row.amountCents / 100)}</span>,
    },
    {
      key: "due",
      header: "Vencimento",
      className: "min-w-[120px]",
      cell: (row) => <StatusBadge tone={dueTone(row)} label={dueLabel(row)} />,
    },
    {
      key: "open",
      header: "",
      className: "min-w-[110px]",
      cell: (row) => (
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.09] hover:text-white whitespace-nowrap"
          onClick={() => setSelectedPaymentId(row.id)}
        >
          Abrir cobrança
        </button>
      ),
    },
  ];

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      key: "athlete",
      header: "Atleta",
      className: "min-w-[160px]",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.athleteName}</p>
          <p className="text-[11px] text-white/40">{row.athleteEmail}</p>
        </div>
      ),
    },
    {
      key: "event",
      header: "Prova",
      className: "min-w-[160px]",
      cell: (row) => (
        <div>
          <p className="text-[13px] text-white">{row.eventName}</p>
          <p className="text-[11px] text-white/40">{row.distanceLabel}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Valor",
      className: "min-w-[90px]",
      cell: (row) => <span className="font-semibold text-white">{BRL.format(row.amountCents / 100)}</span>,
    },
    {
      key: "due",
      header: "Vencimento",
      className: "min-w-[120px]",
      cell: (row) => <StatusBadge tone={dueTone(row)} label={dueLabel(row)} />,
    },
    {
      key: "reconciliation",
      header: "Conciliação",
      className: "min-w-[160px]",
      cell: (row) => (
        <div className="space-y-1">
          <StatusBadge
            tone={
              row.reconciliationStatus === "SETTLED"
                ? "positive"
                : row.reconciliationStatus === "OPEN"
                  ? "warning"
                  : "neutral"
            }
            label={row.reconciliationStatus}
          />
          <p className="line-clamp-1 text-[11px] text-white/40">{row.reconciliationNote}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Pagamento",
      className: "min-w-[110px]",
      cell: (row) => <StatusBadge tone={paymentTone(row.status)} label={row.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "min-w-[100px]",
      cell: (row) => (
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.09] hover:text-white whitespace-nowrap"
          onClick={() => setSelectedPaymentId(row.id)}
        >
          <QrCode className="h-3.5 w-3.5" /> Detalhes
        </button>
      ),
    },
  ];

  const runModalAction = async (
    action: "pay" | "cancel" | "expire" | "reopen",
    paymentId: string,
  ) => {
    setRunningAction(true);
    try {
      if (action === "pay") await simulatePayment(paymentId, accessToken);
      if (action === "cancel") await cancelPayment(paymentId, accessToken);
      if (action === "expire") await markPaymentExpired(paymentId, accessToken);
      if (action === "reopen") await reopenPayment(paymentId, accessToken);

      await loadPayments();
      const detail = await getPaymentDetail(paymentId, accessToken);
      setSelectedPayment(detail);

      if (action === "pay") toast.success("Pagamento confirmado e conciliado.");
      if (action === "cancel") toast.success("Cobranca cancelada.");
      if (action === "expire") toast.success("Cobranca marcada como expirada.");
      if (action === "reopen") toast.success("Cobranca reaberta como pendente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar cobranca.");
    } finally {
      setRunningAction(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        title="Financeiro e conciliacao"
        subtitle="Centro operacional de cobrancas PIX com fila de trabalho, conciliacao e historico."
        actions={
          <div className="flex gap-2">
            <ActionButton intent="secondary" onClick={() => void loadPayments()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </ActionButton>
            <ActionButton onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </ActionButton>
          </div>
        }
      />

      <SectionCard title="Resumo financeiro" description="Indicadores consolidados para decisao rapida">
        <div className="grid gap-3 md:grid-cols-5">
          <MetricCard label="Total cobrado" value={BRL.format(summary.totalCobrado / 100)} />
          <MetricCard label="Total pago" value={BRL.format(summary.totalPago / 100)} tone="highlight" />
          <MetricCard label="Pendente" value={BRL.format(summary.totalPendente / 100)} />
          <MetricCard label="Expirado" value={BRL.format(summary.totalExpirado / 100)} />
          <MetricCard label="Cancelado" value={BRL.format(summary.totalCancelado / 100)} />
        </div>
      </SectionCard>

      <SectionCard title="Fila de trabalho" description="Priorize cobrancas em risco de perda de receita">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Abertas" value={queue.totalOpenCount} />
          <MetricCard label="Aberto (R$)" value={BRL.format(queue.totalOpenAmount / 100)} />
          <MetricCard label="Atrasadas" value={queue.overdueCount} tone="highlight" />
          <MetricCard label="Atraso (R$)" value={BRL.format(queue.overdueAmount / 100)} tone="highlight" />
          <MetricCard label="Vence hoje" value={queue.dueTodayCount} />
          <MetricCard label="Prox. 7 dias" value={queue.dueSoonCount} />
          <MetricCard label="Sem vencimento" value={queue.noDueDateCount} />
          <MetricCard label="Baixas 24h" value={queue.recentSettlementsCount} tone="highlight" />
        </div>

        <div className="mt-4">
          {loading ? (
            <LoadingState lines={3} />
          ) : queueRows.length === 0 ? (
            <EmptyState title="Sem cobrancas pendentes na fila" description="Nao ha cobrancas abertas para acao imediata." />
          ) : (
            <DataTable columns={queueColumns} data={queueRows} getRowKey={(row) => row.id} />
          )}
        </div>
      </SectionCard>

      <SectionCard title="Filtros operacionais" description="Periodo, status, atleta, prova e vencimento">
        {errorMessage ? (
          <p className="mb-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            {errorMessage}
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            value={period}
            onChange={(event) => setPeriod(event.target.value as "MONTH" | "YEAR" | "CUSTOM")}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="MONTH">Mes atual</option>
            <option value="YEAR">Ano atual</option>
            <option value="CUSTOM">Periodo personalizado</option>
          </Select>

          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | "PENDING" | "PAID" | "EXPIRED" | "CANCELLED")}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="ALL">Status (todos)</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
            <option value="EXPIRED">Expirado</option>
            <option value="CANCELLED">Cancelado</option>
          </Select>

          <Select
            value={due}
            onChange={(event) => setDue(event.target.value as PaymentDueFilter)}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="ALL">Vencimento (todos)</option>
            <option value="OVERDUE">Atrasado</option>
            <option value="TODAY">Vence hoje</option>
            <option value="NEXT_7_DAYS">Prox. 7 dias</option>
            <option value="NO_DUE_DATE">Sem vencimento</option>
          </Select>

          <Input
            value={athlete}
            onChange={(event) => setAthlete(event.target.value)}
            placeholder="Filtrar atleta por nome"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            list="finance-athletes"
          />
          <datalist id="finance-athletes">
            {filterOptions.athletes.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <Input
            value={eventName}
            onChange={(event) => setEventName(event.target.value)}
            placeholder="Filtrar prova por nome"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            list="finance-events"
          />
          <datalist id="finance-events">
            {filterOptions.events.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <Select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as PaymentSortBy)}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="createdAt">Ordenar por criacao</option>
            <option value="expiresAt">Ordenar por vencimento</option>
            <option value="amount">Ordenar por valor</option>
          </Select>

          <Select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as PaymentSortDir)}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="desc">Decrescente</option>
            <option value="asc">Crescente</option>
          </Select>

          {period === "CUSTOM" ? (
            <>
              <Input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="border-white/[0.1] bg-white/[0.05] text-white"
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="border-white/[0.1] bg-white/[0.05] text-white"
              />
            </>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Cobrancas" description="Tabela operacional de cobranca e conciliacao">
        {loading ? (
          <LoadingState lines={4} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma cobranca encontrada" description="Ajuste os filtros para visualizar os registros." />
        ) : (
          <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
        )}
      </SectionCard>

      <Modal
        open={Boolean(selectedPaymentId)}
        onOpenChange={(open) => !open && setSelectedPaymentId(null)}
        title={selectedPayment ? `Cobranca ${selectedPayment.txId}` : "Detalhes da cobranca"}
        description="Contexto completo para cobranca, conciliacao e historico operacional."
        footer={
          selectedPayment ? (
            <>
              <ActionButton
                intent="secondary"
                disabled={!selectedPayment.pixCopyPaste}
                onClick={async () => {
                  try {
                    if (!selectedPayment.pixCopyPaste) {
                      toast.error("Codigo PIX indisponivel.");
                      return;
                    }
                    await navigator.clipboard.writeText(selectedPayment.pixCopyPaste);
                    toast.success("Codigo PIX copiado.");
                  } catch {
                    toast.error("Nao foi possivel copiar o codigo PIX.");
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar PIX
              </ActionButton>

              {selectedPayment.status === "PENDING" ? (
                <>
                  <ActionButton intent="danger" disabled={runningAction} onClick={() => void runModalAction("cancel", selectedPayment.id)}>
                    Cancelar
                  </ActionButton>
                  <ActionButton intent="secondary" disabled={runningAction} onClick={() => void runModalAction("expire", selectedPayment.id)}>
                    Expirar
                  </ActionButton>
                  <ActionButton disabled={runningAction} onClick={() => void runModalAction("pay", selectedPayment.id)}>
                    Confirmar pagamento
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  intent="secondary"
                  disabled={runningAction || selectedPayment.status === "PAID"}
                  onClick={() => void runModalAction("reopen", selectedPayment.id)}
                >
                  Reabrir cobranca
                </ActionButton>
              )}
            </>
          ) : null
        }
      >
        {loadingPaymentDetail ? (
          <LoadingState lines={4} />
        ) : selectedPayment ? (
          <div className="space-y-4">
            {selectedPayment.status === "PENDING" && selectedPayment.dueState === "OVERDUE" ? (
              <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-xs text-red-100">
                <p className="flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Cobranca em atraso
                </p>
                <p className="mt-1">Priorize este atleta para reduzir risco de inadimplencia.</p>
              </div>
            ) : null}

            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-xs text-white/40">Status pagamento</p>
                <div className="mt-1"><StatusBadge tone={paymentTone(selectedPayment.status)} label={selectedPayment.status} /></div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-xs text-white/40">Conciliacao</p>
                <div className="mt-1">
                  <StatusBadge
                    tone={
                      selectedPayment.reconciliationStatus === "SETTLED"
                        ? "positive"
                        : selectedPayment.reconciliationStatus === "OPEN"
                          ? "warning"
                          : "neutral"
                    }
                    label={selectedPayment.reconciliationStatus}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
                <p className="text-xs text-white/40">Valor</p>
                <p className="mt-1 text-lg font-semibold text-white">{BRL.format(selectedPayment.amountCents / 100)}</p>
              </div>
            </div>

            <PixQrCode
              pixCode={selectedPayment.pixCopyPaste ?? "PIX-DEMO-UNAVAILABLE"}
              expiresAt={new Date(selectedPayment.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString())}
              amountLabel={BRL.format(selectedPayment.amountCents / 100)}
            />

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3 text-[12px] text-white/55">
              <p>Atleta: {selectedPayment.athleteName} ({selectedPayment.athleteEmail})</p>
              <p className="mt-1">Prova: {selectedPayment.eventName} - {selectedPayment.distanceLabel}</p>
              <p className="mt-1">Criado em: {formatDateTime(selectedPayment.createdAt)}</p>
              <p className="mt-1">Vencimento: {formatDateTime(selectedPayment.expiresAt)}</p>
              <p className="mt-1">Pago em: {formatDateTime(selectedPayment.paidAt)}</p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.08em] text-white/35">Historico da cobranca</p>
              <ol className="space-y-2">
                {selectedPayment.history.map((step, index) => (
                  <li key={step.id} className="flex items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2">
                    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/20 text-[10px] font-semibold text-slate-100">
                      {index + 1}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-white">{step.label}</p>
                      <p className="text-[11px] text-white/50">{step.detail}</p>
                      <p className="text-[11px] text-white/30">{formatDateTime(step.occurredAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <EmptyState title="Cobranca nao encontrada" description="Nao foi possivel carregar os detalhes." />
        )}
      </Modal>
    </div>
  );
}
