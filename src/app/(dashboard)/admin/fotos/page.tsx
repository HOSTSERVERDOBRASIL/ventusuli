import Link from "next/link";
import { Camera, Download, Image, ShieldCheck, UploadCloud } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

const pipeline = [
  "Original privado",
  "Preview com watermark",
  "Thumbnail cacheado",
  "Download assinado",
];

export default function AdminFotosPage() {
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

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Galerias" value="0" icon={Image} tone="highlight" />
        <MetricCard label="Fotos publicadas" value="0" icon={Camera} />
        <MetricCard label="Downloads liberados" value="0" icon={Download} />
        <MetricCard label="Pendentes" value="0" icon={UploadCloud} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
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

      <SectionCard title="Precificacao e desbloqueios" description="Controle por dinheiro, pontos, pacote ou concessao administrativa.">
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
