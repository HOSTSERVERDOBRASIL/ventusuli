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

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const SOURCE_LABELS: Record<string, string> = {
  EVENT_PARTICIPATION: "Participacao em prova",
  EARLY_SIGNUP: "Inscricao antecipada",
  EARLY_PAYMENT: "Pagamento antecipado",
  CAMPAIGN_BONUS: "Campanha",
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

  const loadReport = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error("Informe data inicial e final para carregar o relatÃ³rio.");
      return;
    }
    if (dateRange.start > dateRange.end) {
      toast.error("A data inicial nÃ£o pode ser maior que a data final.");
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

      const [reportResponse, warningsResponse, policyResponse] = await Promise.all([
        fetch(`/api/admin/points/report?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/points/expiring-warnings?daysAhead=30", { cache: "no-store" }),
        fetch("/api/admin/points/policy", { cache: "no-store" }),
      ]);

      const reportPayload = (await reportResponse.json()) as PointsReport;
      const warningsPayload = (await warningsResponse.json()) as { data?: ExpiringWarning[] };
      const policyPayload = (await policyResponse.json()) as { data?: PointPolicy };

      if (!reportResponse.ok) throw new Error("points_report_unavailable");

      setReport(reportPayload);
      setWarnings(warningsPayload.data ?? []);
      setPolicy(policyPayload.data ?? null);
      const rulesResponse = await fetch("/api/admin/points/rules", { cache: "no-store" });
      const rulesPayload = (await rulesResponse.json()) as { data?: PointRule[]; events?: PointRuleEvent[] };
      if (rulesResponse.ok) {
        setRules(rulesPayload.data ?? []);
        setEvents(rulesPayload.events ?? []);
      }
    } catch {
      toast.error("Nao foi possivel carregar o painel de pontos.");
      setReport(null);
      setWarnings([]);
      setRules([]);
      setEvents([]);
      setPolicy(null);
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
        toast.error("Informe um mÃªs vÃ¡lido entre 1 e 12.");
        return;
      }
      if (recurrenceYear < 2000 || recurrenceYear > 2100) {
        toast.error("Informe um ano vÃ¡lido entre 2000 e 2100.");
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
        `RecorrÃªncia concluÃ­da. Mensal: ${payload.monthly?.credited ?? 0} | Trimestral: ${payload.quarterly?.credited ?? 0}.`,
      );
      await loadReport();
    } catch {
      toast.error("Falha ao processar bÃ´nus de recorrÃªncia.");
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
        `ExpiraÃ§Ã£o concluÃ­da. UsuÃ¡rios afetados: ${payload.usersAffected ?? 0} | Pontos expirados: ${payload.pointsExpired ?? 0}.`,
      );
      await loadReport();
    } catch {
      toast.error("Falha ao processar expiraÃ§Ã£o de pontos.");
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
      header: "Atleta Associado",
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
      header: "Atleta Associado",
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
            <MetricCard label="Associados com saldo" value={String(report.activeUsersWithBalance)} />
            <MetricCard
              label="Caixa de resgates"
              value={BRL.format(report.cashCollectedCents / 100)}
            />
          </div>

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
                        setPolicy((prev) =>
                          prev ? { ...prev, pointValueCents: Number(event.target.value) } : prev,
                        )
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
                        setPolicy((prev) =>
                          prev ? { ...prev, expirationMonths: Number(event.target.value) } : prev,
                        )
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
                      setPolicy((prev) =>
                        prev ? { ...prev, athletePolicyText: event.target.value } : prev,
                      )
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
                  {processingExpiration ? "Processando..." : "Rodar expiraÃ§Ã£o agora"}
                </ActionButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Pontos por prova"
            description="Configure quantos pontos cada prova gera para associados"
          >
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
                onChange={(event) => setRuleForm((prev) => ({ ...prev, earlySignupBonus: Number(event.target.value) }))}
                className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                placeholder="Inscricao antecipada"
              />
              <input
                type="number"
                min={0}
                value={ruleForm.earlyPaymentBonus}
                onChange={(event) => setRuleForm((prev) => ({ ...prev, earlyPaymentBonus: Number(event.target.value) }))}
                className="rounded-lg border border-white/15 bg-[#0b1d33] px-3 py-2 text-sm text-white"
                placeholder="Pagamento antecipado"
              />
              <input
                type="number"
                min={0}
                value={ruleForm.campaignBonus}
                onChange={(event) => setRuleForm((prev) => ({ ...prev, campaignBonus: Number(event.target.value) }))}
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
                <DataTable
                  columns={sourceColumns}
                  data={report.pointsBySource}
                  getRowKey={(row) => `${row.sourceType}-${row.type}`}
                />
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
            description="Atletas associados com pontos prestes a expirar (30 dias)"
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
