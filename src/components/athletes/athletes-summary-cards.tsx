import { MetricCard } from "@/components/system/metric-card";
import { AthletesListSummary } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AthletesSummaryCards({ summary }: { summary: AthletesListSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <MetricCard label="Total atletas" value={summary.totalAthletes} />
      <MetricCard label="Ativos" value={summary.active} />
      <MetricCard label="Pendente aprovação" value={summary.pendingApproval} tone="highlight" />
      <MetricCard label="Rejeitados/Bloqueados" value={summary.rejected + summary.blocked} />
      <MetricCard label="Em aberto" value={BRL.format(summary.totalPendingCents / 100)} />
      <MetricCard label="Receita historica" value={BRL.format(summary.totalPaidCents / 100)} />
    </div>
  );
}
