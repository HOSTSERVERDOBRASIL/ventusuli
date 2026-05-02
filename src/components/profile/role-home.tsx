import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { ActionButton } from "@/components/system/action-button";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { PROFILE_CONFIG } from "@/lib/profile-config";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";

interface RoleMetric {
  label: string;
  value: string | number;
  description?: string;
}

interface RoleAction {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface RoleFocusItem {
  title: string;
  description: string;
  status?: string;
}

interface RoleHomeProps {
  role: UserRole;
  title: string;
  subtitle: string;
  metrics: RoleMetric[];
  actions?: RoleAction[];
  focusItems: RoleFocusItem[];
}

export function RoleHome({
  role,
  title,
  subtitle,
  metrics,
  actions = [],
  focusItems,
}: RoleHomeProps) {
  const config = PROFILE_CONFIG[role];
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          actions[0] ? (
            <ActionButton asChild>
              <Link href={actions[0].href}>
                {actions[0].label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </ActionButton>
          ) : null
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={index === 0 ? "highlight" : "default"}
            description={metric.description}
          />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Foco do perfil"
          description="O que este perfil precisa controlar sem misturar responsabilidades."
        >
          <div className="space-y-2.5">
            {focusItems.map((item) => (
              <div
                key={item.title}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#0f233d] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.description}</p>
                </div>
                {item.status ? (
                  <StatusBadge label={item.status} tone="info" className="shrink-0 text-[10px]" />
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Entradas rapidas"
          description="Caminhos disponiveis para este contexto."
        >
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0f233d] p-3">
            <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg border", config.accent)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{config.shortLabel}</p>
              <p className="text-xs leading-5 text-slate-300">{config.description}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {actions.length ? (
              actions.map(({ href, label, description, icon: ActionIcon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d2038] px-3 py-3 transition hover:border-[#2e6399]"
                >
                  <ActionIcon className="h-4 w-4 shrink-0 text-[#ffc229]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-300">
                      {description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-white/10 bg-[#0d2038] px-3 py-3 text-sm leading-6 text-slate-300">
                Perfil preparado para controle de acesso. Os modulos dedicados podem ser ligados sem
                mudar a base de seguranca.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
