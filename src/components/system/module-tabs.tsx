import type { LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/system/status-badge";
import { cn } from "@/lib/utils";

type ModuleTabTone = "positive" | "warning" | "danger" | "neutral" | "info";

export interface ModuleTabItem<T extends string> {
  key: T;
  label: string;
  audience: string;
  description: string;
  icon: LucideIcon;
  metricLabel: string;
  metricValue: string | number;
  metricTone?: ModuleTabTone;
}

interface ModuleTabsProps<T extends string> {
  tabs: ModuleTabItem<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  columnsClassName?: string;
}

export function ModuleTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  columnsClassName = "sm:grid-cols-2 xl:grid-cols-7",
}: ModuleTabsProps<T>) {
  return (
    <div className={cn("grid gap-2", columnsClassName)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex min-h-[132px] min-w-0 flex-col justify-between rounded-xl border p-3 text-left transition",
              isActive
                ? "border-[#F5A623]/60 bg-[#F5A623]/10 shadow-[0_12px_32px_rgba(245,166,35,0.12)]"
                : "border-white/[0.07] bg-white/[0.03] hover:border-[#1E90FF]/50 hover:bg-white/[0.05]",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0c223a]">
                  <Icon className="h-4 w-4 text-sky-200" />
                </div>
                <StatusBadge
                  tone={tab.metricTone ?? "neutral"}
                  label={String(tab.metricValue)}
                  className="max-w-[104px]"
                />
              </div>
              <p className="mt-3 text-sm font-semibold leading-tight text-white">{tab.label}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-white/40">
                {tab.audience}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/55">{tab.description}</p>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/35">
              {tab.metricLabel}
            </p>
          </button>
        );
      })}
    </div>
  );
}
