"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Copy, Download, QrCode, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  createFinancialEntry,
  FinancialEntryRow,
  getPaymentDetail,
  getFinancialEntries,
  getPayments,
  markPaymentExpired,
  PaymentDetail,
  PaymentFilterOptions,
  PaymentQueueSummary,
  PaymentRow,
  patchFinancialEntry,
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
const EMPTY_FINANCIAL_SUMMARY = {
  incomeCents: 0,
  expenseCents: 0,
  balanceCents: 0,
  openReceivableCents: 0,
  openPayableCents: 0,
};
const FINANCE_HISTORY_START = "2000-01-01T00:00:00.000Z";

type FinanceWorkspace = "overview" | "charges" | "cashbook" | "ledger";

const WORKSPACE_LABELS: Record<FinanceWorkspace, string> = {
  overview: "Visao geral",
  charges: "Cobrancas",
  cashbook: "Livro-caixa",
  ledger: "Contas e recebimentos",
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

function formatShortDate(value: string): string {
  return format(new Date(value), "dd/MM", { locale: ptBR });
}

function formatMonthLabel(value: string): string {
  return format(new Date(value), "MMM/yy", { locale: ptBR });
}

function bucketKeyFromIso(value: string, mode: "day" | "month"): string {
  return mode === "month" ? value.slice(0, 7) : value.slice(0, 10);
}

function entryKindLabel(kind: FinancialEntryRow["entryKind"]): string {
  if (kind === "CASH") return "Livro-caixa";
  if (kind === "RECEIVABLE") return "A receber";
  return "A pagar";
}

function entryKindTone(kind: FinancialEntryRow["entryKind"]): "positive" | "warning" | "neutral" {
  if (kind === "CASH") return "positive";
  if (kind === "RECEIVABLE") return "warning";
  return "neutral";
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
  const [manualEntries, setManualEntries] = useState<FinancialEntryRow[]>([]);
  const [manualSummary, setManualSummary] = useState(EMPTY_FINANCIAL_SUMMARY);
  const [openingManualSummary, setOpeningManualSummary] = useState(EMPTY_FINANCIAL_SUMMARY);
  const [periodPayments, setPeriodPayments] = useState<PaymentRow[]>([]);
  const [periodPaymentSummary, setPeriodPaymentSummary] = useState<PaymentSummary>(EMPTY_SUMMARY);
  const [openingPaidCents, setOpeningPaidCents] = useState(0);
  const [cashStatusFilter, setCashStatusFilter] = useState<"ALL" | "OPEN" | "PAID" | "CANCELLED">("ALL");
  const [cashTypeFilter, setCashTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [cashCostCenterFilter, setCashCostCenterFilter] = useState("ALL");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<"ALL" | "OPEN" | "PAID" | "CANCELLED">("ALL");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [ledgerCostCenterFilter, setLedgerCostCenterFilter] = useState("ALL");
  const [entryForm, setEntryForm] = useState({
    type: "INCOME" as "INCOME" | "EXPENSE",
    entryKind: "CASH" as "CASH" | "RECEIVABLE" | "PAYABLE",
    status: "PAID" as "OPEN" | "PAID" | "CANCELLED",
    amount: "",
    category: "",
    description: "",
    accountCode: "MENSALIDADE",
    costCenter: "Associacao",
    counterparty: "",
    paymentMethod: "PIX",
    documentUrl: "",
    occurredAt: todayIso,
    dueAt: todayIso,
  });
  const [savingEntry, setSavingEntry] = useState(false);

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
      const openingEndDate = new Date(new Date(filters.startDate).getTime() - 1).toISOString();
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
      const [entriesPayload, periodPaymentsPayload, openingEntriesPayload, openingPaymentsPayload] =
        await Promise.all([
          getFinancialEntries({
            startDate: filters.startDate,
            endDate: filters.endDate,
            accessToken,
          }),
          getPayments({
            startDate: filters.startDate,
            endDate: filters.endDate,
            accessToken,
          }),
          getFinancialEntries({
            startDate: FINANCE_HISTORY_START,
            endDate: openingEndDate,
            accessToken,
          }),
          getPayments({
            startDate: FINANCE_HISTORY_START,
            endDate: openingEndDate,
            accessToken,
          }),
        ]);

      setRows(payload.rows);
      setSummary(payload.summary);
      setQueue(payload.queue);
      setFilterOptions(payload.filters);
      setManualEntries(entriesPayload.data);
      setManualSummary(entriesPayload.summary);
      setPeriodPayments(periodPaymentsPayload.rows);
      setPeriodPaymentSummary(periodPaymentsPayload.summary);
      setOpeningManualSummary(openingEntriesPayload.summary);
      setOpeningPaidCents(openingPaymentsPayload.summary.totalPago);
      setErrorMessage(null);
    } catch {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setQueue(EMPTY_QUEUE);
      setFilterOptions(EMPTY_FILTERS);
      setManualEntries([]);
      setManualSummary(EMPTY_FINANCIAL_SUMMARY);
      setOpeningManualSummary(EMPTY_FINANCIAL_SUMMARY);
      setPeriodPayments([]);
      setPeriodPaymentSummary(EMPTY_SUMMARY);
      setOpeningPaidCents(0);
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

  const cashEntries = useMemo(
    () => manualEntries.filter((entry) => entry.entryKind === "CASH"),
    [manualEntries],
  );
  const receivableEntries = useMemo(
    () => manualEntries.filter((entry) => entry.entryKind === "RECEIVABLE"),
    [manualEntries],
  );
  const payableEntries = useMemo(
    () => manualEntries.filter((entry) => entry.entryKind === "PAYABLE"),
    [manualEntries],
  );
  const ledgerEntries = useMemo(
    () => manualEntries.filter((entry) => entry.entryKind !== "CASH"),
    [manualEntries],
  );
  const paidRows = useMemo(() => rows.filter((row) => row.status === "PAID"), [rows]);
  const paidPeriodRows = useMemo(() => periodPayments.filter((row) => row.status === "PAID"), [periodPayments]);
  const pendingRows = useMemo(() => rows.filter((row) => row.status === "PENDING"), [rows]);
  const cashEntriesOpen = useMemo(
    () => cashEntries.filter((entry) => entry.status === "OPEN").length,
    [cashEntries],
  );
  const ledgerOpenCount = useMemo(
    () => ledgerEntries.filter((entry) => entry.status === "OPEN").length,
    [ledgerEntries],
  );
  const paidRowsAmount = useMemo(
    () => paidRows.reduce((total, row) => total + row.amountCents, 0),
    [paidRows],
  );
  const recentPaidRows = useMemo(() => paidPeriodRows.slice(0, 8), [paidPeriodRows]);
  const costCenterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          manualEntries
            .map((entry) => entry.costCenter?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [manualEntries],
  );
  const filteredCashEntries = useMemo(
    () =>
      cashEntries.filter((entry) => {
        if (cashStatusFilter !== "ALL" && entry.status !== cashStatusFilter) return false;
        if (cashTypeFilter !== "ALL" && entry.type !== cashTypeFilter) return false;
        if (cashCostCenterFilter !== "ALL" && (entry.costCenter ?? "") !== cashCostCenterFilter) return false;
        return true;
      }),
    [cashCostCenterFilter, cashEntries, cashStatusFilter, cashTypeFilter],
  );
  const filteredLedgerEntries = useMemo(
    () =>
      ledgerEntries.filter((entry) => {
        if (ledgerStatusFilter !== "ALL" && entry.status !== ledgerStatusFilter) return false;
        if (ledgerTypeFilter !== "ALL" && entry.type !== ledgerTypeFilter) return false;
        if (ledgerCostCenterFilter !== "ALL" && (entry.costCenter ?? "") !== ledgerCostCenterFilter) return false;
        return true;
      }),
    [ledgerCostCenterFilter, ledgerEntries, ledgerStatusFilter, ledgerTypeFilter],
  );
  const openingCashBalanceCents = useMemo(
    () => openingManualSummary.balanceCents + openingPaidCents,
    [openingManualSummary.balanceCents, openingPaidCents],
  );
  const currentCashIncomeCents = useMemo(
    () =>
      manualEntries
        .filter((entry) => entry.entryKind === "CASH" && entry.type === "INCOME" && entry.status === "PAID")
        .reduce((total, entry) => total + entry.amountCents, 0),
    [manualEntries],
  );
  const currentCashExpenseCents = useMemo(
    () =>
      manualEntries
        .filter((entry) => entry.entryKind === "CASH" && entry.type === "EXPENSE" && entry.status === "PAID")
        .reduce((total, entry) => total + entry.amountCents, 0),
    [manualEntries],
  );
  const closingCashBalanceCents = useMemo(
    () => openingCashBalanceCents + periodPaymentSummary.totalPago + currentCashIncomeCents - currentCashExpenseCents,
    [currentCashExpenseCents, currentCashIncomeCents, openingCashBalanceCents, periodPaymentSummary.totalPago],
  );
  const ledgerReceivableOpenCount = useMemo(
    () => filteredLedgerEntries.filter((entry) => entry.entryKind === "RECEIVABLE" && entry.status === "OPEN").length,
    [filteredLedgerEntries],
  );
  const ledgerPayableOpenCount = useMemo(
    () => filteredLedgerEntries.filter((entry) => entry.entryKind === "PAYABLE" && entry.status === "OPEN").length,
    [filteredLedgerEntries],
  );
  const cashFlowSeries = useMemo(() => {
    const bucketMode = period === "YEAR" ? "month" : "day";
    const buckets = new Map<
      string,
      {
        label: string;
        inflowCents: number;
        outflowCents: number;
      }
    >();

    const ensureBucket = (isoDate: string) => {
      const key = bucketKeyFromIso(isoDate, bucketMode);
      if (!buckets.has(key)) {
        buckets.set(key, {
          label: bucketMode === "month" ? formatMonthLabel(`${key}-01T00:00:00.000Z`) : formatShortDate(`${key}T00:00:00.000Z`),
          inflowCents: 0,
          outflowCents: 0,
        });
      }
      return buckets.get(key)!;
    };

    periodPayments
      .filter((row) => row.status === "PAID" && row.paidAt)
      .forEach((row) => {
        const bucket = ensureBucket(row.paidAt!);
        bucket.inflowCents += row.amountCents;
      });

    manualEntries
      .filter((entry) => entry.entryKind === "CASH" && entry.status === "PAID")
      .forEach((entry) => {
        const bucket = ensureBucket(entry.settledAt ?? entry.occurredAt);
        if (entry.type === "INCOME") bucket.inflowCents += entry.amountCents;
        else bucket.outflowCents += entry.amountCents;
      });

    let runningBalance = openingCashBalanceCents;
    return Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, bucket]) => {
        const netCents = bucket.inflowCents - bucket.outflowCents;
        runningBalance += netCents;
        return {
          label: bucket.label,
          inflow: Number((bucket.inflowCents / 100).toFixed(2)),
          outflow: Number((bucket.outflowCents / 100).toFixed(2)),
          net: Number((netCents / 100).toFixed(2)),
          balance: Number((runningBalance / 100).toFixed(2)),
        };
      });
  }, [manualEntries, openingCashBalanceCents, period, periodPayments]);
  const periodLabel = useMemo(() => {
    if (period === "YEAR") return "Ano atual";
    if (period === "CUSTOM") {
      return `${format(new Date(filters.startDate), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(filters.endDate), "dd/MM/yyyy", { locale: ptBR })}`;
    }
    return format(new Date(filters.startDate), "MMMM 'de' yyyy", { locale: ptBR });
  }, [filters.endDate, filters.startDate, period]);

  const exportCsv = () => {
    const header = [
      "TxId",
      "Atleta Associado",
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

  const createManualEntry = async () => {
    const amountNumber = Number(entryForm.amount.replace(",", "."));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      toast.error("Informe um valor valido para o lancamento.");
      return;
    }
    if (!entryForm.category.trim()) {
      toast.error("Informe uma categoria.");
      return;
    }

    setSavingEntry(true);
    try {
      await createFinancialEntry(
        {
          type: entryForm.type,
          amountCents: Math.round(amountNumber * 100),
          category: entryForm.category.trim(),
          description: entryForm.description.trim() || undefined,
          occurredAt: new Date(`${entryForm.occurredAt}T12:00:00.000Z`).toISOString(),
          dueAt: entryForm.dueAt ? new Date(`${entryForm.dueAt}T12:00:00.000Z`).toISOString() : null,
          status: entryForm.status,
          entryKind: entryForm.entryKind,
          accountCode: entryForm.accountCode.trim() || null,
          costCenter: entryForm.costCenter.trim() || null,
          counterparty: entryForm.counterparty.trim() || null,
          paymentMethod: entryForm.paymentMethod.trim() || null,
          documentUrl: entryForm.documentUrl.trim() || null,
        },
        accessToken,
      );
      toast.success("Lancamento financeiro criado.");
      setEntryForm({
        type: "INCOME",
        entryKind: "CASH",
        status: "PAID",
        amount: "",
        category: "",
        description: "",
        accountCode: "MENSALIDADE",
        costCenter: "Associacao",
        counterparty: "",
        paymentMethod: "PIX",
        documentUrl: "",
        occurredAt: todayIso,
        dueAt: todayIso,
      });
      await loadPayments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar lancamento.");
    } finally {
      setSavingEntry(false);
    }
  };

  const runEntryAction = async (
    entryId: string,
    action: "MARK_PAID" | "REOPEN" | "CANCEL",
  ) => {
    try {
      await patchFinancialEntry(entryId, action, accessToken);
      if (action === "MARK_PAID") toast.success("Lancamento baixado.");
      if (action === "REOPEN") toast.success("Lancamento reaberto.");
      if (action === "CANCEL") toast.success("Lancamento cancelado.");
      await loadPayments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar lancamento.");
    }
  };

  const queueColumns: DataTableColumn<PaymentRow>[] = [
    {
      key: "athlete",
      header: "Atleta Associado",
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
      header: "Atleta Associado",
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

      <SectionCard
        title="Operacao financeira"
        description="Use atalhos por area sem perder a leitura completa do financeiro."
      >
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WORKSPACE_LABELS) as FinanceWorkspace[]).map((key) => (
            <a
              key={key}
              href={`#finance-${key}`}
              className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white/70 transition hover:border-[#1E90FF]/60 hover:bg-[#1E90FF]/10 hover:text-white"
            >
              {WORKSPACE_LABELS[key]}
            </a>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Recebido no periodo" value={BRL.format(periodPaymentSummary.totalPago / 100)} tone="highlight" />
          <MetricCard label="Titulos pendentes" value={queue.totalOpenCount} />
          <MetricCard label="Lancamentos no caixa" value={cashEntries.length} />
          <MetricCard label="Contas em aberto" value={ledgerOpenCount + cashEntriesOpen} />
        </div>
      </SectionCard>

      <div id="finance-overview" className="space-y-6">
          <SectionCard title="Resumo financeiro" description="Indicadores consolidados para decisao rapida">
            <div className="grid gap-3 md:grid-cols-5">
              <MetricCard label="Total cobrado" value={BRL.format(periodPaymentSummary.totalCobrado / 100)} />
              <MetricCard label="Total pago" value={BRL.format(periodPaymentSummary.totalPago / 100)} tone="highlight" />
              <MetricCard label="Pendente" value={BRL.format(periodPaymentSummary.totalPendente / 100)} />
              <MetricCard label="Expirado" value={BRL.format(periodPaymentSummary.totalExpirado / 100)} />
              <MetricCard label="Cancelado" value={BRL.format(periodPaymentSummary.totalCancelado / 100)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Visao contábil da associacao"
            description="Leitura rápida de caixa, contas em aberto e movimento manual."
          >
            <div className="grid gap-3 md:grid-cols-5">
              <MetricCard label="Entradas realizadas" value={BRL.format(manualSummary.incomeCents / 100)} tone="highlight" />
              <MetricCard label="Saidas realizadas" value={BRL.format(manualSummary.expenseCents / 100)} />
              <MetricCard label="Saldo caixa" value={BRL.format(manualSummary.balanceCents / 100)} />
              <MetricCard label="A receber" value={BRL.format(manualSummary.openReceivableCents / 100)} />
              <MetricCard label="A pagar" value={BRL.format(manualSummary.openPayableCents / 100)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Fechamento do periodo"
            description={`Saldo inicial, movimentacao e fechamento para ${periodLabel}.`}
          >
            <div className="grid gap-3 md:grid-cols-5">
              <MetricCard label="Saldo inicial" value={BRL.format(openingCashBalanceCents / 100)} />
              <MetricCard label="Entradas do periodo" value={BRL.format((periodPaymentSummary.totalPago + currentCashIncomeCents) / 100)} tone="highlight" />
              <MetricCard label="Saidas do periodo" value={BRL.format(currentCashExpenseCents / 100)} />
              <MetricCard label="Saldo final" value={BRL.format(closingCashBalanceCents / 100)} />
              <MetricCard label="Variacao liquida" value={BRL.format((closingCashBalanceCents - openingCashBalanceCents) / 100)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Fluxo de caixa"
            description="Entradas, saidas e saldo acumulado ao longo do periodo."
          >
            {cashFlowSeries.length === 0 ? (
              <EmptyState title="Sem movimento de caixa no periodo" description="Os recebimentos e saidas aparecerao aqui assim que houver baixa financeira." />
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#10233b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      formatter={(value) => BRL.format(Number(value ?? 0))}
                    />
                    <Legend />
                    <Bar dataKey="inflow" name="Entradas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="outflow" name="Saidas" fill="#f97316" radius={[6, 6, 0, 0]} />
                    <Line type="monotone" dataKey="balance" name="Saldo" stroke="#38bdf8" strokeWidth={3} dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
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
      </div>

      <div id="finance-cashbook">
        <SectionCard
          title="Livro-caixa"
          description="Entradas e saídas avulsas com plano de contas, centro de custo e baixa manual."
        >
        <div className="grid gap-3 md:grid-cols-5">
          <MetricCard label="Saldo inicial" value={BRL.format(openingCashBalanceCents / 100)} />
          <MetricCard label="Entradas caixa" value={BRL.format((periodPaymentSummary.totalPago + currentCashIncomeCents) / 100)} tone="highlight" />
          <MetricCard label="Saidas caixa" value={BRL.format(currentCashExpenseCents / 100)} />
          <MetricCard label="Saldo final" value={BRL.format(closingCashBalanceCents / 100)} />
          <MetricCard label="Lancamentos caixa" value={filteredCashEntries.length} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            value={cashStatusFilter}
            onChange={(event) => setCashStatusFilter(event.target.value as "ALL" | "OPEN" | "PAID" | "CANCELLED")}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="ALL">Status do caixa</option>
            <option value="PAID">Baixado</option>
            <option value="OPEN">Em aberto</option>
            <option value="CANCELLED">Cancelado</option>
          </Select>
          <Select
            value={cashTypeFilter}
            onChange={(event) => setCashTypeFilter(event.target.value as "ALL" | "INCOME" | "EXPENSE")}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="ALL">Tipo de movimento</option>
            <option value="INCOME">Entradas</option>
            <option value="EXPENSE">Saidas</option>
          </Select>
          <Select
            value={cashCostCenterFilter}
            onChange={(event) => setCashCostCenterFilter(event.target.value)}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="ALL">Centro de custo</option>
            {costCenterOptions.map((center) => (
              <option key={center} value={center}>
                {center}
              </option>
            ))}
          </Select>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white/65">
            Fechamento do periodo: <span className="font-semibold text-white">{periodLabel}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Select
            value={entryForm.type}
            onChange={(event) => setEntryForm((current) => ({ ...current, type: event.target.value as "INCOME" | "EXPENSE" }))}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="INCOME">Entrada</option>
            <option value="EXPENSE">Saida</option>
          </Select>
          <Select
            value={entryForm.entryKind}
            onChange={(event) => setEntryForm((current) => ({ ...current, entryKind: event.target.value as "CASH" | "RECEIVABLE" | "PAYABLE" }))}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="CASH">Livro-caixa</option>
            <option value="RECEIVABLE">Conta a receber</option>
            <option value="PAYABLE">Conta a pagar</option>
          </Select>
          <Select
            value={entryForm.status}
            onChange={(event) => setEntryForm((current) => ({ ...current, status: event.target.value as "OPEN" | "PAID" | "CANCELLED" }))}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          >
            <option value="PAID">Pago/baixado</option>
            <option value="OPEN">Em aberto</option>
            <option value="CANCELLED">Cancelado</option>
          </Select>
          <Input
            value={entryForm.amount}
            onChange={(event) => setEntryForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Valor R$"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
          />
          <Input
            value={entryForm.category}
            onChange={(event) => setEntryForm((current) => ({ ...current, category: event.target.value }))}
            placeholder="Categoria"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            list="finance-categories"
          />
          <datalist id="finance-categories">
            <option value="Mensalidade de associado" />
            <option value="Inscricao em prova" />
            <option value="Brindes e produtos" />
            <option value="Patrocinio" />
            <option value="Doacao" />
            <option value="Fornecedor" />
            <option value="Uniformes" />
            <option value="Eventos" />
            <option value="Taxas bancarias" />
            <option value="Administrativo" />
          </datalist>
          <Input
            type="date"
            value={entryForm.occurredAt}
            onChange={(event) => setEntryForm((current) => ({ ...current, occurredAt: event.target.value }))}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          />
          <Input
            value={entryForm.description}
            onChange={(event) => setEntryForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Descricao"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
          />
          <Input
            type="date"
            value={entryForm.dueAt}
            onChange={(event) => setEntryForm((current) => ({ ...current, dueAt: event.target.value }))}
            className="border-white/[0.1] bg-white/[0.05] text-white"
          />
          <Input
            value={entryForm.accountCode}
            onChange={(event) => setEntryForm((current) => ({ ...current, accountCode: event.target.value }))}
            placeholder="Plano de contas"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
          />
          <Input
            value={entryForm.costCenter}
            onChange={(event) => setEntryForm((current) => ({ ...current, costCenter: event.target.value }))}
            placeholder="Centro de custo"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
          />
          <Input
            value={entryForm.counterparty}
            onChange={(event) => setEntryForm((current) => ({ ...current, counterparty: event.target.value }))}
            placeholder="Associado, fornecedor ou parceiro"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
          />
          <Input
            value={entryForm.paymentMethod}
            onChange={(event) => setEntryForm((current) => ({ ...current, paymentMethod: event.target.value }))}
            placeholder="Forma de pagamento"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
          />
          <Input
            value={entryForm.documentUrl}
            onChange={(event) => setEntryForm((current) => ({ ...current, documentUrl: event.target.value }))}
            placeholder="Link do comprovante/nota"
            className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30 xl:col-span-2"
          />
        </div>
        <div className="mt-3">
          <ActionButton disabled={savingEntry} onClick={() => void createManualEntry()}>
            {savingEntry ? "Lancando..." : "Lancar entrada/saida"}
          </ActionButton>
        </div>

        <div className="mt-4">
          {filteredCashEntries.length === 0 ? (
            <EmptyState title="Sem movimentos no livro-caixa" description="Entradas e saidas avulsas aparecerao aqui." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Categoria</th>
                    <th className="px-3 py-2 text-left">Centro</th>
                    <th className="px-3 py-2 text-left">Valor</th>
                    <th className="px-3 py-2 text-left">Descricao</th>
                    <th className="px-3 py-2 text-left">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCashEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/[0.07]">
                      <td className="px-3 py-2 text-white/60">{format(new Date(entry.occurredAt), "dd/MM/yyyy", { locale: ptBR })}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={entry.type === "INCOME" ? "positive" : "warning"}
                          label={entry.type === "INCOME" ? "Entrada" : "Saida"}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={entry.status === "PAID" ? "positive" : entry.status === "OPEN" ? "warning" : "neutral"}
                          label={entry.status === "PAID" ? "Baixado" : entry.status === "OPEN" ? "Aberto" : "Cancelado"}
                        />
                      </td>
                      <td className="px-3 py-2 text-white">{entry.category}</td>
                      <td className="px-3 py-2 text-white/60">{entry.costCenter ?? "-"}</td>
                      <td className="px-3 py-2 font-semibold text-white">{BRL.format(entry.amountCents / 100)}</td>
                      <td className="px-3 py-2 text-white/50">{entry.description ?? "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {entry.status !== "PAID" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-400/30 px-2 py-1 text-xs text-emerald-200"
                              onClick={() => void runEntryAction(entry.id, "MARK_PAID")}
                            >
                              Baixar
                            </button>
                          ) : null}
                          {entry.status !== "OPEN" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70"
                              onClick={() => void runEntryAction(entry.id, "REOPEN")}
                            >
                              Reabrir
                            </button>
                          ) : null}
                          {entry.status !== "CANCELLED" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-red-400/30 px-2 py-1 text-xs text-red-200"
                              onClick={() => void runEntryAction(entry.id, "CANCEL")}
                            >
                              Cancelar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
      </div>

      <div id="finance-charges" className="space-y-6">
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
      </div>

      <div id="finance-ledger" className="space-y-6">
          <SectionCard
            title="Contas a pagar e receber"
            description="Controle gerencial de titulos, baixas e obrigações fora do caixa imediato."
          >
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard label="A receber" value={BRL.format(manualSummary.openReceivableCents / 100)} tone="highlight" />
              <MetricCard label="A pagar" value={BRL.format(manualSummary.openPayableCents / 100)} />
              <MetricCard label="Titulos a receber" value={ledgerReceivableOpenCount} />
              <MetricCard label="Titulos a pagar" value={ledgerPayableOpenCount} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select
                value={ledgerStatusFilter}
                onChange={(event) => setLedgerStatusFilter(event.target.value as "ALL" | "OPEN" | "PAID" | "CANCELLED")}
                className="border-white/[0.1] bg-white/[0.05] text-white"
              >
                <option value="ALL">Status das contas</option>
                <option value="OPEN">Em aberto</option>
                <option value="PAID">Baixadas</option>
                <option value="CANCELLED">Canceladas</option>
              </Select>
              <Select
                value={ledgerTypeFilter}
                onChange={(event) => setLedgerTypeFilter(event.target.value as "ALL" | "INCOME" | "EXPENSE")}
                className="border-white/[0.1] bg-white/[0.05] text-white"
              >
                <option value="ALL">Receber e pagar</option>
                <option value="INCOME">Somente a receber</option>
                <option value="EXPENSE">Somente a pagar</option>
              </Select>
              <Select
                value={ledgerCostCenterFilter}
                onChange={(event) => setLedgerCostCenterFilter(event.target.value)}
                className="border-white/[0.1] bg-white/[0.05] text-white"
              >
                <option value="ALL">Centro de custo</option>
                {costCenterOptions.map((center) => (
                  <option key={center} value={center}>
                    {center}
                  </option>
                ))}
              </Select>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-sm text-white/65">
                Titulos filtrados: <span className="font-semibold text-white">{filteredLedgerEntries.length}</span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07]">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Natureza</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Categoria</th>
                    <th className="px-3 py-2 text-left">Contraparte</th>
                    <th className="px-3 py-2 text-left">Vencimento</th>
                    <th className="px-3 py-2 text-left">Valor</th>
                    <th className="px-3 py-2 text-left">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8">
                        <EmptyState title="Sem contas abertas no periodo" description="Titulos a pagar e a receber aparecerao aqui." />
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerEntries.map((entry) => (
                      <tr key={entry.id} className="border-t border-white/[0.07]">
                        <td className="px-3 py-2 text-white/60">{format(new Date(entry.occurredAt), "dd/MM/yyyy", { locale: ptBR })}</td>
                        <td className="px-3 py-2">
                          <StatusBadge tone={entryKindTone(entry.entryKind)} label={entryKindLabel(entry.entryKind)} />
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={entry.status === "PAID" ? "positive" : entry.status === "OPEN" ? "warning" : "neutral"}
                            label={entry.status === "PAID" ? "Baixado" : entry.status === "OPEN" ? "Aberto" : "Cancelado"}
                          />
                        </td>
                        <td className="px-3 py-2 text-white">{entry.category}</td>
                        <td className="px-3 py-2 text-white/60">{entry.counterparty ?? "-"}</td>
                        <td className="px-3 py-2 text-white/60">{entry.dueAt ? format(new Date(entry.dueAt), "dd/MM/yyyy", { locale: ptBR }) : "-"}</td>
                        <td className="px-3 py-2 font-semibold text-white">{BRL.format(entry.amountCents / 100)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {entry.status !== "PAID" ? (
                              <button
                                type="button"
                                className="rounded-lg border border-emerald-400/30 px-2 py-1 text-xs text-emerald-200"
                                onClick={() => void runEntryAction(entry.id, "MARK_PAID")}
                              >
                                Baixar
                              </button>
                            ) : null}
                            {entry.status !== "OPEN" ? (
                              <button
                                type="button"
                                className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70"
                                onClick={() => void runEntryAction(entry.id, "REOPEN")}
                              >
                                Reabrir
                              </button>
                            ) : null}
                            {entry.status !== "CANCELLED" ? (
                              <button
                                type="button"
                                className="rounded-lg border border-red-400/30 px-2 py-1 text-xs text-red-200"
                                onClick={() => void runEntryAction(entry.id, "CANCEL")}
                              >
                                Cancelar
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Recebimentos conciliados"
            description="Pagamentos baixados no periodo para conferencia de entrada real."
          >
            {loading ? (
              <LoadingState lines={3} />
            ) : recentPaidRows.length === 0 ? (
              <EmptyState title="Sem recebimentos no periodo" description="Pagamentos confirmados aparecerao aqui." />
            ) : (
              <DataTable columns={columns} data={recentPaidRows} getRowKey={(row) => row.id} />
            )}
          </SectionCard>
      </div>

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
              <p>Atleta associado: {selectedPayment.athleteName} ({selectedPayment.athleteEmail})</p>
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
