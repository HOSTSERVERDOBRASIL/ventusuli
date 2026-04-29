import Link from "next/link";
import { Camera, Download, Gift, LockKeyhole, ShoppingBag } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

const photoFlows = [
  {
    title: "Fotos por prova",
    description: "Galerias agrupadas por evento, modalidade e data.",
    status: "Aguardando galerias",
  },
  {
    title: "Comprar fotos",
    description: "Checkout para fotos individuais ou pacotes.",
    status: "Sem itens no carrinho",
  },
  {
    title: "Desbloquear com pontos",
    description: "Uso do saldo disponivel para liberar downloads elegiveis.",
    status: "Saldo aplicado no resgate",
  },
];

export default function FotosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fotos"
        subtitle="Galerias de provas, compras, desbloqueios por pontos e downloads liberados."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/recompensas">Ver pontos</Link>
          </ActionButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Minhas fotos" value="0" icon={Camera} tone="highlight" />
        <MetricCard label="Liberadas" value="0" icon={LockKeyhole} />
        <MetricCard label="Compras" value="0" icon={ShoppingBag} />
        <MetricCard label="Downloads" value="0" icon={Download} />
      </div>

      <SectionCard title="Minhas fotos" description="Fotos vinculadas ao atleta por prova ou numero de peito.">
        <EmptyState
          title="Nenhuma foto liberada"
          description="Quando uma galeria for publicada e houver fotos vinculadas ao seu perfil, elas aparecerao aqui."
          action={
            <ActionButton asChild intent="secondary">
              <Link href="/provas">Ver provas</Link>
            </ActionButton>
          }
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        {photoFlows.map((flow) => (
          <article key={flow.title} className="rounded-2xl border border-white/10 bg-[#102640] p-4 text-white">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200">
              <Gift className="h-5 w-5" />
            </div>
            <p className="text-lg font-semibold">{flow.title}</p>
            <p className="mt-2 min-h-[44px] text-sm leading-6 text-slate-300">{flow.description}</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0b1f35] px-3 py-2 text-xs text-slate-300">
              {flow.status}
            </div>
          </article>
        ))}
      </div>

      <SectionCard title="Historico de fotos" description="Compras, desbloqueios e downloads ficam registrados aqui.">
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Prova</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-3 py-8">
                  <EmptyState title="Sem historico" description="Suas compras e desbloqueios de fotos aparecerao aqui." />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
