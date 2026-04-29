import Link from "next/link";
import { BarChart3, Gift, Handshake, Ticket, Trophy } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

export default function PatrocinadoresPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Patrocinadores"
        subtitle="Campanhas, cupons, produtos patrocinados e beneficios vinculados as provas."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/recompensas">Ver recompensas</Link>
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Ativos" value="0" icon={Handshake} tone="highlight" />
        <MetricCard label="Campanhas" value="0" icon={BarChart3} />
        <MetricCard label="Cupons" value="0" icon={Ticket} />
        <MetricCard label="Produtos" value="0" icon={Gift} />
      </div>

      <SectionCard title="Patrocinadores ativos" description="Marcas vinculadas a beneficios, provas e campanhas.">
        <EmptyState
          title="Sem patrocinadores publicados"
          description="Patrocinadores ativos e beneficios disponiveis aparecerao aqui."
          action={
            <ActionButton asChild intent="secondary">
              <Link href="/provas">Ver provas</Link>
            </ActionButton>
          }
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        {["Campanhas", "Produtos patrocinados", "Cupons"].map((title) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-[#102640] p-4 text-white">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200">
              <Trophy className="h-5 w-5" />
            </div>
            <p className="text-lg font-semibold">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Itens ativos vinculados a patrocinadores serao exibidos neste bloco.</p>
          </article>
        ))}
      </div>
    </div>
  );
}
