"use client";

import { ArrowUpRight, Download, ListChecks } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { MetricCard } from "@/components/system/metric-card";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { cn } from "@/lib/utils";

export type ManagementReportTone = "positive" | "warning" | "danger" | "neutral";

export interface ManagementReportMetric {
  label: string;
  value: string | number;
  tone?: "default" | "highlight" | "warning" | "danger";
  description?: string;
}

export interface ManagementReportExecutiveSummary {
  statusLabel: string;
  title: string;
  value: string;
  description: string;
  detail: string;
  tone: ManagementReportTone;
}

export interface ManagementReportInsight {
  title: string;
  value: string;
  description: string;
  href: string;
  tone: ManagementReportTone;
  actionLabel: string;
}

export interface ManagementReportAction {
  title: string;
  description: string;
  href: string;
  tone: ManagementReportTone;
  metric: string;
}

interface ManagementReportsSectionProps {
  periodLabel: string;
  executiveSummary: ManagementReportExecutiveSummary;
  metrics: ManagementReportMetric[];
  insights: ManagementReportInsight[];
  actions: ManagementReportAction[];
  onExport: () => void;
}

const SUMMARY_TONE_CLASS: Record<ManagementReportTone, string> = {
  positive: "border-emerald-300/25 bg-emerald-400/[0.08]",
  warning: "border-amber-300/25 bg-amber-400/[0.08]",
  danger: "border-red-300/25 bg-red-400/[0.08]",
  neutral: "border-white/[0.08] bg-white/[0.03]",
};

export function ManagementReportsSection({
  periodLabel,
  executiveSummary,
  metrics,
  insights,
  actions,
  onExport,
}: ManagementReportsSectionProps) {
  return (
    <SectionCard
      title="Relatorios gerenciais"
      description={`Fechamento executivo, riscos e proximas acoes para ${periodLabel}.`}
      action={
        <ActionButton intent="secondary" onClick={onExport} className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" /> Exportar relatorio
        </ActionButton>
      }
    >
      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <div className={cn("rounded-xl border p-4", SUMMARY_TONE_CLASS[executiveSummary.tone])}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.11em] text-white/45">
                Fechamento executivo
              </p>
              <h3 className="mt-2 text-lg font-semibold leading-tight text-white">
                {executiveSummary.title}
              </h3>
            </div>
            <StatusBadge
              tone={executiveSummary.tone}
              label={executiveSummary.statusLabel}
              className="w-fit shrink-0"
            />
          </div>
          <p className="mt-4 text-3xl font-bold leading-tight text-white">
            {executiveSummary.value}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {executiveSummary.description}
          </p>
          <p className="mt-3 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2 text-xs leading-relaxed text-white/55">
            {executiveSummary.detail}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white">
            <ListChecks className="h-4 w-4 text-amber-200" />
            <p className="text-sm font-semibold">Acoes prioritarias</p>
          </div>
          <div className="mt-3 grid gap-2">
            {actions.map((action) => (
              <a
                key={action.title}
                href={action.href}
                className="group flex min-w-0 items-start justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#0d2239] p-3 transition hover:border-[#F5A623]/50 hover:bg-[#102b48]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={action.tone} label={action.metric} className="max-w-full" />
                    <p className="font-semibold leading-snug text-white">{action.title}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{action.description}</p>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/35 transition group-hover:text-white" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
            description={metric.description}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => (
          <a
            key={insight.title}
            href={insight.href}
            className="group flex min-h-[172px] min-w-0 flex-col justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-[#1E90FF]/50 hover:bg-white/[0.05]"
          >
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold leading-snug text-white">{insight.title}</p>
                <StatusBadge tone={insight.tone} label={insight.actionLabel} className="shrink-0" />
              </div>
              <p className="mt-3 break-words text-2xl font-bold leading-tight text-white">
                {insight.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{insight.description}</p>
            </div>
            <span className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-semibold text-sky-200 transition group-hover:text-white">
              Abrir leitura <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </a>
        ))}
      </div>
    </SectionCard>
  );
}
