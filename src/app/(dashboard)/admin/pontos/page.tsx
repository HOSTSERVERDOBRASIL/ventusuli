"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
  pointsBySource: Array<{ sourceType: string; type: string; points: number; count: number }>;
  recentMovements: Array<{
    id: string;
    sourceType: string;
    type: string;
    points: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
    athleteName: string | null;
    athleteEmail: string | null;
    eventName: string | null;
  }>;
}

interface ExpiringWarning {
  userId: string;
  userName: string;
  userEmail: string;
  pointsExpiring: number;
}

interface PointRule {
  id: string;
  eventId: string | null;
  basePoints: number;
  earlySignupBonus: number;
  earlyPaymentBonus: number;
  campaignBonus: number;
  active: boolean;
  updatedAt: string;
}

interface PointRuleEvent {
  id: string;
  name: string;
  eventDate: string;
}

interface PointPolicy {
  pointValueCents: number;
  expirationMonths: number;
  athletePolicyText: string;
}

interface PointActivity {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  suggestedPoints: number;
  activityDate: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PointActivityEntry {
  id: string;
  organizationId: string;
  activityId: string;
  userId: string;
  points: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  source: "ADMIN" | "USER";
  note: string | null;
  proofUrl: string | null;
  referenceCode: string;
  ledgerEntryId: string | null;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  activityName: string | null;
  userName: string | null;
  userEmail: string | null;
}

interface PointActivityEntriesResponse {
  data: PointActivityEntry[];
  total: number;
  page: number;
  totalPages: number;
}

interface AthleteOption {
  id: string;
  name: string;
  email: string;
  memberNumber: string | null;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATETIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const SOURCE_LABELS: Record<string, string> = {
  EVENT_PARTICIPATION: "Participacao em prova",
  EARLY_SIGNUP: "Inscricao antecipada",
  EARLY_PAYMENT: "Pagamento antecipado",
  CAMPAIGN_BONUS: "Campanha",
  ACTIVITY_APPROVAL: "Atividade aprovada",
  REFERRAL: "Indicacao",
  RECURRENCE: "Recorrencia",
  MANUAL: "Ajuste manual",
  REDEMPTION: "Resgate",
  REFUND: "Estorno",
  EXPIRATION: "Expiracao",
};

const SOURCE_OPTIONS = [
  { value: "", label: "Todas as origens" },
  { value: "EVENT_PARTICIPATION", label: "Participacao em prova" },
  { value: "EARLY_SIGNUP", label: "Inscricao antecipada" },
  { value: "EARLY_PAYMENT", label: "Pagamento antecipado" },
  { value: "CAMPAIGN_BONUS", label: "Campanha" },
  { value: "ACTIVITY_APPROVAL", label: "Atividade aprovada" },
  { value: "MANUAL", label: "Ajuste manual" },
  { value: "REDEMPTION", label: "Resgate" },
  { value: "EXPIRATION", label: "Expiracao" },
];

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATETIME.format(date);
}

function statusTone(status: PointActivityEntry["status"]) {
  if (status === "APPROVED") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (status === "REJECTED") return "border-rose-400/20 bg-rose-500/10 text-rose-200";
  return "border-amber-400/20 bg-amber-500/10 text-amber-100";
}

function statusLabel(status: PointActivityEntry["status"]) {
  if (status === "APPROVED") return "Aprovado";
  if (status === "REJECTED") return "Reprovado";
  return "Pendente";
}

function sourceLabel(source: PointActivityEntry["source"]) {
  return source === "ADMIN" ? "Lancado pelo admin" : "Solicitado pelo usuario";
}

function PointsVisualBanner({
  issuedPoints,
  pendingCount,
  activeActivities,
}: {
  issuedPoints: number;
  pendingCount: number;
  activeActivities: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1d33] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
      <Image
        src="/auth/campeche.webp"
        alt="Praia do Campeche em Florianopolis"
        fill
        priority
        sizes="(min-width: 1280px) 1180px, 100vw"
        className="object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,17,31,0.96),rgba(7,17,31,0.74),rgba(7,17,31,0.5))]" />
      <div className="relative grid min-h-[210px] gap-6 p-5 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-7">
        <div className="flex max-w-2xl flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f7b529]">
            Programa de pontos
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
            Recompense participacao sem perder controle de aprovacao.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">
            Visualize emissao, fila de revisao e atividades ativas antes de liberar saldo para os associados.
          </p>
        </div>
        <div className="grid content-end gap-3 sm:grid-cols-3 lg:content-center">
          <div className="rounded-xl border border-white/12 bg-black/25 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Emitidos</p>
            <p className="mt-2 text-lg font-semibold text-white">{issuedPoints} pts</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/25 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Pendentes</p>
            <p className="mt-2 text-lg font-semibold text-white">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-black/25 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Atividades</p>
            <p className="mt-2 text-lg font-semibold text-white">{activeActivities}</p>
          </div>
        </div>
      </div>
    </section>
  );
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
  const [rules, setRules] = useState<PointRule[]>([]);
  const [events, setEvents] = useState<PointRuleEvent[]>([]);
  const [policy, setPolicy] = useState<PointPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [filters, setFilters] = useState({ eventId: "", sourceType: "" });
  const [savingRule, setSavingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    eventId: "",
    basePoints: 10,
    earlySignupBonus: 5,
    earlyPaymentBonus: 3,
    campaignBonus: 0,
    active: true,
  });
  const [activities, setActivities] = useState<PointActivity[]>([]);
  const [entries, setEntries] = useState<PointActivityEntry[]>([]);
  const [entryMeta, setEntryMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [activityFilters, setActivityFilters] = useState({ status: "PENDING", activityId: "", userId: "" });
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [creatingEntry, setCreatingEntry] = useState(false);
  const [reviewingEntryId, setReviewingEntryId] = useState<string | null>(null);
  const [activityForm, setActivityForm] = useState({
    name: "",
    description: "",
    suggestedPoints: 50,
    activityDate: new Date().toISOString().slice(0, 16),
  });
  const [entryForm, setEntryForm] = useState({
    activityId: "",
    userId: "",
    points: 0,
    note: "",
    proofUrl: "",
  });

  const loadEntries = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(entryMeta.page),
      limit: "20",
    });
    if (activityFilters.status) params.set("status", activityFilters.status);
    if (activityFilters.activityId) params.set("activityId", activityFilters.activityId);
    if (activityFilters.userId) params.set("userId", activityFilters.userId);

    const response = await fetch(`/api/admin/points/entries?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as PointActivityEntriesResponse;
    if (!response.ok) throw new Error("entries_unavailable");
    setEntries(payload.data ?? []);
    setEntryMeta({
      total: payload.total ?? 0,
      page: payload.page ?? 1,
      totalPages: payload.totalPages ?? 1,
    });
  }, [activityFilters.activityId, activityFilters.status, activityFilters.userId, entryMeta.page]);

  const loadReport = useCallback(async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error("Informe data inicial e final para carregar o relatorio.");
      return;
    }
    if (dateRange.start > dateRange.end) {
      toast.error("A data inicial nao pode ser maior que a data final.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: `${dateRange.start}T00:00:00.000Z`,
        endDate: `${dateRange.end}T23:59:59.999Z`,
      });
      if (filters.eventId) params.set("eventId", filters.eventId);
      if (filters.sourceType) params.set("sourceType", filters.sourceType);

      const [
        reportResponse,
        warningsResponse,
        policyResponse,
        rulesResponse,
        activitiesResponse,
        athletesResponse,
      ] = await Promise.all([
        fetch(`/api/admin/points/report?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/points/expiring-warnings?daysAhead=30", { cache: "no-store" }),
        fetch("/api/admin/points/policy", { cache: "no-store" }),
        fetch("/api/admin/points/rules", { cache: "no-store" }),
        fetch("/api/admin/points/activities?active=true", { cache: "no-store" }),
        fetch("/api/admin/athletes?status=ACTIVE&page=1&pageSize=100", { cache: "no-store" }),
      ]);

      const reportPayload = (await reportResponse.json()) as PointsReport;
      const warningsPayload = (await warningsResponse.json()) as { data?: ExpiringWarning[] };
      const policyPayload = (await policyResponse.json()) as { data?: PointPolicy };
      const rulesPayload = (await rulesResponse.json()) as { data?: PointRule[]; events?: PointRuleEvent[] };
      const activitiesPayload = (await activitiesResponse.json()) as { data?: PointActivity[] };
      const athletesPayload = (await athletesResponse.json()) as { data?: AthleteOption[] };

      if (!reportResponse.ok) throw new Error("points_report_unavailable");

      setReport(reportPayload);
      setWarnings(warningsPayload.data ?? []);
      setPolicy(policyPayload.data ?? null);
      setRules(rulesResponse.ok ? rulesPayload.data ?? [] : []);
      setEvents(rulesResponse.ok ? rulesPayload.events ?? [] : []);
      const nextActivities = activitiesResponse.ok ? activitiesPayload.data ?? [] : [];
      setActivities(nextActivities);
      setAthletes(athletesResponse.ok ? athletesPayload.data ?? [] : []);
      setEntryForm((prev) => {
        const activityId = prev.activityId || nextActivities[0]?.id || "";
        const selectedActivity = nextActivities.find((item) => item.id === activityId) ?? nextActivities[0];
        return {
          ...prev,
          activityId,
          points: prev.points > 0 ? prev.points : selectedActivity?.suggestedPoints ?? 0,
        };
      });
    } catch {
      toast.error("Nao foi possivel carregar o painel de pontos.");
      setReport(null);
      setWarnings([]);
      setRules([]);
      setEvents([]);
      setPolicy(null);
      setActivities([]);
      setEntries([]);
      setAthletes([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange.end, dateRange.start, filters.eventId, filters.sourceType]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    setEntryMeta((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [activityFilters.activityId, activityFilters.status, activityFilters.userId]);

  const runRecurrence = async () => {
    try {
      if (recurrenceMonth < 1 || recurrenceMonth > 12) {
        toast.error("Informe um mes valido entre 1 e 12.");
        return;
      }
      if (recurrenceYear < 2000 || recurrenceYear > 2100) {
        toast.error("Informe um ano valido entre 2000 e 2100.");
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
        `Recorrencia concluida. Mensal: ${payload.monthly?.credited ?? 0} | Trimestral: ${payload.quarterly?.credited ?? 0}.`,
      );
      await loadReport();
    } catch {
      toast.error("Falha ao processar bonus de recorrencia.");
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
        `Expiracao concluida. Usuarios afetados: ${payload.usersAffected ?? 0} | Pontos expirados: ${payload.pointsExpired ?? 0}.`,
      );
      await loadReport();
    } catch {
      toast.error("Falha ao processar expiracao de pontos.");
    } finally {
      setProcessingExpiration(false);
    }
  };

  const saveRule = async () => {
    setSavingRule(true);
    try {
      const response = await fetch("/api/admin/points/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: ruleForm.eventId || null,
          basePoints: Number(ruleForm.basePoints),
          earlySignupBonus: Number(ruleForm.earlySignupBonus),
          earlyPaymentBonus: Number(ruleForm.earlyPaymentBonus),
          campaignBonus: Number(ruleForm.campaignBonus),
          active: ruleForm.active,
        }),
      });
      if (!response.ok) throw new Error("rule_error");
      toast.success("Regra de pontos salva.");
      await loadReport();
    } catch {
      toast.error("Nao foi possivel salvar a regra de pontos.");
    } finally {
      setSavingRule(false);
    }
  };

  const savePolicy = async () => {
    if (!policy) return;
    setSavingPolicy(true);
    try {
      const response = await fetch("/api/admin/points/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const payload = (await response.json()) as { data?: PointPolicy; error?: { message?: string } };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "policy_error");
      }
      setPolicy(payload.data);
      toast.success("Politica de pontos salva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a politica.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const createActivity = async () => {
    if (!activityForm.name.trim()) {
      toast.error("Informe o nome da atividade.");
      return;
    }

    setCreatingActivity(true);
    try {
      const response = await fetch("/api/admin/points/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: activityForm.name.trim(),
          description: activityForm.description.trim() || null,
          suggestedPoints: Number(activityForm.suggestedPoints),
          activityDate: new Date(activityForm.activityDate).toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "activity_create_error");
      }
      toast.success("Atividade criada.");
      setActivityForm({
        name: "",
        description: "",
        suggestedPoints: 50,
        activityDate: new Date().toISOString().slice(0, 16),
      });
      await loadReport();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar a atividade.");
    } finally {
      setCreatingActivity(false);
    }
  };

  const createEntry = async () => {
    if (!entryForm.activityId || !entryForm.userId || entryForm.points <= 0) {
      toast.error("Selecione atividade, associado e quantidade de pontos.");
      return;
    }

    setCreatingEntry(true);
    try {
      const response = await fetch("/api/admin/points/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: entryForm.activityId,
          userId: entryForm.userId,
          points: Number(entryForm.points),
          note: entryForm.note.trim() || null,
          proofUrl: entryForm.proofUrl.trim() || null,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "entry_create_error");
      }
      toast.success("Lancamento criado como pendente.");
      const activity = activities.find((item) => item.id === entryForm.activityId);
      setEntryForm((prev) => ({
        ...prev,
        userId: "",
        points: activity?.suggestedPoints ?? prev.points,
        note: "",
        proofUrl: "",
      }));
      await Promise.all([loadReport(), loadEntries()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar o lancamento.");
    } finally {
      setCreatingEntry(false);
    }
  };

  const reviewEntry = async (entry: PointActivityEntry, action: "APPROVE" | "REJECT") => {
    setReviewingEntryId(entry.id);
    try {
      const response = await fetch(`/api/admin/points/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          points: entry.points,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "entry_review_error");
      }
      toast.success(action === "APPROVE" ? "Lancamento aprovado." : "Lancamento reprovado.");
      await Promise.all([loadReport(), loadEntries()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel revisar o lancamento.");
    } finally {
      setReviewingEntryId(null);
    }
  };

  const topItemsColumns: DataTableColumn<PointsReport["topItems"][number]>[] = [
    { key: "name", header: "Item", cell: (row) => row.name, className: "min-w-[220px]" },
    { key: "count", header: "Resgates", cell: (row) => String(row.count) },
  ];

  const categoryColumns: DataTableColumn<PointsReport["redemptionsByCategory"][number]>[] = [
    { key: "category", header: "Categoria", cell: (row) => row.category, className: "min-w-[180px]" },
    { key: "count", header: "Resgates", cell: (row) => String(row.count) },
    { key: "points", header: "Pontos", cell: (row) => `${row.pointsUsed} pts` },
    { key: "cash", header: "Caixa", cell: (row) => BRL.format(row.cashCollectedCents / 100) },
  ];

  const warningColumns: DataTableColumn<ExpiringWarning>[] = [
    {
      key: "user",
      header: "Atleta associado",
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

  const sourceColumns: DataTableColumn<PointsReport["pointsBySource"][number]>[] = [
    { key: "source", header: "Origem", cell: (row) => SOURCE_LABELS[row.sourceType] ?? row.sourceType },
    { key: "type", header: "Tipo", cell: (row) => row.type },
    { key: "points", header: "Pontos", cell: (row) => `${row.points} pts` },
    { key: "count", header: "Movimentos", cell: (row) => String(row.count) },
  ];

  const movementColumns: DataTableColumn<PointsReport["recentMovements"][number]>[] = [
    {
      key: "athlete",
      header: "Atleta associado",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.athleteName ?? "Atleta"}</p>
          <p className="text-xs text-slate-400">{row.athleteEmail ?? "Sem e-mail"}</p>
        </div>
      ),
      className: "min-w-[220px]",
    },
    { key: "source", header: "Origem", cell: (row) => SOURCE_LABELS[row.sourceType] ?? row.sourceType },
    { key: "points", header: "Pontos", cell: (row) => `${row.points} pts` },
    { key: "balance", header: "Saldo", cell: (row) => `${row.balanceAfter} pts` },
  ];

  const entryColumns: DataTableColumn<PointActivityEntry>[] = [
    {
      key: "activity",
      header: "Atividade",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.activityName ?? "Atividade"}</p>
          <p className="text-xs text-slate-400">{sourceLabel(row.source)}</p>
        </div>
      ),
      className: "min-w-[220px]",
    },
    {
      key: "athlete",
      header: "Associado",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.userName ?? "Usuario"}</p>
          <p className="text-xs text-slate-400">{row.userEmail ?? "Sem e-mail"}</p>
        </div>
      ),
      className: "min-w-[220px]",
    },
    { key: "points", header: "Pontos", cell: (row) => `${row.points} pts` },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusTone(row.status)}`}>
          {statusLabel(row.status)}
        </span>
      ),
    },
    {
      key: "timestamps",
      header: "Auditoria",
      cell: (row) => (
        <div className="text-xs text-slate-300">
          <p>Criado: {formatDateTime(row.createdAt)}</p>
          <p>{row.approvedAt ? `Aprovado: ${formatDateTime(row.approvedAt)}` : row.rejectedAt ? `Reprovado: ${formatDateTime(row.rejectedAt)}` : "Aguardando revisao"}</p>
        </div>
      ),
      className: "min-w-[210px]",
    },
    {
      key: "actions",
      header: "Acoes",
      cell: (row) =>
        row.status === "PENDING" ? (
          <div className="flex gap-2">
            <ActionButton
              className="h-8 px-3 text-xs"
              disabled={reviewingEntryId === row.id}
              onClick={() => void reviewEntry(row, "APPROVE")}
            >
              Aprovar
            </ActionButton>
            <ActionButton
              intent="secondary"
              className="h-8 px-3 text-xs"
              disabled={reviewingEntryId === row.id}
              onClick={() => void reviewEntry(row, "REJECT")}
            >
              Reprovar
            </ActionButton>
          </div>
        ) : (
          <div className="text-xs text-slate-400">{row.note ?? "Sem observacao"}</div>
        ),
      className: "min-w-[180px]",
    },
  ];

  const pendingEntries = useMemo(() => entries.filter((entry) => entry.status === "PENDING"), [entries]);
  const approvedEntries = useMemo(() => entries.filter((entry) => entry.status === "APPROVED"), [entries]);
  const totalApprovedPoints = useMemo(
    () => approvedEntries.reduce((sum, entry) => sum + entry.points, 0),
    [approvedEntries],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pontos admin"
        subtitle="Relatorios, recorrencia, aprovacao manual por atividade e operacao do programa de recompensas."
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
            <select
              value={filters.eventId}
              onChange={(event) => setFilters((prev) => ({ ...prev, eventId: event.target.value }))}
              className="rounded-lg border border-white/20 bg-[#0f2743] px-3 py-2 text-sm text-white"
            >
              <option value="">Todas as provas</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <select
              value={filters.sourceType}
              onChange={(event) => setFilters((prev) => ({ ...prev, sourceType: event.target.value }))}
              className="rounded-lg border border-white/20 bg-[#0f2743] px-3 py-2 text-sm text-white"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ActionButton intent="secondary" type="submit">
              Atualizar
            </ActionButton>
          </form>
        }
      />

      <PointsVisualBanner
        issuedPoints={report?.totalPointsIssued ?? 0}
        pendingCount={pendingEntries.length}
        activeActivities={activities.length}
      />

      {loading || !report ? (
        <LoadingState lines={6} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Pontos emitidos" value={`${report.totalPointsIssued} pts`} tone="highlight" />
            <MetricCard label="Pontos resgatados" value={`${report.totalPointsRedeemed} pts`} />
            <MetricCard label="Pontos expirados" value={`${report.totalPointsExpired} pts`} />
            <MetricCard label="Associados com saldo" value={String(report.activeUsersWithBalance)} />
            <MetricCard label="Caixa de resgates" value={BRL.format(report.cashCollectedCents / 100)} />
          </div>

          <SectionCard
            title="Aprovacao por atividade"
            description="Controle manual para registrar participacoes, validar solicitacoes e liberar pontos so depois da revisao."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Atividades ativas" value={String(activities.length)} />
              <MetricCard label="Pendentes na fila" value={String(pendingEntries.length)} />
              <MetricCard label="Aprovados na pagina" value={String(approvedEntries.length)} />
              <MetricCard label="Pontos aprovados" value={`${totalApprovedPoints} pts`} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1.2fr]">
              <div className="rounded-2xl border border-white/10 bg-[#0c1f35] p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white">Nova atividade</p>
                  <p className="text-xs text-slate-400">Cadastre a atividade com pontos sugeridos para orientar os lancamentos.</p>
                </div>
                <div className="grid gap-3">
                  <input
                    value={activityForm.name}
                    onChange={(event) => setActivityForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                    placeholder="Nome da atividade"
                  />
                  <textarea
                    value={activityForm.description}
                    onChange={(event) => setActivityForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-[96px] rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                    placeholder="Descricao, regras ou observacoes"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="number"
                      min={0}
                      value={activityForm.suggestedPoints}
                      onChange={(event) =>
                        setActivityForm((prev) => ({ ...prev, suggestedPoints: Number(event.target.value) }))
                      }
                      className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                      placeholder="Pontos sugeridos"
                    />
                    <input
                      type="datetime-local"
                      value={activityForm.activityDate}
                      onChange={(event) => setActivityForm((prev) => ({ ...prev, activityDate: event.target.value }))}
                      className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <ActionButton disabled={creatingActivity} onClick={() => void createActivity()}>
                    {creatingActivity ? "Criando..." : "Criar atividade"}
                  </ActionButton>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0c1f35] p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white">Novo lancamento pendente</p>
                  <p className="text-xs text-slate-400">Use para lancamento direto do admin ou para revisar depois em dupla aprovacao.</p>
                </div>
                <div className="grid gap-3">
                  <select
                    value={entryForm.activityId}
                    onChange={(event) => {
                      const activityId = event.target.value;
                      const activity = activities.find((item) => item.id === activityId);
                      setEntryForm((prev) => ({
                        ...prev,
                        activityId,
                        points: activity?.suggestedPoints ?? prev.points,
                      }));
                    }}
                    className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecione a atividade</option>
                    {activities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={entryForm.userId}
                    onChange={(event) => setEntryForm((prev) => ({ ...prev, userId: event.target.value }))}
                    className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                  >
                    <option value="">Selecione o associado</option>
                    {athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>
                        {athlete.name} {athlete.memberNumber ? `- ${athlete.memberNumber}` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={entryForm.points}
                    onChange={(event) => setEntryForm((prev) => ({ ...prev, points: Number(event.target.value) }))}
                    className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                    placeholder="Quantidade de pontos"
                  />
                  <textarea
                    value={entryForm.note}
                    onChange={(event) => setEntryForm((prev) => ({ ...prev, note: event.target.value }))}
                    className="min-h-[84px] rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                    placeholder="Observacao para auditoria"
                  />
                  <input
                    value={entryForm.proofUrl}
                    onChange={(event) => setEntryForm((prev) => ({ ...prev, proofUrl: event.target.value }))}
                    className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                    placeholder="URL do comprovante (opcional)"
                  />
                  <ActionButton disabled={creatingEntry} onClick={() => void createEntry()}>
                    {creatingEntry ? "Salvando..." : "Criar pendencia"}
                  </ActionButton>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Fila de aprovacao"
            description="Revise solicitacoes dos usuarios e lancamentos administrativos antes de liberar os pontos no saldo."
            action={
              <div className="flex flex-wrap gap-2">
                <select
                  value={activityFilters.status}
                  onChange={(event) => {
                    setEntryMeta((prev) => ({ ...prev, page: 1 }));
                    setActivityFilters((prev) => ({ ...prev, status: event.target.value }));
                  }}
                  className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                >
                  <option value="PENDING">Pendentes</option>
                  <option value="APPROVED">Aprovados</option>
                  <option value="REJECTED">Reprovados</option>
                  <option value="">Todos</option>
                </select>
                <select
                  value={activityFilters.activityId}
                  onChange={(event) => {
                    setEntryMeta((prev) => ({ ...prev, page: 1 }));
                    setActivityFilters((prev) => ({ ...prev, activityId: event.target.value }));
                  }}
                  className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                >
                  <option value="">Todas as atividades</option>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
                </select>
                <select
                  value={activityFilters.userId}
                  onChange={(event) => {
                    setEntryMeta((prev) => ({ ...prev, page: 1 }));
                    setActivityFilters((prev) => ({ ...prev, userId: event.target.value }));
                  }}
                  className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                >
                  <option value="">Todos os associados</option>
                  {athletes.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>
                      {athlete.name}
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            {entries.length === 0 ? (
              <EmptyState title="Sem lancamentos" description="As solicitacoes e os lancamentos pendentes aparecerao aqui." />
            ) : (
              <div className="space-y-3">
                <DataTable columns={entryColumns} data={entries} getRowKey={(row) => row.id} />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {entryMeta.total} registro(s) | pagina {entryMeta.page} de {entryMeta.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <ActionButton
                      intent="secondary"
                      className="h-8 px-3 text-xs"
                      disabled={entryMeta.page <= 1}
                      onClick={() => setEntryMeta((prev) => ({ ...prev, page: prev.page - 1 }))}
                    >
                      Anterior
                    </ActionButton>
                    <ActionButton
                      intent="secondary"
                      className="h-8 px-3 text-xs"
                      disabled={entryMeta.page >= entryMeta.totalPages}
                      onClick={() => setEntryMeta((prev) => ({ ...prev, page: prev.page + 1 }))}
                    >
                      Proxima
                    </ActionButton>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {policy ? (
            <SectionCard
              title="Politica de pontos"
              description="Regras oficiais exibidas aos atletas e usadas nos calculos de desconto"
            >
              <div className="grid gap-3 md:grid-cols-[180px_180px_1fr]">
                <label className="space-y-1 text-sm text-slate-200">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Valor do ponto</span>
                  <div className="flex items-center rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2">
                    <span className="text-slate-400">R$</span>
                    <input
                      type="number"
                      min={1}
                      value={policy.pointValueCents}
                      onChange={(event) =>
                        setPolicy((prev) => (prev ? { ...prev, pointValueCents: Number(event.target.value) } : prev))
                      }
                      className="ml-2 w-full bg-transparent text-sm text-white outline-none"
                    />
                    <span className="text-xs text-slate-400">centavos</span>
                  </div>
                </label>
                <label className="space-y-1 text-sm text-slate-200">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Validade</span>
                  <div className="flex items-center rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={policy.expirationMonths}
                      onChange={(event) =>
                        setPolicy((prev) => (prev ? { ...prev, expirationMonths: Number(event.target.value) } : prev))
                      }
                      className="w-full bg-transparent text-sm text-white outline-none"
                    />
                    <span className="text-xs text-slate-400">meses</span>
                  </div>
                </label>
                <label className="space-y-1 text-sm text-slate-200">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Texto para o atleta</span>
                  <textarea
                    value={policy.athletePolicyText}
                    onChange={(event) =>
                      setPolicy((prev) => (prev ? { ...prev, athletePolicyText: event.target.value } : prev))
                    }
                    className="min-h-[86px] w-full rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
              </div>
              <div className="mt-3">
                <ActionButton disabled={savingPolicy} onClick={() => void savePolicy()}>
                  {savingPolicy ? "Salvando..." : "Salvar politica"}
                </ActionButton>
              </div>
            </SectionCard>
          ) : null}

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
                  <ActionButton disabled={processingRecurrence} onClick={() => void runRecurrence()}>
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
                  {processingExpiration ? "Processando..." : "Rodar expiracao agora"}
                </ActionButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Pontos por prova" description="Configure quantos pontos cada prova gera para associados">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <select
                value={ruleForm.eventId}
                onChange={(event) => setRuleForm((prev) => ({ ...prev, eventId: event.target.value }))}
                className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white xl:col-span-2"
              >
                <option value="">Regra padrao da assessoria</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={ruleForm.basePoints}
                onChange={(event) => setRuleForm((prev) => ({ ...prev, basePoints: Number(event.target.value) }))}
                className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                placeholder="Participacao"
              />
              <input
                type="number"
                min={0}
                value={ruleForm.earlySignupBonus}
                onChange={(event) =>
                  setRuleForm((prev) => ({ ...prev, earlySignupBonus: Number(event.target.value) }))
                }
                className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                placeholder="Inscricao antecipada"
              />
              <input
                type="number"
                min={0}
                value={ruleForm.earlyPaymentBonus}
                onChange={(event) =>
                  setRuleForm((prev) => ({ ...prev, earlyPaymentBonus: Number(event.target.value) }))
                }
                className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                placeholder="Pagamento antecipado"
              />
              <input
                type="number"
                min={0}
                value={ruleForm.campaignBonus}
                onChange={(event) =>
                  setRuleForm((prev) => ({ ...prev, campaignBonus: Number(event.target.value) }))
                }
                className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                placeholder="Bonus campanha"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={ruleForm.active}
                  onChange={(event) => setRuleForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Regra ativa
              </label>
              <ActionButton disabled={savingRule} onClick={() => void saveRule()}>
                {savingRule ? "Salvando..." : "Salvar regra"}
              </ActionButton>
            </div>

            <div className="mt-4 grid gap-2">
              {rules.length === 0 ? (
                <EmptyState title="Sem regras configuradas" description="O sistema usa o padrao: 10 pontos por participacao." />
              ) : (
                rules.map((rule) => {
                  const event = events.find((item) => item.id === rule.eventId);
                  return (
                    <div key={rule.id} className="rounded-xl border border-white/10 bg-[#0c1f35] p-3 text-sm text-slate-200">
                      <p className="font-semibold text-white">{event?.name ?? "Regra padrao da assessoria"}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        Participacao: {rule.basePoints} pts | Inscricao antecipada: {rule.earlySignupBonus} pts | Pagamento antecipado: {rule.earlyPaymentBonus} pts | Campanha: {rule.campaignBonus} pts
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Pontos por origem" description="Distribuicao de creditos, debitos e expiracoes">
              {report.pointsBySource.length === 0 ? (
                <EmptyState title="Sem movimentos" description="Nenhuma movimentacao no periodo filtrado." />
              ) : (
                <DataTable columns={sourceColumns} data={report.pointsBySource} getRowKey={(row) => `${row.sourceType}-${row.type}`} />
              )}
            </SectionCard>

            <SectionCard title="Movimentos recentes" description="Auditoria dos ultimos lancamentos de pontos">
              {report.recentMovements.length === 0 ? (
                <EmptyState title="Sem movimentos" description="Nenhum lancamento encontrado." />
              ) : (
                <DataTable columns={movementColumns} data={report.recentMovements} getRowKey={(row) => row.id} />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Resgates por categoria" description="Performance comercial por classe de recompensa">
              {report.redemptionsByCategory.length === 0 ? (
                <EmptyState title="Sem dados" description="Nenhum resgate no periodo selecionado." />
              ) : (
                <DataTable columns={categoryColumns} data={report.redemptionsByCategory} getRowKey={(row) => row.category} />
              )}
            </SectionCard>

            <SectionCard title="Top itens" description="Itens com maior volume de resgate">
              {report.topItems.length === 0 ? (
                <EmptyState title="Sem dados" description="Nenhum item resgatado no periodo selecionado." />
              ) : (
                <DataTable columns={topItemsColumns} data={report.topItems} getRowKey={(row) => row.rewardItemId} />
              )}
            </SectionCard>
          </div>

          <SectionCard title="Avisos de expiracao" description="Atletas associados com pontos prestes a expirar (30 dias)">
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
