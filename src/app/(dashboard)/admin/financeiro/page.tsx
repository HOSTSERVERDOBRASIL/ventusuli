"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Coins,
  Copy,
  CreditCard,
  Download,
  FileText,
  QrCode,
  RefreshCw,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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
import {
  ManagementReportsSection,
  type ManagementReportAction,
  type ManagementReportExecutiveSummary,
  type ManagementReportInsight,
  type ManagementReportMetric,
} from "@/components/finance/management-reports-section";
import { PixQrCode } from "@/components/payment/pix-qrcode";
import { ProfileCockpit } from "@/components/profile/profile-cockpit";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { Modal } from "@/components/system/modal";
import { ModuleTabs } from "@/components/system/module-tabs";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getOrganizationSettings,
  type FinanceProfileSettings,
  type OrganizationSettings,
} from "@/services/organization-service";
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
  processRecurringCharges,
  reopenPayment,
  simulatePayment,
} from "@/services/payment-service";
import { PaymentDueFilter, PaymentSortBy, PaymentSortDir, PaymentSummary } from "@/services/types";
import { UserRole } from "@/types";

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

type FinanceTab =
  | "dashboard"
  | "receive"
  | "pay"
  | "cash"
  | "delinquency"
  | "costCenters"
  | "reports";

type FinanceMenuTone = "positive" | "warning" | "danger" | "neutral" | "info";

interface FinanceTabDefinition {
  key: FinanceTab;
  label: string;
  audience: string;
  description: string;
  icon: LucideIcon;
}

const FINANCE_TABS: FinanceTabDefinition[] = [
  {
    key: "dashboard",
    label: "Painel",
    audience: "Diretoria",
    description: "Resumo do dinheiro, saldo e resultado da associacao.",
    icon: BarChart3,
  },
  {
    key: "receive",
    label: "Receber",
    audience: "Financeiro",
    description: "Mensalidades, inscricoes, PIX e conciliacao.",
    icon: ClipboardList,
  },
  {
    key: "pay",
    label: "Pagar",
    audience: "Tesouraria",
    description: "Fornecedores, obrigacoes e baixas de contas.",
    icon: CreditCard,
  },
  {
    key: "cash",
    label: "Caixa",
    audience: "Tesouraria",
    description: "Entradas, saidas, comprovantes e saldo operacional.",
    icon: Wallet,
  },
  {
    key: "delinquency",
    label: "Inadimplencia",
    audience: "Cobranca",
    description: "Associados em atraso e fila de prioridade.",
    icon: AlertTriangle,
  },
  {
    key: "costCenters",
    label: "Centros",
    audience: "Gestao",
    description: "Resultado por evento, associacao, patrocinio e areas.",
    icon: Coins,
  },
  {
    key: "reports",
    label: "Relatorios",
    audience: "Prestacao",
    description: "DRE, fluxo de caixa e exportacao para conselho.",
    icon: FileText,
  },
];

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

function businessModelLabel(model: FinanceProfileSettings["businessModel"]): string {
  if (model === "GRUPO_CORRIDA") return "Grupo de corrida";
  if (model === "ASSOCIACAO") return "Associacao";
  if (model === "CLUBE") return "Clube";
  return "Assessoria";
}

function revenueModeLabel(mode: FinanceProfileSettings["revenueMode"]): string {
  if (mode === "MENSALIDADES") return "Mensalidades";
  if (mode === "EVENTOS") return "Eventos";
  if (mode === "PATROCINIOS") return "Patrocinios";
  return "Receita mista";
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function AdminFinanceiroPage() {
  const { accessToken } = useAuthToken();
  const searchParams = useSearchParams();
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings | null>(
    null,
  );

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
  const [cashStatusFilter, setCashStatusFilter] = useState<"ALL" | "OPEN" | "PAID" | "CANCELLED">(
    "ALL",
  );
  const [cashTypeFilter, setCashTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [cashCostCenterFilter, setCashCostCenterFilter] = useState("ALL");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<
    "ALL" | "OPEN" | "PAID" | "CANCELLED"
  >("ALL");
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
  const [runningRecurring, setRunningRecurring] = useState(false);
  const [recurringMonthKey, setRecurringMonthKey] = useState(todayIso.slice(0, 7));
  const [activeFinanceTab, setActiveFinanceTab] = useState<FinanceTab>("dashboard");

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const payload = await getOrganizationSettings(accessToken);
        if (cancelled) return;

        setOrganizationSettings(payload);
        setEntryForm((current) => ({
          ...current,
          entryKind: payload.financeProfile.defaultEntryKind,
          accountCode: payload.financeProfile.defaultAccountCode,
          costCenter: payload.financeProfile.defaultCostCenter,
          paymentMethod: payload.financeProfile.defaultPaymentMethod,
        }));
      } catch {
        if (!cancelled) setOrganizationSettings(null);
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    const dueParam = searchParams.get("due");
    const athleteParam = searchParams.get("athlete");
    const eventParam = searchParams.get("event");
    const periodParam = searchParams.get("period");

    if (
      statusParam === "PENDING" ||
      statusParam === "PAID" ||
      statusParam === "EXPIRED" ||
      statusParam === "CANCELLED"
    ) {
      setStatus(statusParam);
    } else {
      setStatus("ALL");
    }

    if (
      dueParam === "OVERDUE" ||
      dueParam === "TODAY" ||
      dueParam === "NEXT_7_DAYS" ||
      dueParam === "NO_DUE_DATE"
    ) {
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

  const filteredPaymentsSummary = useMemo<PaymentSummary>(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.totalCobrado += row.amountCents;
          if (row.status === "PAID") acc.totalPago += row.amountCents;
          if (row.status === "PENDING") acc.totalPendente += row.amountCents;
          if (row.status === "EXPIRED") acc.totalExpirado += row.amountCents;
          if (row.status === "CANCELLED") acc.totalCancelado += row.amountCents;
          return acc;
        },
        { ...EMPTY_SUMMARY },
      ),
    [rows],
  );

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
  }, [
    accessToken,
    athlete,
    due,
    eventName,
    filters.endDate,
    filters.startDate,
    sortBy,
    sortDir,
    status,
  ]);

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
          toast.error(
            error instanceof Error ? error.message : "Falha ao carregar detalhes da cobranca.",
          );
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
  const paidPeriodRows = useMemo(
    () => periodPayments.filter((row) => row.status === "PAID"),
    [periodPayments],
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
        if (cashCostCenterFilter !== "ALL" && (entry.costCenter ?? "") !== cashCostCenterFilter)
          return false;
        return true;
      }),
    [cashCostCenterFilter, cashEntries, cashStatusFilter, cashTypeFilter],
  );
  const filteredLedgerEntries = useMemo(
    () =>
      ledgerEntries.filter((entry) => {
        if (ledgerStatusFilter !== "ALL" && entry.status !== ledgerStatusFilter) return false;
        if (ledgerTypeFilter !== "ALL" && entry.type !== ledgerTypeFilter) return false;
        if (ledgerCostCenterFilter !== "ALL" && (entry.costCenter ?? "") !== ledgerCostCenterFilter)
          return false;
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
        .filter(
          (entry) =>
            entry.entryKind === "CASH" && entry.type === "INCOME" && entry.status === "PAID",
        )
        .reduce((total, entry) => total + entry.amountCents, 0),
    [manualEntries],
  );
  const currentCashExpenseCents = useMemo(
    () =>
      manualEntries
        .filter(
          (entry) =>
            entry.entryKind === "CASH" && entry.type === "EXPENSE" && entry.status === "PAID",
        )
        .reduce((total, entry) => total + entry.amountCents, 0),
    [manualEntries],
  );
  const closingCashBalanceCents = useMemo(
    () =>
      openingCashBalanceCents +
      periodPaymentSummary.totalPago +
      currentCashIncomeCents -
      currentCashExpenseCents,
    [
      currentCashExpenseCents,
      currentCashIncomeCents,
      openingCashBalanceCents,
      periodPaymentSummary.totalPago,
    ],
  );
  const ledgerReceivableOpenCount = useMemo(
    () =>
      filteredLedgerEntries.filter(
        (entry) => entry.entryKind === "RECEIVABLE" && entry.status === "OPEN",
      ).length,
    [filteredLedgerEntries],
  );
  const ledgerPayableOpenCount = useMemo(
    () =>
      filteredLedgerEntries.filter(
        (entry) => entry.entryKind === "PAYABLE" && entry.status === "OPEN",
      ).length,
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
      let bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, {
          label:
            bucketMode === "month"
              ? formatMonthLabel(`${key}-01T00:00:00.000Z`)
              : formatShortDate(`${key}T00:00:00.000Z`),
          inflowCents: 0,
          outflowCents: 0,
        });
        bucket = buckets.get(key);
      }
      if (!bucket) {
        throw new Error("cash_flow_bucket_unavailable");
      }
      return bucket;
    };

    periodPayments
      .filter((row) => row.status === "PAID" && row.paidAt)
      .forEach((row) => {
        const paidAt = row.paidAt;
        if (!paidAt) return;
        const bucket = ensureBucket(paidAt);
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
  const financeProfile = organizationSettings?.financeProfile ?? null;
  const financeCategoryOptions = financeProfile?.categories ?? [];
  const financeCostCenterOptions = financeProfile?.costCenters ?? [];
  const financePaymentMethodOptions = financeProfile?.paymentMethods ?? [];
  const financeQuickNotes = financeProfile?.quickNotes ?? [];

  const applyQuickTemplate = (
    template: Partial<{
      type: "INCOME" | "EXPENSE";
      entryKind: "CASH" | "RECEIVABLE" | "PAYABLE";
      category: string;
      accountCode: string;
      costCenter: string;
      paymentMethod: string;
      description: string;
      status: "OPEN" | "PAID" | "CANCELLED";
    }>,
  ) => {
    setEntryForm((current) => ({
      ...current,
      ...template,
    }));
  };
  const dreSummary = useMemo(() => {
    const registrationRevenueCents = periodPaymentSummary.totalPago;
    const otherRevenueCents = manualSummary.incomeCents;
    const totalRevenueCents = registrationRevenueCents + otherRevenueCents;
    const totalExpenseCents = manualSummary.expenseCents;
    const operatingResultCents = totalRevenueCents - totalExpenseCents;
    const projectedRevenueCents =
      periodPaymentSummary.totalPendente +
      periodPaymentSummary.totalExpirado +
      manualSummary.openReceivableCents;
    const projectedExpenseCents = manualSummary.openPayableCents;

    return {
      registrationRevenueCents,
      otherRevenueCents,
      totalRevenueCents,
      totalExpenseCents,
      operatingResultCents,
      projectedRevenueCents,
      projectedExpenseCents,
      marginPercent:
        totalRevenueCents > 0
          ? Number(((operatingResultCents / totalRevenueCents) * 100).toFixed(1))
          : 0,
    };
  }, [
    manualSummary.expenseCents,
    manualSummary.incomeCents,
    manualSummary.openPayableCents,
    manualSummary.openReceivableCents,
    periodPaymentSummary.totalExpirado,
    periodPaymentSummary.totalPago,
    periodPaymentSummary.totalPendente,
  ]);
  const delinquencyRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        athleteName: string;
        athleteEmail: string;
        openAmountCents: number;
        overdueAmountCents: number;
        chargesCount: number;
        expiredCount: number;
        nextDueAt: string | null;
        latestEventName: string | null;
      }
    >();

    periodPayments
      .filter((payment) => payment.status === "PENDING" || payment.status === "EXPIRED")
      .forEach((payment) => {
        const key = payment.athleteEmail;
        const current = grouped.get(key) ?? {
          athleteName: payment.athleteName,
          athleteEmail: payment.athleteEmail,
          openAmountCents: 0,
          overdueAmountCents: 0,
          chargesCount: 0,
          expiredCount: 0,
          nextDueAt: payment.expiresAt ?? null,
          latestEventName: payment.eventName,
        };

        current.openAmountCents += payment.amountCents;
        current.chargesCount += 1;
        if (payment.status === "EXPIRED" || payment.dueState === "OVERDUE") {
          current.overdueAmountCents += payment.amountCents;
        }
        if (payment.status === "EXPIRED") current.expiredCount += 1;
        if (payment.expiresAt) {
          current.nextDueAt =
            !current.nextDueAt || new Date(payment.expiresAt) < new Date(current.nextDueAt)
              ? payment.expiresAt
              : current.nextDueAt;
        }
        current.latestEventName = payment.eventName;
        grouped.set(key, current);
      });

    manualEntries
      .filter(
        (entry) =>
          entry.entryKind === "RECEIVABLE" &&
          entry.status === "OPEN" &&
          Boolean(entry.subjectUserId || entry.counterparty),
      )
      .forEach((entry) => {
        const counterparty = entry.counterparty ?? "Associado";
        const match = counterparty.match(/^(.*?)(?:\s<(.+?)>)?$/);
        const athleteName = match?.[1]?.trim() || counterparty;
        const athleteEmail =
          match?.[2]?.trim() || `${entry.subjectUserId ?? entry.id}@recorrencia.local`;
        const key = athleteEmail;
        const current = grouped.get(key) ?? {
          athleteName,
          athleteEmail,
          openAmountCents: 0,
          overdueAmountCents: 0,
          chargesCount: 0,
          expiredCount: 0,
          nextDueAt: entry.dueAt,
          latestEventName: entry.category,
        };

        current.openAmountCents += entry.amountCents;
        current.chargesCount += 1;
        if (entry.dueAt && new Date(entry.dueAt).getTime() < Date.now()) {
          current.overdueAmountCents += entry.amountCents;
        }
        if (entry.dueAt) {
          current.nextDueAt =
            !current.nextDueAt || new Date(entry.dueAt) < new Date(current.nextDueAt)
              ? entry.dueAt
              : current.nextDueAt;
        }
        current.latestEventName = entry.category;
        grouped.set(key, current);
      });

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        riskLabel:
          row.overdueAmountCents > 0 || row.expiredCount > 0
            ? "CRITICO"
            : row.chargesCount >= 2
              ? "ATENCAO"
              : "MONITORAR",
      }))
      .sort((left, right) => {
        if (right.overdueAmountCents !== left.overdueAmountCents) {
          return right.overdueAmountCents - left.overdueAmountCents;
        }
        return right.openAmountCents - left.openAmountCents;
      });
  }, [manualEntries, periodPayments]);
  const delinquencySummary = useMemo(
    () => ({
      athletes: delinquencyRows.length,
      openAmountCents: delinquencyRows.reduce((sum, row) => sum + row.openAmountCents, 0),
      overdueAmountCents: delinquencyRows.reduce((sum, row) => sum + row.overdueAmountCents, 0),
      criticalCount: delinquencyRows.filter((row) => row.riskLabel === "CRITICO").length,
    }),
    [delinquencyRows],
  );
  const costCenterPerformanceRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        costCenter: string;
        incomeCents: number;
        expenseCents: number;
        openReceivableCents: number;
        openPayableCents: number;
      }
    >();

    const ensure = (name: string) => {
      const key = name.trim() || "Sem centro";
      const current = grouped.get(key) ?? {
        costCenter: key,
        incomeCents: 0,
        expenseCents: 0,
        openReceivableCents: 0,
        openPayableCents: 0,
      };
      grouped.set(key, current);
      return current;
    };

    manualEntries.forEach((entry) => {
      const bucket = ensure(entry.costCenter ?? financeProfile?.defaultCostCenter ?? "Sem centro");
      if (entry.status === "PAID") {
        if (entry.type === "INCOME") bucket.incomeCents += entry.amountCents;
        if (entry.type === "EXPENSE") bucket.expenseCents += entry.amountCents;
      }
      if (entry.status === "OPEN" && entry.entryKind === "RECEIVABLE") {
        bucket.openReceivableCents += entry.amountCents;
      }
      if (entry.status === "OPEN" && entry.entryKind === "PAYABLE") {
        bucket.openPayableCents += entry.amountCents;
      }
    });

    if (periodPaymentSummary.totalPago > 0) {
      const bucket = ensure(financeProfile?.defaultCostCenter ?? "Receita principal");
      bucket.incomeCents += periodPaymentSummary.totalPago;
    }

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        resultCents: row.incomeCents - row.expenseCents,
      }))
      .sort((left, right) => right.resultCents - left.resultCents);
  }, [financeProfile?.defaultCostCenter, manualEntries, periodPaymentSummary.totalPago]);

  const managementReportContext = useMemo(() => {
    const collectableChargeCents = Math.max(
      periodPaymentSummary.totalCobrado - periodPaymentSummary.totalCancelado,
      0,
    );
    const totalCollectedCents = periodPaymentSummary.totalPago;
    const periodInflowCents = totalCollectedCents + currentCashIncomeCents;
    const openChargeCents = periodPaymentSummary.totalPendente + periodPaymentSummary.totalExpirado;
    const totalOpenReceivableCents = openChargeCents + manualSummary.openReceivableCents;
    const committedExpenseCents = manualSummary.openPayableCents;
    const projectedResultCents =
      dreSummary.operatingResultCents +
      dreSummary.projectedRevenueCents -
      dreSummary.projectedExpenseCents;
    const netOpenPositionCents = totalOpenReceivableCents - committedExpenseCents;
    const workingCapitalCents = closingCashBalanceCents + netOpenPositionCents;
    const collectionRate =
      collectableChargeCents > 0 ? (totalCollectedCents / collectableChargeCents) * 100 : 0;
    const openRate =
      collectableChargeCents > 0 ? (openChargeCents / collectableChargeCents) * 100 : 0;
    const expenseRatio =
      periodInflowCents > 0 ? (currentCashExpenseCents / periodInflowCents) * 100 : 0;
    const cashVariationCents = closingCashBalanceCents - openingCashBalanceCents;
    const worstCostCenter =
      costCenterPerformanceRows.length > 0
        ? [...costCenterPerformanceRows].sort(
            (left, right) => left.resultCents - right.resultCents,
          )[0]
        : null;

    return {
      cashVariationCents,
      collectionRate,
      committedExpenseCents,
      expenseRatio,
      netOpenPositionCents,
      openChargeCents,
      openRate,
      periodInflowCents,
      projectedResultCents,
      totalOpenReceivableCents,
      workingCapitalCents,
      worstCostCenter,
    };
  }, [
    closingCashBalanceCents,
    costCenterPerformanceRows,
    currentCashExpenseCents,
    currentCashIncomeCents,
    dreSummary.operatingResultCents,
    dreSummary.projectedExpenseCents,
    dreSummary.projectedRevenueCents,
    manualSummary.openPayableCents,
    manualSummary.openReceivableCents,
    openingCashBalanceCents,
    periodPaymentSummary.totalCancelado,
    periodPaymentSummary.totalCobrado,
    periodPaymentSummary.totalExpirado,
    periodPaymentSummary.totalPago,
    periodPaymentSummary.totalPendente,
  ]);

  const managementReportExecutiveSummary = useMemo<ManagementReportExecutiveSummary>(() => {
    const hasNoMovement =
      managementReportContext.periodInflowCents === 0 &&
      managementReportContext.totalOpenReceivableCents === 0 &&
      currentCashExpenseCents === 0;
    const hasNegativeProjection = managementReportContext.projectedResultCents < 0;
    const hasNegativeCash = closingCashBalanceCents < 0;
    const hasCriticalReceivable = delinquencySummary.criticalCount > 0;
    const hasHighPressure =
      managementReportContext.openRate >= 30 || managementReportContext.expenseRatio >= 85;
    const tone = hasNoMovement
      ? "neutral"
      : hasNegativeProjection || hasNegativeCash
        ? "danger"
        : hasCriticalReceivable || hasHighPressure
          ? "warning"
          : "positive";

    return {
      statusLabel:
        tone === "positive"
          ? "Saudavel"
          : tone === "danger"
            ? "Critico"
            : tone === "warning"
              ? "Atencao"
              : "Sem movimento",
      title:
        tone === "positive"
          ? "Resultado sob controle"
          : tone === "danger"
            ? "Fechamento pede acao imediata"
            : tone === "warning"
              ? "Fechamento com pontos de atencao"
              : "Sem movimentacao no recorte",
      value: BRL.format(managementReportContext.projectedResultCents / 100),
      description:
        tone === "neutral"
          ? "Ainda nao ha entradas, saidas ou contas abertas suficientes para leitura executiva neste periodo."
          : `Resultado projetado combina operacao realizada, recebiveis abertos e compromissos em aberto de ${periodLabel}.`,
      detail: `Caixa final ${BRL.format(closingCashBalanceCents / 100)}; posicao aberta ${BRL.format(
        managementReportContext.netOpenPositionCents / 100,
      )}; capital apos abertos ${BRL.format(managementReportContext.workingCapitalCents / 100)}.`,
      tone,
    };
  }, [
    closingCashBalanceCents,
    currentCashExpenseCents,
    delinquencySummary.criticalCount,
    managementReportContext.expenseRatio,
    managementReportContext.netOpenPositionCents,
    managementReportContext.openRate,
    managementReportContext.periodInflowCents,
    managementReportContext.projectedResultCents,
    managementReportContext.totalOpenReceivableCents,
    managementReportContext.workingCapitalCents,
    periodLabel,
  ]);

  const managementReportMetrics = useMemo<ManagementReportMetric[]>(
    () => [
      {
        label: "Recebimento",
        value: formatPercent(managementReportContext.collectionRate),
        tone:
          managementReportContext.collectionRate >= 75
            ? "highlight"
            : managementReportContext.collectionRate >= 50
              ? "warning"
              : "danger",
        description: "Pago sobre cobrancas validas.",
      },
      {
        label: "Em aberto",
        value: BRL.format(managementReportContext.totalOpenReceivableCents / 100),
        tone: managementReportContext.totalOpenReceivableCents > 0 ? "warning" : "highlight",
        description: "Cobrancas e recebiveis sem baixa.",
      },
      {
        label: "Despesa/entrada",
        value: formatPercent(managementReportContext.expenseRatio),
        tone:
          managementReportContext.expenseRatio <= 70
            ? "highlight"
            : managementReportContext.expenseRatio <= 90
              ? "warning"
              : "danger",
        description: "Saidas pagas sobre entradas realizadas.",
      },
      {
        label: "Resultado proj.",
        value: BRL.format(managementReportContext.projectedResultCents / 100),
        tone: managementReportContext.projectedResultCents >= 0 ? "highlight" : "danger",
        description: "Resultado realizado mais abertos.",
      },
      {
        label: "Saldo final",
        value: BRL.format(closingCashBalanceCents / 100),
        tone: closingCashBalanceCents >= openingCashBalanceCents ? "highlight" : "warning",
        description: `Variacao ${BRL.format(managementReportContext.cashVariationCents / 100)}.`,
      },
      {
        label: "Casos criticos",
        value: delinquencySummary.criticalCount,
        tone: delinquencySummary.criticalCount === 0 ? "highlight" : "danger",
        description: "Associados com atraso ou expirado.",
      },
    ],
    [
      closingCashBalanceCents,
      delinquencySummary.criticalCount,
      managementReportContext.cashVariationCents,
      managementReportContext.collectionRate,
      managementReportContext.expenseRatio,
      managementReportContext.projectedResultCents,
      managementReportContext.totalOpenReceivableCents,
      openingCashBalanceCents,
    ],
  );

  const managementReportActions = useMemo<ManagementReportAction[]>(() => {
    const actions: ManagementReportAction[] = [];

    if (delinquencySummary.criticalCount > 0) {
      actions.push({
        title: "Priorizar cobranca critica",
        description: `${delinquencySummary.criticalCount} associado(s) com atraso ou cobranca expirada.`,
        href: "#finance-overview",
        tone: "danger",
        metric: BRL.format(delinquencySummary.overdueAmountCents / 100),
      });
    }

    if (managementReportContext.openChargeCents > 0) {
      actions.push({
        title: "Converter cobrancas abertas",
        description: "Revisar titulos pendentes/expirados antes do fechamento.",
        href: "#finance-charges",
        tone: managementReportContext.openRate >= 30 ? "warning" : "neutral",
        metric: BRL.format(managementReportContext.openChargeCents / 100),
      });
    }

    if (manualSummary.openPayableCents > 0) {
      actions.push({
        title: "Programar contas a pagar",
        description: "Separar caixa para compromissos em aberto e evitar surpresa no saldo final.",
        href: "#finance-ledger",
        tone: "warning",
        metric: BRL.format(manualSummary.openPayableCents / 100),
      });
    }

    if (managementReportContext.expenseRatio >= 85) {
      actions.push({
        title: "Revisar pressao de despesas",
        description: "A relacao saida/entrada esta alta para o recorte selecionado.",
        href: "#finance-overview",
        tone: managementReportContext.expenseRatio >= 100 ? "danger" : "warning",
        metric: formatPercent(managementReportContext.expenseRatio),
      });
    }

    if (
      managementReportContext.worstCostCenter &&
      managementReportContext.worstCostCenter.resultCents < 0
    ) {
      actions.push({
        title: "Ajustar centro deficitario",
        description: `${managementReportContext.worstCostCenter.costCenter} encerra o recorte com resultado negativo.`,
        href: "#finance-overview",
        tone: "warning",
        metric: BRL.format(managementReportContext.worstCostCenter.resultCents / 100),
      });
    }

    if (actions.length === 0) {
      actions.push({
        title: "Manter rotina de fechamento",
        description: "Sem risco critico neste recorte; mantenha conciliacao e baixas atualizadas.",
        href: "#finance-overview",
        tone: "positive",
        metric: "OK",
      });
    }

    return actions.slice(0, 4);
  }, [
    delinquencySummary.criticalCount,
    delinquencySummary.overdueAmountCents,
    managementReportContext.expenseRatio,
    managementReportContext.openChargeCents,
    managementReportContext.openRate,
    managementReportContext.worstCostCenter,
    manualSummary.openPayableCents,
  ]);

  const managementReportInsights = useMemo<ManagementReportInsight[]>(() => {
    const mainCostCenter = costCenterPerformanceRows[0];
    const focusCostCenter =
      managementReportContext.worstCostCenter &&
      managementReportContext.worstCostCenter.resultCents < 0
        ? managementReportContext.worstCostCenter
        : mainCostCenter;

    return [
      {
        title: "DRE gerencial",
        value: BRL.format(dreSummary.operatingResultCents / 100),
        description: `Margem ${formatPercent(dreSummary.marginPercent)} com receitas, despesas e resultado operacional de ${periodLabel}.`,
        href: "#finance-overview",
        tone: dreSummary.operatingResultCents >= 0 ? "positive" : "danger",
        actionLabel: dreSummary.operatingResultCents >= 0 ? "Positivo" : "Revisar",
      },
      {
        title: "Fluxo de caixa",
        value: BRL.format(closingCashBalanceCents / 100),
        description: `Variacao de caixa no periodo: ${BRL.format(managementReportContext.cashVariationCents / 100)}.`,
        href: "#finance-overview",
        tone: closingCashBalanceCents >= openingCashBalanceCents ? "positive" : "warning",
        actionLabel: closingCashBalanceCents >= openingCashBalanceCents ? "Estavel" : "Atencao",
      },
      {
        title: "Contas abertas",
        value: BRL.format(managementReportContext.netOpenPositionCents / 100),
        description: `Recebiveis abertos ${BRL.format(managementReportContext.totalOpenReceivableCents / 100)} contra compromissos de ${BRL.format(managementReportContext.committedExpenseCents / 100)}.`,
        href: "#finance-ledger",
        tone: managementReportContext.netOpenPositionCents >= 0 ? "positive" : "warning",
        actionLabel: managementReportContext.netOpenPositionCents >= 0 ? "Coberto" : "Ajustar",
      },
      {
        title: "Inadimplencia",
        value: BRL.format(delinquencySummary.overdueAmountCents / 100),
        description: `${delinquencySummary.criticalCount} caso(s) critico(s) para priorizar na cobranca.`,
        href: "#finance-overview",
        tone: delinquencySummary.criticalCount > 0 ? "danger" : "positive",
        actionLabel: delinquencySummary.criticalCount > 0 ? "Acionar" : "OK",
      },
      {
        title: "Centro de custo",
        value: focusCostCenter ? focusCostCenter.costCenter : "Sem dados",
        description: focusCostCenter
          ? `Resultado do foco: ${BRL.format(focusCostCenter.resultCents / 100)}.`
          : "Classifique lancamentos por centro de custo para abrir esta leitura.",
        href: "#finance-overview",
        tone: focusCostCenter
          ? focusCostCenter.resultCents < 0
            ? "warning"
            : "positive"
          : "neutral",
        actionLabel: focusCostCenter ? "Abrir" : "Configurar",
      },
      {
        title: "Projecao financeira",
        value: BRL.format(managementReportContext.projectedResultCents / 100),
        description: `Entradas realizadas: ${BRL.format(managementReportContext.periodInflowCents / 100)}; abertos entram na projecao.`,
        href: "#finance-reports",
        tone: managementReportContext.projectedResultCents >= 0 ? "positive" : "warning",
        actionLabel: managementReportContext.projectedResultCents >= 0 ? "Viavel" : "Rever",
      },
    ];
  }, [
    closingCashBalanceCents,
    costCenterPerformanceRows,
    delinquencySummary.criticalCount,
    delinquencySummary.overdueAmountCents,
    dreSummary.marginPercent,
    dreSummary.operatingResultCents,
    managementReportContext.cashVariationCents,
    managementReportContext.committedExpenseCents,
    managementReportContext.netOpenPositionCents,
    managementReportContext.periodInflowCents,
    managementReportContext.projectedResultCents,
    managementReportContext.totalOpenReceivableCents,
    managementReportContext.worstCostCenter,
    openingCashBalanceCents,
    periodLabel,
  ]);

  const financeTabMetrics = useMemo<
    Record<FinanceTab, { label: string; value: string | number; tone: FinanceMenuTone }>
  >(
    () => ({
      dashboard: {
        label: "Saldo final",
        value: BRL.format(closingCashBalanceCents / 100),
        tone: closingCashBalanceCents >= openingCashBalanceCents ? "positive" : "warning",
      },
      receive: {
        label: "A receber",
        value: BRL.format(managementReportContext.totalOpenReceivableCents / 100),
        tone: managementReportContext.totalOpenReceivableCents > 0 ? "warning" : "positive",
      },
      pay: {
        label: "A pagar",
        value: BRL.format(manualSummary.openPayableCents / 100),
        tone: manualSummary.openPayableCents > 0 ? "warning" : "positive",
      },
      cash: {
        label: "Movimentos",
        value: cashEntries.length,
        tone: cashEntries.length > 0 ? "info" : "neutral",
      },
      delinquency: {
        label: "Criticos",
        value: delinquencySummary.criticalCount,
        tone: delinquencySummary.criticalCount > 0 ? "danger" : "positive",
      },
      costCenters: {
        label: "Centros",
        value: costCenterPerformanceRows.length,
        tone: costCenterPerformanceRows.some((row) => row.resultCents < 0) ? "warning" : "positive",
      },
      reports: {
        label: "Proj.",
        value: BRL.format(managementReportContext.projectedResultCents / 100),
        tone: managementReportContext.projectedResultCents >= 0 ? "positive" : "warning",
      },
    }),
    [
      cashEntries.length,
      closingCashBalanceCents,
      costCenterPerformanceRows,
      delinquencySummary.criticalCount,
      managementReportContext.projectedResultCents,
      managementReportContext.totalOpenReceivableCents,
      manualSummary.openPayableCents,
      openingCashBalanceCents,
    ],
  );

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

  const exportManagementReportCsv = () => {
    const lines: Array<Array<string | number>> = [
      ["Relatorio financeiro gerencial"],
      ["Periodo", periodLabel],
      [],
      ["Resumo executivo"],
      ["Status", managementReportExecutiveSummary.statusLabel],
      ["Titulo", managementReportExecutiveSummary.title],
      ["Resultado projetado", managementReportExecutiveSummary.value],
      ["Leitura", managementReportExecutiveSummary.description],
      ["Detalhe", managementReportExecutiveSummary.detail],
      [],
      ["Indicadores"],
      ["Indicador", "Valor", "Leitura"],
      ...managementReportMetrics.map((metric) => [
        metric.label,
        metric.value,
        metric.description ?? "",
      ]),
      [],
      ["Acoes prioritarias"],
      ["Acao", "Metrica", "Descricao"],
      ...managementReportActions.map((action) => [action.title, action.metric, action.description]),
      [],
      ["Leituras"],
      ["Relatorio", "Indicador", "Status", "Descricao"],
      ...managementReportInsights.map((insight) => [
        insight.title,
        insight.value,
        insight.actionLabel,
        insight.description,
      ]),
      [],
      ["Fechamento"],
      ["Saldo inicial", BRL.format(openingCashBalanceCents / 100)],
      [
        "Entradas do periodo",
        BRL.format((periodPaymentSummary.totalPago + currentCashIncomeCents) / 100),
      ],
      ["Saidas do periodo", BRL.format(currentCashExpenseCents / 100)],
      ["Saldo final", BRL.format(closingCashBalanceCents / 100)],
      [],
      ["DRE simplificada"],
      ["Receita com inscricoes", BRL.format(dreSummary.registrationRevenueCents / 100)],
      ["Outras receitas", BRL.format(dreSummary.otherRevenueCents / 100)],
      ["Despesa operacional", BRL.format(dreSummary.totalExpenseCents / 100)],
      ["Resultado operacional", BRL.format(dreSummary.operatingResultCents / 100)],
      ["Margem", formatPercent(dreSummary.marginPercent)],
      ["Receita prevista", BRL.format(dreSummary.projectedRevenueCents / 100)],
      ["Despesa comprometida", BRL.format(dreSummary.projectedExpenseCents / 100)],
      [],
      ["Inadimplencia"],
      ["Associados em aberto", delinquencySummary.athletes],
      ["Carteira em aberto", BRL.format(delinquencySummary.openAmountCents / 100)],
      ["Em atraso", BRL.format(delinquencySummary.overdueAmountCents / 100)],
      ["Casos criticos", delinquencySummary.criticalCount],
      [],
      ["Centros de custo"],
      ["Centro", "Receitas", "Despesas", "Resultado", "A receber", "A pagar"],
      ...costCenterPerformanceRows.map((row) => [
        row.costCenter,
        BRL.format(row.incomeCents / 100),
        BRL.format(row.expenseCents / 100),
        BRL.format(row.resultCents / 100),
        BRL.format(row.openReceivableCents / 100),
        BRL.format(row.openPayableCents / 100),
      ]),
    ];

    const csv = lines
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const csvWithBom = `\uFEFF${csv}`;
    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `financeiro-relatorio-gerencial-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Relatorio gerencial exportado.");
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
    if (
      financeProfile?.requireDueDateForOpenEntries &&
      entryForm.status === "OPEN" &&
      !entryForm.dueAt
    ) {
      toast.error("Essa assessoria exige vencimento para titulos em aberto.");
      return;
    }
    if (!financeProfile?.allowManualCashbook && entryForm.entryKind === "CASH") {
      toast.error("O livro-caixa manual esta desabilitado para esta assessoria.");
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
          dueAt: entryForm.dueAt
            ? new Date(`${entryForm.dueAt}T12:00:00.000Z`).toISOString()
            : null,
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
        entryKind: financeProfile?.defaultEntryKind ?? "CASH",
        status: "PAID",
        amount: "",
        category: "",
        description: "",
        accountCode: financeProfile?.defaultAccountCode ?? "MENSALIDADE",
        costCenter: financeProfile?.defaultCostCenter ?? "Associacao",
        counterparty: "",
        paymentMethod: financeProfile?.defaultPaymentMethod ?? "PIX",
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

  const runEntryAction = async (entryId: string, action: "MARK_PAID" | "REOPEN" | "CANCEL") => {
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
      cell: (row) => (
        <span className="font-semibold text-white">{BRL.format(row.amountCents / 100)}</span>
      ),
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
      cell: (row) => (
        <span className="font-semibold text-white">{BRL.format(row.amountCents / 100)}</span>
      ),
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
  const delinquencyColumns: DataTableColumn<(typeof delinquencyRows)[number]>[] = [
    {
      key: "athlete",
      header: "Associado",
      className: "min-w-[180px]",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.athleteName}</p>
          <p className="text-[11px] text-white/40">{row.athleteEmail}</p>
        </div>
      ),
    },
    {
      key: "risk",
      header: "Risco",
      className: "min-w-[100px]",
      cell: (row) => (
        <StatusBadge
          tone={
            row.riskLabel === "CRITICO"
              ? "danger"
              : row.riskLabel === "ATENCAO"
                ? "warning"
                : "neutral"
          }
          label={row.riskLabel}
        />
      ),
    },
    {
      key: "openAmount",
      header: "Em aberto",
      className: "min-w-[110px]",
      cell: (row) => (
        <span className="font-semibold text-white">{BRL.format(row.openAmountCents / 100)}</span>
      ),
    },
    {
      key: "overdueAmount",
      header: "Em atraso",
      className: "min-w-[110px]",
      cell: (row) => (
        <span className="font-semibold text-white">{BRL.format(row.overdueAmountCents / 100)}</span>
      ),
    },
    {
      key: "charges",
      header: "Titulos",
      className: "min-w-[80px]",
      cell: (row) => row.chargesCount,
    },
    {
      key: "dueDate",
      header: "Prox. vencimento",
      className: "min-w-[120px]",
      cell: (row) =>
        row.nextDueAt ? format(new Date(row.nextDueAt), "dd/MM/yyyy", { locale: ptBR }) : "-",
    },
    {
      key: "latestEvent",
      header: "Ultimo contexto",
      className: "min-w-[180px]",
      cell: (row) => row.latestEventName ?? "-",
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

  const runRecurringGeneration = async () => {
    setRunningRecurring(true);
    try {
      const result = await processRecurringCharges({
        monthKey: recurringMonthKey,
        accessToken,
      });
      toast.success(
        `${result.generatedCount} mensalidade(s) gerada(s) e ${result.skippedCount} ja existente(s).`,
      );
      await loadPayments();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao processar mensalidades recorrentes.",
      );
    } finally {
      setRunningRecurring(false);
    }
  };

  return (
    <ProfileCockpit
      role={UserRole.FINANCE}
      title="Financeiro e conciliação"
      subtitle="Centro operacional de cobranças PIX com fila de trabalho, conciliação e histórico."
      eyebrow="Controle financeiro"
      metrics={[
        {
          label: "Entradas do período",
          value: BRL.format((periodPaymentSummary.totalPago + currentCashIncomeCents) / 100),
          description: `Fechamento de ${periodLabel}.`,
          icon: Wallet,
          tone: "green",
        },
        {
          label: "Em aberto",
          value: BRL.format(queue.totalOpenAmount / 100),
          description: `${queue.totalOpenCount} cobrança(s) pendente(s).`,
          icon: ClipboardList,
          tone: "amber",
        },
        {
          label: "Saldo final",
          value: BRL.format(closingCashBalanceCents / 100),
          description: "Caixa inicial, entradas e saídas consolidadas.",
          icon: BarChart3,
          tone: "cyan",
        },
      ]}
      actions={[
        {
          href: "#finance-reports",
          label: "Relatórios",
          description: "DRE, fluxo de caixa e exportação gerencial.",
          icon: FileText,
        },
        {
          href: "#finance-cashbook",
          label: "Caixa",
          description: "Entradas, saídas e lançamentos manuais.",
          icon: Wallet,
        },
        {
          href: "#finance-ledger",
          label: "Contas",
          description: "Títulos a pagar, a receber e baixas.",
          icon: CreditCard,
        },
      ]}
      focusItems={[
        {
          title: "Cobranças vencidas",
          description: `${queue.overdueCount} cobrança(s), somando ${BRL.format(
            queue.overdueAmount / 100,
          )}.`,
          status: "Cobrança",
          href: "#finance-overview",
        },
        {
          title: "Fluxo do período",
          description: `Entradas de ${BRL.format(
            (periodPaymentSummary.totalPago + currentCashIncomeCents) / 100,
          )} e saídas de ${BRL.format(currentCashExpenseCents / 100)}.`,
          status: "Caixa",
          href: "#finance-cashbook",
        },
        {
          title: "Resultado gerencial",
          description:
            dreSummary.operatingResultCents >= 0
              ? "Resultado operacional positivo no recorte atual."
              : "Resultado operacional negativo pede revisão de despesas ou cobrança.",
          status: "DRE",
          href: "#finance-reports",
        },
      ]}
      activityItems={queueRows.slice(0, 4).map((row) => ({
        title: row.athleteName,
        description: `${row.eventName} - ${dueLabel(row)} - ${BRL.format(row.amountCents / 100)}`,
        status: row.status,
      }))}
      insightItems={[
        {
          title: "Carteira em aberto",
          description: `${queue.totalOpenCount} título(s) abertos para acompanhamento.`,
          status: "Receber",
        },
        {
          title: "Contas futuras",
          description: `${BRL.format(manualSummary.openPayableCents / 100)} em contas a pagar.`,
          status: "Pagar",
        },
        {
          title: "Conciliação",
          description: `${queue.recentSettlementsCount} baixa(s) recente(s) para conferência.`,
          status: "PIX",
        },
      ]}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ActionButton intent="secondary" onClick={() => void loadPayments()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </ActionButton>
        <ActionButton onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </ActionButton>
      </div>

      <SectionCard
        title="Modulo financeiro da associacao"
        description="Escolha uma aba para ver somente o que aquele nivel precisa operar ou acompanhar."
      >
        <ModuleTabs
          tabs={FINANCE_TABS.map((tab) => {
            const metric = financeTabMetrics[tab.key];
            return {
              ...tab,
              metricLabel: metric.label,
              metricValue: metric.value,
              metricTone: metric.tone,
            };
          })}
          activeTab={activeFinanceTab}
          onChange={(tab) => {
            setActiveFinanceTab(tab);
            if (tab === "pay") setLedgerTypeFilter("EXPENSE");
          }}
        />

        {activeFinanceTab === "receive" && financeProfile?.recurringChargeEnabled ? (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/40">Competencia</p>
              <Input
                type="month"
                value={recurringMonthKey}
                onChange={(event) => setRecurringMonthKey(event.target.value)}
                className="mt-2 w-[200px] border-white/[0.1] bg-white/[0.05] text-white"
              />
            </div>
            <div className="text-sm text-white/65">
              <p>
                Mensalidade configurada:{" "}
                <span className="font-semibold text-white">
                  {BRL.format((financeProfile.recurringMonthlyFeeCents ?? 0) / 100)}
                </span>
              </p>
              <p className="mt-1">
                Vencimento base no dia {financeProfile.billingDay ?? 5} com{" "}
                {financeProfile.recurringGraceDays} dia(s) extras.
              </p>
            </div>
            <ActionButton disabled={runningRecurring} onClick={() => void runRecurringGeneration()}>
              {runningRecurring ? "Processando mensalidades..." : "Gerar mensalidades do mes"}
            </ActionButton>
          </div>
        ) : null}
      </SectionCard>

      <div id="finance-reports" className={activeFinanceTab === "reports" ? "space-y-6" : "hidden"}>
        <ManagementReportsSection
          periodLabel={periodLabel}
          executiveSummary={managementReportExecutiveSummary}
          metrics={managementReportMetrics}
          insights={managementReportInsights}
          actions={managementReportActions}
          onExport={exportManagementReportCsv}
        />
      </div>

      <div id="finance-overview" className="space-y-6">
        {financeProfile ? (
          <SectionCard
            className={activeFinanceTab === "dashboard" ? undefined : "hidden"}
            title="Regra financeira da assessoria"
            description="Configuracao base para operar como um financeiro de grupo, assessoria ou associacao."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Modelo" value={businessModelLabel(financeProfile.businessModel)} />
              <MetricCard
                label="Receita principal"
                value={revenueModeLabel(financeProfile.revenueMode)}
              />
              <MetricCard
                label="Dia de cobranca"
                value={
                  financeProfile.billingDay ? `Dia ${financeProfile.billingDay}` : "Nao definido"
                }
              />
              <MetricCard label="Centro padrao" value={financeProfile.defaultCostCenter} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-wide text-white/40">Categorias padrao</p>
                <p className="mt-2 text-sm text-white/75">{financeProfile.categories.join(", ")}</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-wide text-white/40">Formas de pagamento</p>
                <p className="mt-2 text-sm text-white/75">
                  {financeProfile.paymentMethods.join(", ")}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-wide text-white/40">Regras operacionais</p>
                <p className="mt-2 text-sm text-white/75">
                  {financeProfile.requireDueDateForOpenEntries
                    ? "Titulos abertos exigem vencimento"
                    : "Vencimento opcional"}
                  {" · "}
                  {financeProfile.allowManualCashbook
                    ? "Livro-caixa liberado"
                    : "Livro-caixa manual bloqueado"}
                </p>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          className={activeFinanceTab === "dashboard" ? undefined : "hidden"}
          title="Resumo financeiro"
          description="Indicadores consolidados para decisao rapida"
        >
          <div className="grid gap-3 md:grid-cols-5">
            <MetricCard
              label="Total cobrado"
              value={BRL.format(periodPaymentSummary.totalCobrado / 100)}
            />
            <MetricCard
              label="Total pago"
              value={BRL.format(periodPaymentSummary.totalPago / 100)}
              tone="highlight"
            />
            <MetricCard
              label="Pendente"
              value={BRL.format(periodPaymentSummary.totalPendente / 100)}
            />
            <MetricCard
              label="Expirado"
              value={BRL.format(periodPaymentSummary.totalExpirado / 100)}
            />
            <MetricCard
              label="Cancelado"
              value={BRL.format(periodPaymentSummary.totalCancelado / 100)}
            />
          </div>
        </SectionCard>

        <SectionCard
          className={activeFinanceTab === "dashboard" ? undefined : "hidden"}
          title="Visao contábil da associacao"
          description="Leitura rápida de caixa, contas em aberto e movimento manual."
        >
          <div className="grid gap-3 md:grid-cols-5">
            <MetricCard
              label="Entradas realizadas"
              value={BRL.format(manualSummary.incomeCents / 100)}
              tone="highlight"
            />
            <MetricCard
              label="Saidas realizadas"
              value={BRL.format(manualSummary.expenseCents / 100)}
            />
            <MetricCard label="Saldo caixa" value={BRL.format(manualSummary.balanceCents / 100)} />
            <MetricCard
              label="A receber"
              value={BRL.format(manualSummary.openReceivableCents / 100)}
            />
            <MetricCard label="A pagar" value={BRL.format(manualSummary.openPayableCents / 100)} />
          </div>
        </SectionCard>

        <SectionCard
          className={activeFinanceTab === "dashboard" ? undefined : "hidden"}
          title="Fechamento do periodo"
          description={`Saldo inicial, movimentacao e fechamento para ${periodLabel}.`}
        >
          <div className="grid gap-3 md:grid-cols-5">
            <MetricCard label="Saldo inicial" value={BRL.format(openingCashBalanceCents / 100)} />
            <MetricCard
              label="Entradas do periodo"
              value={BRL.format((periodPaymentSummary.totalPago + currentCashIncomeCents) / 100)}
              tone="highlight"
            />
            <MetricCard
              label="Saidas do periodo"
              value={BRL.format(currentCashExpenseCents / 100)}
            />
            <MetricCard label="Saldo final" value={BRL.format(closingCashBalanceCents / 100)} />
            <MetricCard
              label="Variacao liquida"
              value={BRL.format((closingCashBalanceCents - openingCashBalanceCents) / 100)}
            />
          </div>
        </SectionCard>

        <SectionCard
          className={activeFinanceTab === "reports" ? undefined : "hidden"}
          title="Fluxo de caixa"
          description="Entradas, saidas e saldo acumulado ao longo do periodo."
        >
          {cashFlowSeries.length === 0 ? (
            <EmptyState
              title="Sem movimento de caixa no periodo"
              description="Os recebimentos e saidas aparecerao aqui assim que houver baixa financeira."
            />
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.45)"
                    tickLine={false}
                    axisLine={false}
                  />
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
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="Saldo"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    dot={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          className={activeFinanceTab === "reports" ? undefined : "hidden"}
          title="DRE simplificada"
          description={`Leitura gerencial do resultado de ${periodLabel}.`}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Receita com inscricoes"
              value={BRL.format(dreSummary.registrationRevenueCents / 100)}
              tone="highlight"
            />
            <MetricCard
              label="Outras receitas"
              value={BRL.format(dreSummary.otherRevenueCents / 100)}
            />
            <MetricCard
              label="Despesa operacional"
              value={BRL.format(dreSummary.totalExpenseCents / 100)}
            />
            <MetricCard
              label="Resultado operacional"
              value={BRL.format(dreSummary.operatingResultCents / 100)}
              tone={dreSummary.operatingResultCents >= 0 ? "highlight" : "default"}
            />
            <MetricCard label="Margem" value={`${dreSummary.marginPercent}%`} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-wide text-white/40">Receita prevista</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {BRL.format(dreSummary.projectedRevenueCents / 100)}
              </p>
              <p className="mt-1 text-xs text-white/50">
                Soma de cobrancas pendentes e contas a receber abertas.
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-wide text-white/40">Despesa comprometida</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {BRL.format(dreSummary.projectedExpenseCents / 100)}
              </p>
              <p className="mt-1 text-xs text-white/50">Contas a pagar abertas aguardando baixa.</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-wide text-white/40">Leitura rapida</p>
              <p className="mt-2 text-sm text-white/75">
                {dreSummary.operatingResultCents >= 0
                  ? "O periodo esta positivo, com espaco para reinvestimento ou reserva."
                  : "O periodo esta negativo e pede ajuste de despesas ou aceleracao de cobranca."}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className={activeFinanceTab === "costCenters" ? undefined : "hidden"}
          title="Resultado por centro de custo"
          description="Visao consolidada por frente da operacao para decidir onde investir ou cortar."
        >
          {costCenterPerformanceRows.length === 0 ? (
            <EmptyState
              title="Sem centros de custo no periodo"
              description="Os resultados aparecem aqui conforme os lancamentos ganham centro de custo."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
              <table className="min-w-full text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Centro</th>
                    <th className="px-3 py-2 text-left">Receitas</th>
                    <th className="px-3 py-2 text-left">Despesas</th>
                    <th className="px-3 py-2 text-left">Resultado</th>
                    <th className="px-3 py-2 text-left">A receber</th>
                    <th className="px-3 py-2 text-left">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {costCenterPerformanceRows.map((row) => (
                    <tr key={row.costCenter} className="border-t border-white/[0.07]">
                      <td className="px-3 py-2 font-semibold text-white">{row.costCenter}</td>
                      <td className="px-3 py-2 text-white/70">
                        {BRL.format(row.incomeCents / 100)}
                      </td>
                      <td className="px-3 py-2 text-white/70">
                        {BRL.format(row.expenseCents / 100)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={row.resultCents >= 0 ? "positive" : "danger"}
                          label={BRL.format(row.resultCents / 100)}
                        />
                      </td>
                      <td className="px-3 py-2 text-white/70">
                        {BRL.format(row.openReceivableCents / 100)}
                      </td>
                      <td className="px-3 py-2 text-white/70">
                        {BRL.format(row.openPayableCents / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          className={activeFinanceTab === "delinquency" ? undefined : "hidden"}
          title="Inadimplencia por associado"
          description="Quem esta segurando caixa e onde o financeiro deve agir primeiro."
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Associados em aberto" value={delinquencySummary.athletes} />
            <MetricCard
              label="Carteira em aberto"
              value={BRL.format(delinquencySummary.openAmountCents / 100)}
            />
            <MetricCard
              label="Em atraso"
              value={BRL.format(delinquencySummary.overdueAmountCents / 100)}
              tone="highlight"
            />
            <MetricCard
              label="Casos criticos"
              value={delinquencySummary.criticalCount}
              tone="highlight"
            />
          </div>
          {delinquencyRows.length === 0 ? (
            <EmptyState
              title="Sem inadimplencia no periodo"
              description="Nenhum associado com titulo pendente ou expirado neste recorte."
            />
          ) : (
            <DataTable
              columns={delinquencyColumns}
              data={delinquencyRows.slice(0, 12)}
              getRowKey={(row) => row.athleteEmail}
            />
          )}
        </SectionCard>

        <SectionCard
          className={activeFinanceTab === "delinquency" ? undefined : "hidden"}
          title="Fila de trabalho"
          description="Priorize cobrancas em risco de perda de receita"
        >
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MetricCard label="Abertas" value={queue.totalOpenCount} />
            <MetricCard label="Aberto (R$)" value={BRL.format(queue.totalOpenAmount / 100)} />
            <MetricCard label="Atrasadas" value={queue.overdueCount} tone="highlight" />
            <MetricCard
              label="Atraso (R$)"
              value={BRL.format(queue.overdueAmount / 100)}
              tone="highlight"
            />
            <MetricCard label="Vence hoje" value={queue.dueTodayCount} />
            <MetricCard label="Prox. 7 dias" value={queue.dueSoonCount} />
            <MetricCard label="Sem vencimento" value={queue.noDueDateCount} />
            <MetricCard label="Baixas 24h" value={queue.recentSettlementsCount} tone="highlight" />
          </div>

          <div className="mt-4">
            {loading ? (
              <LoadingState lines={3} />
            ) : queueRows.length === 0 ? (
              <EmptyState
                title="Sem cobrancas pendentes na fila"
                description="Nao ha cobrancas abertas para acao imediata."
              />
            ) : (
              <DataTable columns={queueColumns} data={queueRows} getRowKey={(row) => row.id} />
            )}
          </div>
        </SectionCard>
      </div>

      <div id="finance-cashbook" className={activeFinanceTab === "cash" ? "space-y-6" : "hidden"}>
        <SectionCard
          title="Livro-caixa"
          description="Entradas e saídas avulsas com plano de contas, centro de custo e baixa manual."
        >
          {financeProfile ? (
            <div className="mb-4 space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/75"
                  onClick={() =>
                    applyQuickTemplate({
                      type: "INCOME",
                      entryKind: "RECEIVABLE",
                      status: "OPEN",
                      category: financeCategoryOptions[0] ?? "Mensalidades",
                      accountCode: financeProfile.defaultAccountCode,
                      costCenter: financeProfile.defaultCostCenter,
                      paymentMethod: financeProfile.defaultPaymentMethod,
                      description: financeQuickNotes[0] ?? "Mensalidade recorrente do associado",
                    })
                  }
                >
                  Mensalidade / recorrencia
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/75"
                  onClick={() =>
                    applyQuickTemplate({
                      type: "INCOME",
                      entryKind: "RECEIVABLE",
                      status: "OPEN",
                      category: financeCategoryOptions[1] ?? "Inscricoes",
                      accountCode: "INSCRICAO_EVENTO",
                      costCenter: financeCostCenterOptions[1] ?? financeProfile.defaultCostCenter,
                      description: financeQuickNotes[1] ?? "Inscricao ou reembolso de prova",
                    })
                  }
                >
                  Evento / inscricao
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/75"
                  onClick={() =>
                    applyQuickTemplate({
                      type: "INCOME",
                      entryKind: "RECEIVABLE",
                      status: "OPEN",
                      category: financeCategoryOptions[2] ?? "Patrocinios",
                      accountCode: "PATROCINIO",
                      description: financeQuickNotes[2] ?? "Patrocinio ou parceria comercial",
                    })
                  }
                >
                  Patrocinio
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/75"
                  onClick={() =>
                    applyQuickTemplate({
                      type: "EXPENSE",
                      entryKind: "PAYABLE",
                      status: "OPEN",
                      category: financeCategoryOptions[3] ?? "Equipe tecnica",
                      accountCode: "EQUIPE_TECNICA",
                      costCenter: financeCostCenterOptions[2] ?? financeProfile.defaultCostCenter,
                      description: "Pagamento de equipe, staff ou fornecedor",
                    })
                  }
                >
                  Equipe / fornecedor
                </button>
              </div>
              <p className="text-xs text-white/50">
                O formulario abaixo usa as regras definidas em Configuracoes da assessoria.
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-5">
            <MetricCard label="Saldo inicial" value={BRL.format(openingCashBalanceCents / 100)} />
            <MetricCard
              label="Entradas caixa"
              value={BRL.format((periodPaymentSummary.totalPago + currentCashIncomeCents) / 100)}
              tone="highlight"
            />
            <MetricCard label="Saidas caixa" value={BRL.format(currentCashExpenseCents / 100)} />
            <MetricCard label="Saldo final" value={BRL.format(closingCashBalanceCents / 100)} />
            <MetricCard label="Lancamentos caixa" value={filteredCashEntries.length} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select
              value={cashStatusFilter}
              onChange={(event) =>
                setCashStatusFilter(event.target.value as "ALL" | "OPEN" | "PAID" | "CANCELLED")
              }
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="ALL">Status do caixa</option>
              <option value="PAID">Baixado</option>
              <option value="OPEN">Em aberto</option>
              <option value="CANCELLED">Cancelado</option>
            </Select>
            <Select
              value={cashTypeFilter}
              onChange={(event) =>
                setCashTypeFilter(event.target.value as "ALL" | "INCOME" | "EXPENSE")
              }
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
              onChange={(event) =>
                setEntryForm((current) => ({
                  ...current,
                  type: event.target.value as "INCOME" | "EXPENSE",
                }))
              }
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="INCOME">Entrada</option>
              <option value="EXPENSE">Saida</option>
            </Select>
            <Select
              value={entryForm.entryKind}
              onChange={(event) =>
                setEntryForm((current) => ({
                  ...current,
                  entryKind: event.target.value as "CASH" | "RECEIVABLE" | "PAYABLE",
                }))
              }
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              {financeProfile?.allowManualCashbook ? (
                <option value="CASH">Livro-caixa</option>
              ) : null}
              <option value="RECEIVABLE">Conta a receber</option>
              <option value="PAYABLE">Conta a pagar</option>
            </Select>
            <Select
              value={entryForm.status}
              onChange={(event) =>
                setEntryForm((current) => ({
                  ...current,
                  status: event.target.value as "OPEN" | "PAID" | "CANCELLED",
                }))
              }
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="PAID">Pago/baixado</option>
              <option value="OPEN">Em aberto</option>
              <option value="CANCELLED">Cancelado</option>
            </Select>
            <Input
              value={entryForm.amount}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="Valor R$"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            />
            <Input
              value={entryForm.category}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, category: event.target.value }))
              }
              placeholder="Categoria"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
              list="finance-categories"
            />
            <datalist id="finance-categories">
              {financeCategoryOptions.length > 0 ? (
                financeCategoryOptions.map((item) => <option key={item} value={item} />)
              ) : (
                <>
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
                </>
              )}
            </datalist>
            <Input
              type="date"
              value={entryForm.occurredAt}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, occurredAt: event.target.value }))
              }
              className="border-white/[0.1] bg-white/[0.05] text-white"
            />
            <Input
              value={entryForm.description}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Descricao"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            />
            <Input
              type="date"
              value={entryForm.dueAt}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, dueAt: event.target.value }))
              }
              className="border-white/[0.1] bg-white/[0.05] text-white"
            />
            <Input
              value={entryForm.accountCode}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, accountCode: event.target.value }))
              }
              placeholder="Plano de contas"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            />
            <Input
              value={entryForm.costCenter}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, costCenter: event.target.value }))
              }
              placeholder="Centro de custo"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
              list="finance-cost-centers"
            />
            <datalist id="finance-cost-centers">
              {financeCostCenterOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <Input
              value={entryForm.counterparty}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, counterparty: event.target.value }))
              }
              placeholder="Associado, fornecedor ou parceiro"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            />
            <Input
              value={entryForm.paymentMethod}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, paymentMethod: event.target.value }))
              }
              placeholder="Forma de pagamento"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
              list="finance-payment-methods"
            />
            <datalist id="finance-payment-methods">
              {financePaymentMethodOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <Input
              value={entryForm.documentUrl}
              onChange={(event) =>
                setEntryForm((current) => ({ ...current, documentUrl: event.target.value }))
              }
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
              <EmptyState
                title="Sem movimentos no livro-caixa"
                description="Entradas e saidas avulsas aparecerao aqui."
              />
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
                        <td className="px-3 py-2 text-white/60">
                          {format(new Date(entry.occurredAt), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={entry.type === "INCOME" ? "positive" : "warning"}
                            label={entry.type === "INCOME" ? "Entrada" : "Saida"}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={
                              entry.status === "PAID"
                                ? "positive"
                                : entry.status === "OPEN"
                                  ? "warning"
                                  : "neutral"
                            }
                            label={
                              entry.status === "PAID"
                                ? "Baixado"
                                : entry.status === "OPEN"
                                  ? "Aberto"
                                  : "Cancelado"
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-white">{entry.category}</td>
                        <td className="px-3 py-2 text-white/60">{entry.costCenter ?? "-"}</td>
                        <td className="px-3 py-2 font-semibold text-white">
                          {BRL.format(entry.amountCents / 100)}
                        </td>
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

      <div id="finance-charges" className={activeFinanceTab === "receive" ? "space-y-6" : "hidden"}>
        <SectionCard
          title="Filtros operacionais"
          description="Periodo, status, atleta, prova e vencimento"
        >
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
              onChange={(event) =>
                setStatus(
                  event.target.value as "ALL" | "PENDING" | "PAID" | "EXPIRED" | "CANCELLED",
                )
              }
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
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Cobrado no filtro"
              value={BRL.format(filteredPaymentsSummary.totalCobrado / 100)}
            />
            <MetricCard
              label="Pago no filtro"
              value={BRL.format(filteredPaymentsSummary.totalPago / 100)}
              tone="highlight"
            />
            <MetricCard
              label="Em aberto no filtro"
              value={BRL.format(filteredPaymentsSummary.totalPendente / 100)}
            />
            <MetricCard label="Recebimentos filtrados" value={BRL.format(paidRowsAmount / 100)} />
          </div>
          {loading ? (
            <LoadingState lines={4} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nenhuma cobranca encontrada"
              description="Ajuste os filtros para visualizar os registros."
            />
          ) : (
            <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
          )}
        </SectionCard>
      </div>

      <div id="finance-ledger" className={activeFinanceTab === "pay" ? "space-y-6" : "hidden"}>
        <SectionCard
          title="Contas a pagar"
          description="Fornecedores, obrigacoes, vencimentos e baixas fora do caixa imediato."
        >
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard
              label="A receber"
              value={BRL.format(manualSummary.openReceivableCents / 100)}
              tone="highlight"
            />
            <MetricCard label="A pagar" value={BRL.format(manualSummary.openPayableCents / 100)} />
            <MetricCard
              label="Titulos a receber"
              value={Math.max(ledgerReceivableOpenCount, receivableEntries.length)}
            />
            <MetricCard
              label="Titulos a pagar"
              value={Math.max(ledgerPayableOpenCount, payableEntries.length)}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select
              value={ledgerStatusFilter}
              onChange={(event) =>
                setLedgerStatusFilter(event.target.value as "ALL" | "OPEN" | "PAID" | "CANCELLED")
              }
              className="border-white/[0.1] bg-white/[0.05] text-white"
            >
              <option value="ALL">Status das contas</option>
              <option value="OPEN">Em aberto</option>
              <option value="PAID">Baixadas</option>
              <option value="CANCELLED">Canceladas</option>
            </Select>
            <Select
              value={ledgerTypeFilter}
              onChange={(event) =>
                setLedgerTypeFilter(event.target.value as "ALL" | "INCOME" | "EXPENSE")
              }
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
              Titulos filtrados:{" "}
              <span className="font-semibold text-white">{filteredLedgerEntries.length}</span>
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
                      <EmptyState
                        title="Sem contas abertas no periodo"
                        description="Titulos a pagar e a receber aparecerao aqui."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredLedgerEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/[0.07]">
                      <td className="px-3 py-2 text-white/60">
                        {format(new Date(entry.occurredAt), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={entryKindTone(entry.entryKind)}
                          label={entryKindLabel(entry.entryKind)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={
                            entry.status === "PAID"
                              ? "positive"
                              : entry.status === "OPEN"
                                ? "warning"
                                : "neutral"
                          }
                          label={
                            entry.status === "PAID"
                              ? "Baixado"
                              : entry.status === "OPEN"
                                ? "Aberto"
                                : "Cancelado"
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-white">{entry.category}</td>
                      <td className="px-3 py-2 text-white/60">{entry.counterparty ?? "-"}</td>
                      <td className="px-3 py-2 text-white/60">
                        {entry.dueAt
                          ? format(new Date(entry.dueAt), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </td>
                      <td className="px-3 py-2 font-semibold text-white">
                        {BRL.format(entry.amountCents / 100)}
                      </td>
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
            <EmptyState
              title="Sem recebimentos no periodo"
              description="Pagamentos confirmados aparecerao aqui."
            />
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
                  <ActionButton
                    intent="danger"
                    disabled={runningAction}
                    onClick={() => void runModalAction("cancel", selectedPayment.id)}
                  >
                    Cancelar
                  </ActionButton>
                  <ActionButton
                    intent="secondary"
                    disabled={runningAction}
                    onClick={() => void runModalAction("expire", selectedPayment.id)}
                  >
                    Expirar
                  </ActionButton>
                  <ActionButton
                    disabled={runningAction}
                    onClick={() => void runModalAction("pay", selectedPayment.id)}
                  >
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
                <div className="mt-1">
                  <StatusBadge
                    tone={paymentTone(selectedPayment.status)}
                    label={selectedPayment.status}
                  />
                </div>
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
                <p className="mt-1 text-lg font-semibold text-white">
                  {BRL.format(selectedPayment.amountCents / 100)}
                </p>
              </div>
            </div>

            <PixQrCode
              pixCode={selectedPayment.pixCopyPaste ?? "PIX-DEMO-UNAVAILABLE"}
              expiresAt={
                new Date(
                  selectedPayment.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                )
              }
              amountLabel={BRL.format(selectedPayment.amountCents / 100)}
            />

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3 text-[12px] text-white/55">
              <p>
                Atleta associado: {selectedPayment.athleteName} ({selectedPayment.athleteEmail})
              </p>
              <p className="mt-1">
                Prova: {selectedPayment.eventName} - {selectedPayment.distanceLabel}
              </p>
              <p className="mt-1">Criado em: {formatDateTime(selectedPayment.createdAt)}</p>
              <p className="mt-1">Vencimento: {formatDateTime(selectedPayment.expiresAt)}</p>
              <p className="mt-1">Pago em: {formatDateTime(selectedPayment.paidAt)}</p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.08em] text-white/35">
                Historico da cobranca
              </p>
              <ol className="space-y-2">
                {selectedPayment.history.map((step, index) => (
                  <li
                    key={step.id}
                    className="flex items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2"
                  >
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
          <EmptyState
            title="Cobranca nao encontrada"
            description="Nao foi possivel carregar os detalhes."
          />
        )}
      </Modal>
    </ProfileCockpit>
  );
}
