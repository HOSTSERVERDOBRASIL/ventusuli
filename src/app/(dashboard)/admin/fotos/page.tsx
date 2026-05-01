"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Download, Image, ShieldCheck, UploadCloud } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

const pipeline = [
  "Original privado",
  "Preview com watermark",
  "Thumbnail cacheado",
  "Download assinado",
];

type PhotosTab = "overview" | "galleries" | "pricing";

export default function AdminFotosPage() {
  const [activeTab, setActiveTab] = useState<PhotosTab>("overview");
  const tabs = useMemo<ModuleTabItem<PhotosTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Gestao",
        description: "Galerias, publicacoes, downloads e pendencias.",
        icon: Image,
        metricLabel: "Galerias",
        metricValue: 0,
        metricTone: "neutral",
      },
      {
        key: "galleries",
        label: "Galerias",
        audience: "Operacao",
        description: "Organizacao por prova e pipeline de arquivos.",
        icon: Camera,
        metricLabel: "Fotos",
        metricValue: 0,
        metricTone: "neutral",
      },
      {
        key: "pricing",
        label: "Vendas",
        audience: "Comercial",
        description: "Precificacao, pontos, pacotes e desbloqueios.",
        icon: Download,
        metricLabel: "Downloads",
        metricValue: 0,
        metricTone: "neutral",
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotos"
        subtitle="Operacao de galerias, upload, precificacao, desbloqueio por pontos e downloads seguros."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/admin/eventos">Vincular a provas</Link>
          </ActionButton>
        }
      />

      <SectionCard
        title="Modulo de fotos"
        description="Separe indicadores, galerias e regras comerciais em abas."
      >
        <ModuleTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          columnsClassName="md:grid-cols-3"
        />
      </SectionCard>

      <div className={activeTab === "overview" ? "grid gap-3 sm:grid-cols-4" : "hidden"}>
        <MetricCard label="Galerias" value="0" icon={Image} tone="highlight" />
        <MetricCard label="Fotos publicadas" value="0" icon={Camera} />
        <MetricCard label="Downloads liberados" value="0" icon={Download} />
        <MetricCard label="Pendentes" value="0" icon={UploadCloud} />
      </div>

      <div className={activeTab === "galleries" ? "grid gap-4 xl:grid-cols-[1.2fr_0.8fr]" : "hidden"}>
        <SectionCard title="Galerias por prova" description="Publicacao e organizacao comercial por evento.">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Prova</th>
                  <th className="px-3 py-2 text-left">Fotos</th>
                  <th className="px-3 py-2 text-left">Receita</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="px-3 py-8">
                    <EmptyState title="Sem galerias" description="Galerias publicadas por prova aparecerao nesta fila." />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Pipeline de storage" description="Separacao entre banco transacional e arquivos.">
          <div className="space-y-2">
            {pipeline.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#102640] px-3 py-3 text-sm text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className={activeTab === "pricing" ? undefined : "hidden"}
        title="Precificacao e desbloqueios"
        description="Controle por dinheiro, pontos, pacote ou concessao administrativa."
      >
        <div className="grid gap-3 md:grid-cols-4">
          {["Preco individual", "Custo em pontos", "Pacotes", "Comissoes"].map((label) => (
            <div key={label} className="rounded-xl border border-white/10 bg-[#102640] p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-2 text-sm text-slate-200">Padrao por galeria</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
