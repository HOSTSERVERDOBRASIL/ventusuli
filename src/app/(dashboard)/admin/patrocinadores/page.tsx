"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CreditCard, Gift, Handshake, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SponsorsTab = "overview" | "campaigns" | "metrics";

interface SponsorRow {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  websiteUrl: string | null;
  sponsorType: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  campaignsCount: number;
  placementsCount: number;
}

interface CampaignRow {
  id: string;
  sponsorId: string;
  sponsorName: string;
  title: string;
  description: string | null;
  campaignType: string;
  budgetCents: number;
  pointsBudget: number;
  startsAt: string | null;
  endsAt: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED" | "CANCELLED";
}

const placementAreas = ["Dashboard do atleta", "Página da prova", "Galeria de fotos", "Recompensas", "Resultados"];

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tone(status: string): "positive" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "positive";
  if (status === "DRAFT" || status === "PAUSED") return "warning";
  if (status === "CANCELLED" || status === "ARCHIVED") return "danger";
  return "neutral";
}

export default function AdminPatrocinadoresPage() {
  const { accessToken, hydrated } = useAuthToken();
  const [activeTab, setActiveTab] = useState<SponsorsTab>("overview");
  const [loading, setLoading] = useState(true);
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [savingSponsor, setSavingSponsor] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [sponsorForm, setSponsorForm] = useState({ name: "", logoUrl: "", websiteUrl: "", description: "", sponsorType: "BRAND", status: "ACTIVE" });
  const [campaignForm, setCampaignForm] = useState({ sponsorId: "", title: "", campaignType: "EXPOSICAO", budgetCents: "0", pointsBudget: "0", status: "DRAFT" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
      const [sponsorResponse, campaignResponse] = await Promise.all([
        fetch("/api/admin/sponsors?limit=100", { headers, cache: "no-store" }),
        fetch("/api/admin/sponsor-campaigns", { headers, cache: "no-store" }),
      ]);
      const sponsorPayload = (await sponsorResponse.json()) as { data?: SponsorRow[] };
      const campaignPayload = (await campaignResponse.json()) as { data?: CampaignRow[] };
      setSponsors(sponsorResponse.ok ? sponsorPayload.data ?? [] : []);
      setCampaigns(campaignResponse.ok ? campaignPayload.data ?? [] : []);
    } catch {
      toast.error("Não foi possível carregar patrocinadores.");
      setSponsors([]);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  const metrics = useMemo(() => {
    const activeSponsors = sponsors.filter((item) => item.status === "ACTIVE").length;
    const activeCampaigns = campaigns.filter((item) => item.status === "ACTIVE").length;
    const revenue = campaigns.reduce((sum, item) => sum + item.budgetCents, 0);
    const points = campaigns.reduce((sum, item) => sum + item.pointsBudget, 0);
    return { activeSponsors, activeCampaigns, revenue, points };
  }, [campaigns, sponsors]);

  const tabs = useMemo<ModuleTabItem<SponsorsTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Comercial",
        description: "Patrocinadores, campanhas, receita e produtos.",
        icon: Handshake,
        metricLabel: "Ativos",
        metricValue: metrics.activeSponsors,
        metricTone: metrics.activeSponsors ? "positive" : "neutral",
      },
      {
        key: "campaigns",
        label: "Campanhas",
        audience: "Operação",
        description: "Contratos, placements, budget e ativações.",
        icon: Target,
        metricLabel: "Ativas",
        metricValue: metrics.activeCampaigns,
        metricTone: metrics.activeCampaigns ? "positive" : "neutral",
      },
      {
        key: "metrics",
        label: "Métricas",
        audience: "Diretoria",
        description: "Impressões, cliques, conversões e cupons.",
        icon: BarChart3,
        metricLabel: "Budget",
        metricValue: money(metrics.revenue),
        metricTone: metrics.revenue ? "positive" : "neutral",
      },
    ],
    [metrics],
  );

  const createSponsor = async () => {
    if (!sponsorForm.name.trim()) return toast.error("Informe o nome do patrocinador.");
    setSavingSponsor(true);
    try {
      const response = await fetch("/api/admin/sponsors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          name: sponsorForm.name,
          logoUrl: sponsorForm.logoUrl || null,
          websiteUrl: sponsorForm.websiteUrl || null,
          description: sponsorForm.description || null,
          sponsorType: sponsorForm.sponsorType,
          status: sponsorForm.status,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao criar patrocinador.");
      setSponsorForm({ name: "", logoUrl: "", websiteUrl: "", description: "", sponsorType: "BRAND", status: "ACTIVE" });
      toast.success("Patrocinador criado.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar patrocinador.");
    } finally {
      setSavingSponsor(false);
    }
  };

  const createCampaign = async () => {
    if (!campaignForm.sponsorId) return toast.error("Selecione um patrocinador.");
    if (!campaignForm.title.trim()) return toast.error("Informe o título da campanha.");
    setSavingCampaign(true);
    try {
      const response = await fetch("/api/admin/sponsor-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          sponsorId: campaignForm.sponsorId,
          title: campaignForm.title,
          campaignType: campaignForm.campaignType,
          budgetCents: Number(campaignForm.budgetCents) || 0,
          pointsBudget: Number(campaignForm.pointsBudget) || 0,
          status: campaignForm.status,
        }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Falha ao criar campanha.");
      setCampaignForm((current) => ({ ...current, title: "", budgetCents: "0", pointsBudget: "0" }));
      toast.success("Campanha criada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar campanha.");
    } finally {
      setSavingCampaign(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patrocinadores"
        subtitle="Gestão de marcas, campanhas, placements, cupons, produtos e métricas comerciais."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/admin/financeiro">Ver financeiro</Link>
          </ActionButton>
        }
      />

      {loading ? (
        <LoadingState lines={5} />
      ) : (
        <>
          <SectionCard title="Módulo de patrocinadores" description="Visão comercial, campanhas e métricas em abas.">
            <ModuleTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} columnsClassName="md:grid-cols-3" />
          </SectionCard>

          <div className={activeTab === "overview" ? "grid gap-3 sm:grid-cols-4" : "hidden"}>
            <MetricCard label="Patrocinadores" value={metrics.activeSponsors} icon={Handshake} tone="highlight" />
            <MetricCard label="Campanhas ativas" value={metrics.activeCampaigns} icon={Target} />
            <MetricCard label="Budget" value={money(metrics.revenue)} icon={CreditCard} />
            <MetricCard label="Pontos patrocinados" value={metrics.points} icon={Gift} />
          </div>

          <div className={activeTab === "overview" ? "grid gap-4 xl:grid-cols-[1fr_0.9fr]" : "hidden"}>
            <SectionCard title="Patrocinadores cadastrados" description="Marcas disponíveis para campanhas e placements.">
              {sponsors.length === 0 ? (
                <EmptyState title="Sem patrocinadores" description="Cadastre a primeira marca parceira." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sponsors.map((sponsor) => (
                    <article key={sponsor.id} className="rounded-xl border border-white/10 bg-[#102640] p-4 text-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{sponsor.name}</p>
                          <p className="text-xs text-slate-400">{sponsor.sponsorType}</p>
                        </div>
                        <StatusBadge label={sponsor.status} tone={tone(sponsor.status)} />
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{sponsor.description ?? "Sem descrição."}</p>
                      <p className="mt-3 text-xs text-slate-400">{sponsor.campaignsCount} campanha(s) · {sponsor.placementsCount} placement(s)</p>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Novo patrocinador" description="Cadastre marcas para ativar campanhas comerciais.">
              <div className="space-y-3">
                <Input placeholder="Nome" value={sponsorForm.name} onChange={(event) => setSponsorForm((current) => ({ ...current, name: event.target.value }))} />
                <Input placeholder="Logo URL" value={sponsorForm.logoUrl} onChange={(event) => setSponsorForm((current) => ({ ...current, logoUrl: event.target.value }))} />
                <Input placeholder="Website" value={sponsorForm.websiteUrl} onChange={(event) => setSponsorForm((current) => ({ ...current, websiteUrl: event.target.value }))} />
                <Textarea placeholder="Descrição" value={sponsorForm.description} onChange={(event) => setSponsorForm((current) => ({ ...current, description: event.target.value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="Tipo" value={sponsorForm.sponsorType} onChange={(event) => setSponsorForm((current) => ({ ...current, sponsorType: event.target.value }))} />
                  <Select value={sponsorForm.status} onChange={(event) => setSponsorForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                    <option value="ARCHIVED">Arquivado</option>
                  </Select>
                </div>
                <ActionButton onClick={() => void createSponsor()} disabled={savingSponsor}>
                  <Plus className="mr-2 h-4 w-4" />
                  {savingSponsor ? "Criando..." : "Criar patrocinador"}
                </ActionButton>
              </div>
            </SectionCard>
          </div>

          <div className={activeTab === "campaigns" ? "grid gap-4 xl:grid-cols-[1.2fr_0.8fr]" : "hidden"}>
            <SectionCard title="Campanhas" description="Contratos, período, budget, pontos patrocinados e status.">
              {campaigns.length === 0 ? (
                <EmptyState title="Sem campanhas" description="Campanhas cadastradas aparecerão aqui." />
              ) : (
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
                    <tbody className="divide-y divide-white/10">
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id}>
                          <td className="px-3 py-3 text-slate-200">{campaign.sponsorName || sponsors.find((item) => item.id === campaign.sponsorId)?.name || "-"}</td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-white">{campaign.title}</p>
                            <p className="text-xs text-slate-400">{campaign.campaignType} · {campaign.pointsBudget} pts</p>
                          </td>
                          <td className="px-3 py-3 text-slate-200">{money(campaign.budgetCents)}</td>
                          <td className="px-3 py-3"><StatusBadge label={campaign.status} tone={tone(campaign.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Nova campanha" description="Ative campanha com orçamento financeiro e pontos.">
              <div className="space-y-3">
                <Select value={campaignForm.sponsorId} onChange={(event) => setCampaignForm((current) => ({ ...current, sponsorId: event.target.value }))}>
                  <option value="">Selecione o patrocinador</option>
                  {sponsors.map((sponsor) => <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>)}
                </Select>
                <Input placeholder="Título da campanha" value={campaignForm.title} onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))} />
                <Input placeholder="Tipo de campanha" value={campaignForm.campaignType} onChange={(event) => setCampaignForm((current) => ({ ...current, campaignType: event.target.value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="number" min={0} placeholder="Budget em centavos" value={campaignForm.budgetCents} onChange={(event) => setCampaignForm((current) => ({ ...current, budgetCents: event.target.value }))} />
                  <Input type="number" min={0} placeholder="Pontos" value={campaignForm.pointsBudget} onChange={(event) => setCampaignForm((current) => ({ ...current, pointsBudget: event.target.value }))} />
                </div>
                <Select value={campaignForm.status} onChange={(event) => setCampaignForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="DRAFT">Rascunho</option>
                  <option value="ACTIVE">Ativa</option>
                  <option value="PAUSED">Pausada</option>
                  <option value="FINISHED">Finalizada</option>
                </Select>
                <ActionButton onClick={() => void createCampaign()} disabled={savingCampaign}>
                  <Plus className="mr-2 h-4 w-4" />
                  {savingCampaign ? "Criando..." : "Criar campanha"}
                </ActionButton>
              </div>
            </SectionCard>
          </div>

          <SectionCard className={activeTab === "metrics" ? undefined : "hidden"} title="Métricas e placements" description="Impressões, cliques, conversões, cupons e receita por patrocinador.">
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["Budget", money(metrics.revenue)],
                ["Pontos", metrics.points],
                ["Campanhas", campaigns.length],
                ["Patrocinadores", sponsors.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-[#102640] p-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <BarChart3 className="h-4 w-4 text-sky-300" />
                    <p className="text-xs uppercase tracking-wide">{label}</p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {placementAreas.map((area) => (
                <div key={area} className="rounded-xl border border-white/10 bg-[#0b1f35] px-3 py-3 text-sm text-slate-200">{area}</div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
