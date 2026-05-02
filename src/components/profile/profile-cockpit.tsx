import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BadgeCheck, BarChart3, CheckCircle2, Sparkles, Target } from "lucide-react";
import { PROFILE_CONFIG } from "@/lib/profile-config";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

export type ProfileCockpitTone = "blue" | "amber" | "cyan" | "green" | "rose";

export interface ProfileCockpitMetric {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: ProfileCockpitTone;
}

export interface ProfileCockpitAction {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface ProfileCockpitItem {
  title: string;
  description: ReactNode;
  status?: string;
  href?: string;
}

interface ProfileCockpitProps {
  role: UserRole;
  title: string;
  subtitle: string;
  eyebrow?: string;
  heroImage?: string;
  metrics: ProfileCockpitMetric[];
  actions?: ProfileCockpitAction[];
  focusItems: ProfileCockpitItem[];
  activityItems?: ProfileCockpitItem[];
  insightItems?: ProfileCockpitItem[];
  children?: ReactNode;
}

const CARD_CLASS =
  "overflow-hidden rounded-lg border border-[#1b3350] bg-[#07192b]/95 text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]";

const TONE_CLASS: Record<ProfileCockpitTone, string> = {
  blue: "bg-sky-500/15 text-sky-300",
  amber: "bg-amber-400/15 text-amber-300",
  cyan: "bg-cyan-400/15 text-cyan-300",
  green: "bg-emerald-400/15 text-emerald-300",
  rose: "bg-rose-400/15 text-rose-300",
};

const STATUS_TONE_CLASS: Record<ProfileCockpitTone, string> = {
  blue: "border-sky-300/35 bg-sky-400/10 text-sky-100",
  amber: "border-amber-300/35 bg-amber-400/10 text-amber-100",
  cyan: "border-cyan-300/35 bg-cyan-400/10 text-cyan-100",
  green: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100",
  rose: "border-rose-300/35 bg-rose-400/10 text-rose-100",
};

const DEFAULT_METRIC_ICONS = [BadgeCheck, BarChart3, Target, CheckCircle2];
const DEFAULT_TONES: ProfileCockpitTone[] = ["blue", "amber", "cyan", "green"];
const DEFAULT_HERO_IMAGE = "/auth/floripa-bridge-hero.webp";

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(CARD_CLASS, className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricTile({ metric, index }: { metric: ProfileCockpitMetric; index: number }) {
  const Icon = metric.icon ?? DEFAULT_METRIC_ICONS[index % DEFAULT_METRIC_ICONS.length];
  const tone = metric.tone ?? DEFAULT_TONES[index % DEFAULT_TONES.length];

  return (
    <div className="group min-w-0 rounded-lg border border-[#1b3350] bg-[#07192b]/95 p-3 transition hover:border-sky-400/35 hover:bg-[#0a2037]">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
            TONE_CLASS[tone],
          )}
        >
          <Icon className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-300">{metric.label}</p>
          <p className="mt-1 truncate text-2xl font-bold leading-none text-white">{metric.value}</p>
          {metric.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-400">
              {metric.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: ProfileCockpitTone }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold",
        STATUS_TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

function FocusList({
  items,
  tone = "blue",
}: {
  items: ProfileCockpitItem[];
  tone?: ProfileCockpitTone;
}) {
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-slate-400">Nenhum item configurado.</p>;
  }

  return (
    <div className="divide-y divide-white/10 px-4">
      {items.map((item) => {
        const content = (
          <div className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{item.description}</p>
            </div>
            {item.status ? <StatusPill label={item.status} tone={tone} /> : null}
          </div>
        );

        return item.href ? (
          <Link
            key={item.title}
            href={item.href}
            className="-mx-2 block rounded-md px-2 transition hover:bg-white/[0.03]"
          >
            {content}
          </Link>
        ) : (
          <div key={item.title}>{content}</div>
        );
      })}
    </div>
  );
}

function ActionList({ actions }: { actions: ProfileCockpitAction[] }) {
  if (actions.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-400">
        Os atalhos aparecem conforme o perfil ganha módulos operacionais.
      </p>
    );
  }

  return (
    <div className="divide-y divide-white/10 px-4">
      {actions.slice(0, 5).map(({ href, label, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition hover:bg-white/[0.03]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-300/10 bg-sky-500/15 text-sky-300">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{label}</span>
              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-300">
                {description}
              </span>
            </span>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
        </Link>
      ))}
    </div>
  );
}

function ActivityRhythm({ items }: { items: ProfileCockpitItem[] }) {
  const safeItems = items.length ? items.slice(0, 4) : [];

  return (
    <div className="space-y-4 p-4">
      <div className="grid h-[140px] grid-cols-4 items-end gap-3 rounded-md border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-4 pb-4 pt-6">
        {[54, 78, 64, 92].map((height, index) => (
          <div key={height} className="flex h-full min-w-0 flex-col justify-end gap-2">
            <div
              className={cn(
                "rounded-t-md border border-sky-300/25 bg-sky-400/30 shadow-[0_0_20px_rgba(56,189,248,0.12)]",
                index === 3 ? "bg-amber-300/35" : "",
              )}
              style={{ height: `${height}%` }}
            />
            <span className="truncate text-center text-[10px] font-semibold text-slate-400">
              {["Agora", "Hoje", "Semana", "Meta"][index]}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {safeItems.map((item, index) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{item.description}</p>
            </div>
            <span className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-100">
              {index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileCockpit({
  role,
  title,
  subtitle,
  eyebrow,
  heroImage = DEFAULT_HERO_IMAGE,
  metrics,
  actions = [],
  focusItems,
  activityItems,
  insightItems,
  children,
}: ProfileCockpitProps) {
  const config = PROFILE_CONFIG[role];
  const RoleIcon = config.icon;
  const metricItems: ProfileCockpitMetric[] = [
    ...metrics.slice(0, 3),
    {
      label: "Perfil ativo",
      value: config.shortLabel,
      description: config.description,
      icon: RoleIcon,
      tone: "green",
    },
  ];
  const rhythmItems = activityItems ?? focusItems;
  const insights = insightItems ?? [
    {
      title: config.label,
      description: config.description,
      status: "Perfil",
    },
    ...actions.slice(0, 2).map((action) => ({
      title: action.label,
      description: action.description,
      href: action.href,
      status: "Atalho",
    })),
  ];

  return (
    <div className="min-h-screen bg-[#04111f] p-3 text-white sm:p-4 lg:p-5">
      <div className="mx-auto max-w-[1440px] space-y-3">
        <section className={cn(CARD_CLASS, "relative min-h-[236px]")}>
          {heroImage ? (
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,144,255,0.4),transparent_28%),linear-gradient(135deg,#102e57,#07192b_45%,#120f2a)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#04111f]/96 via-[#04111f]/46 to-[#04111f]/18" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(255,194,41,0.18),transparent_24%),radial-gradient(circle_at_18%_78%,rgba(14,165,233,0.22),transparent_28%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#04111f]/95 to-transparent" />

          <div className="relative z-[1] flex min-h-[236px] flex-col justify-between gap-6 p-5 sm:p-6">
            <div className="flex justify-end">
              <div className="flex max-w-full items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-3 py-2 backdrop-blur">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-white",
                    config.accent,
                  )}
                >
                  <RoleIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{config.label}</p>
                  <p className="truncate text-xs text-slate-300">
                    {eyebrow ?? "Cockpit do perfil"}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-w-2xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                {config.shortLabel}
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">{subtitle}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {metricItems.map((metric, index) => (
            <MetricTile key={metric.label} metric={metric} index={index} />
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.08fr_0.92fr]">
          <Panel title="Foco do perfil">
            <FocusList items={focusItems} tone="cyan" />
          </Panel>

          <Panel
            title="Entradas rápidas"
            action={
              actions[0] ? (
                <Link
                  href={actions[0].href}
                  className="text-xs font-semibold text-sky-300 hover:text-sky-200"
                >
                  Abrir principal
                </Link>
              ) : null
            }
          >
            <ActionList actions={actions} />
          </Panel>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr_0.95fr]">
          <Panel title="Ritmo operacional">
            <ActivityRhythm items={rhythmItems} />
          </Panel>

          <Panel title="Leitura do perfil">
            <FocusList items={insights.slice(0, 3)} tone="green" />
          </Panel>

          <Panel
            title="Resumo de responsabilidades"
            action={
              <span className="text-xs font-semibold text-slate-400">{config.shortLabel}</span>
            }
          >
            <div className="grid gap-3 p-4">
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-slate-400">Escopo</p>
                <p className="mt-1 text-xl font-bold">{config.shortLabel}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{config.description}</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-slate-400">Ações disponíveis</p>
                <p className="mt-1 text-xl font-bold">{actions.length}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Atalhos conectados ao perfil sem misturar responsabilidades.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-slate-400">Prioridades</p>
                <p className="mt-1 text-xl font-bold">{focusItems.length}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Blocos ajustados para o contexto de trabalho atual.
                </p>
              </div>
            </div>
          </Panel>
        </section>

        {children}
      </div>
    </div>
  );
}
