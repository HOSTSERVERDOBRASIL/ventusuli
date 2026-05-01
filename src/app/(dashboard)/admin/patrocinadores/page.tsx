"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CreditCard, Gift, Handshake, Target } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

const placementAreas = [
  "Dashboard do atleta",
  "Pagina da prova",
  "Galeria de fotos",
  "Recompensas",
  "Resultados",
];

type SponsorsTab = "overview" | "campaigns" | "metrics";

export default function AdminPatrocinadoresPage() {
  const [activeTab, setActiveTab] = useState<SponsorsTab>("overview");
  const tabs = useMemo<ModuleTabItem<SponsorsTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Comercial",
        description: "Patrocinadores, campanhas, receita e produtos.",
        icon: Handshake,
        metricLabel: "Patrocinadores",
        metricValue: 0,
        metricTone: "neutral",
      },
      {
        key: "campaigns",
        label: "Campanhas",
        audience: "Operacao",
        description: "Contratos, placements, budget e ativacoes.",
        icon: Target,
        metricLabel: "Ativas",
        metricValue: 0,
        metricTone: "neutral",
      },
      {
        key: "metrics",
        label: "Metricas",
        audience: "Diretoria",
        description: "Impressoes, cliques, conversoes e cupons.",
        icon: BarChart3,
        metricLabel: "Conversoes",
        metricValue: 0,
        metricTone: "neutral",
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patrocinadores"
        subtitle="Gestao de marcas, campanhas, placements, cupons, produtos e metricas comerciais."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/admin/financeiro">Ver financeiro</Link>
          </ActionButton>
        }
      />

      <SectionCard
        title="Modulo de patrocinadores"
        description="Separe visao comercial, campanhas e metricas em abas."
      >
        <ModuleTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          columnsClassName="md:grid-cols-3"
        />
      </SectionCard>

      <div className={activeTab === "overview" ? "grid gap-3 sm:grid-cols-4" : "hidden"}>
        <MetricCard label="Patrocinadores" value="0" icon={Handshake} tone="highlight" />
        <MetricCard label="Campanhas ativas" value="0" icon={Target} />
        <MetricCard label="Receita" value="R$ 0" icon={CreditCard} />
        <MetricCard label="Produtos" value="0" icon={Gift} />
      </div>

      <div className={activeTab === "campaigns" ? "grid gap-4 xl:grid-cols-[1.2fr_0.8fr]" : "hidden"}>
        <SectionCard title="Campanhas" description="Contratos, periodo, budget, pontos patrocinados e status.">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Patrocinador</th>
                  <th className="px-3 py-2 text-left">Campanha</th>
                  <th className="px-3 py-2 text-left">Budget</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-3 py-8">
                    <EmptyState title="Sem campanhas" description="Campanhas cadastradas aparecerao aqui." />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Placements" description="Areas onde campanhas podem ser ativadas.">
          <div className="space-y-2">
            {placementAreas.map((area) => (
              <div key={area} className="rounded-xl border border-white/10 bg-[#102640] px-3 py-3 text-sm text-slate-200">
                {area}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className={activeTab === "metrics" ? undefined : "hidden"}
        title="Metricas"
        description="Impressoes, cliques, conversoes, cupons e receita por patrocinador."
      >
        <div className="grid gap-3 md:grid-cols-4">
          {["Impressoes", "Cliques", "Conversoes", "Cupons usados"].map((label) => (
            <div key={label} className="rounded-xl border border-white/10 bg-[#102640] p-4">
              <div className="flex items-center gap-2 text-slate-300">
                <BarChart3 className="h-4 w-4 text-sky-300" />
                <p className="text-xs uppercase tracking-wide">{label}</p>
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">0</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
