import { MetricStrip } from "@/components/system/metric-strip";
import { AthletesListSummary } from "@/services/types";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AthletesSummaryCards({ summary }: { summary: AthletesListSummary }) {
  return (
    <MetricStrip
      columnsClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      items={[
        { label: "Associados", value: summary.totalAthletes },
        { label: "Ativos", value: summary.active, tone: "positive" },
        { label: "Pendente aprovação", value: summary.pendingApproval, tone: "highlight" },
        { label: "Com matrícula", value: summary.withMemberNumber ?? 0 },
        { label: "Em aberto", value: BRL.format(summary.totalPendingCents / 100), tone: "warning" },
        { label: "Receita historica", value: BRL.format(summary.totalPaidCents / 100) },
      ]}
    />
  );
}
