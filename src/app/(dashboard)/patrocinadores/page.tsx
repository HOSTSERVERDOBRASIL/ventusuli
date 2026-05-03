"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ExternalLink, Gift, Handshake, Ticket, Trophy } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";

interface SponsorRow {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  websiteUrl: string | null;
  sponsorType: string;
  activeCampaigns: number;
}

export default function PatrocinadoresPage() {
  const { accessToken, hydrated } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/sponsors", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store",
      });
      const payload = (await response.json()) as { data?: SponsorRow[] };
      setSponsors(response.ok ? payload.data ?? [] : []);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  const activeCampaigns = useMemo(
    () => sponsors.reduce((sum, sponsor) => sum + sponsor.activeCampaigns, 0),
    [sponsors],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patrocinadores"
        subtitle="Campanhas, cupons, produtos patrocinados e benefícios vinculados às provas."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/recompensas">Ver recompensas</Link>
          </ActionButton>
        }
      />

      {loading ? (
        <LoadingState lines={4} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Ativos" value={sponsors.length} icon={Handshake} tone="highlight" />
            <MetricCard label="Campanhas" value={activeCampaigns} icon={BarChart3} />
            <MetricCard label="Cupons" value="Em breve" icon={Ticket} />
            <MetricCard label="Produtos" value="Em breve" icon={Gift} />
          </div>

          <SectionCard title="Patrocinadores ativos" description="Marcas vinculadas a benefícios, provas e campanhas.">
            {sponsors.length === 0 ? (
              <EmptyState
                title="Sem patrocinadores publicados"
                description="Patrocinadores ativos e benefícios disponíveis aparecerão aqui."
                action={
                  <ActionButton asChild intent="secondary">
                    <Link href="/provas">Ver provas</Link>
                  </ActionButton>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sponsors.map((sponsor) => (
                  <article key={sponsor.id} className="rounded-xl border border-white/10 bg-[#102640] p-4 text-white">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-amber-400/10 text-amber-200">
                        {sponsor.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sponsor.logoUrl} alt={sponsor.name} className="h-full w-full object-cover" />
                        ) : (
                          <Trophy className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold">{sponsor.name}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{sponsor.sponsorType}</p>
                      </div>
                    </div>
                    <p className="min-h-[48px] text-sm leading-6 text-slate-300">
                      {sponsor.description ?? "Marca parceira da assessoria."}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#0b1f35] px-3 py-2 text-xs text-slate-300">
                      <span>{sponsor.activeCampaigns} campanha{sponsor.activeCampaigns === 1 ? "" : "s"} ativa{sponsor.activeCampaigns === 1 ? "" : "s"}</span>
                      {sponsor.websiteUrl ? (
                        <a href={sponsor.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-200 hover:text-sky-100">
                          Site
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
