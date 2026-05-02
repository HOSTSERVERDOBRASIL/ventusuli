import type { LucideIcon } from "lucide-react";
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

const METRIC_TONE_CLASS: Record<ModuleTabTone, string> = {
  positive: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  danger: "border-red-300/30 bg-red-300/10 text-red-200",
  neutral: "border-white/10 bg-white/[0.04] text-slate-300",
  info: "border-sky-300/25 bg-sky-300/10 text-sky-200",
};

export function ModuleTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  columnsClassName = "sm:grid-cols-2 xl:grid-cols-7",
}: ModuleTabsProps<T>) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#10233a]/80 p-1 text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
      <div className={cn("grid gap-1", columnsClassName)}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              aria-label={`${tab.label}: ${tab.description}`}
              aria-pressed={isActive}
              onClick={() => onChange(tab.key)}
              className={cn(
                "min-w-0 rounded-md px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#F5A623]/35",
                isActive
                  ? "bg-[#F5A623] text-[#0A1628] shadow-[0_8px_18px_rgba(245,166,35,0.18)]"
                  : "text-slate-300 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon
                    className={cn("h-4 w-4 shrink-0", isActive ? "text-[#0A1628]" : "text-sky-200")}
                  />
                  <span className="truncate text-sm font-semibold">{tab.label}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                    isActive
                      ? "border-[#0A1628]/15 bg-[#0A1628]/10 text-[#0A1628]"
                      : METRIC_TONE_CLASS[tab.metricTone ?? "neutral"],
                  )}
                >
                  {tab.metricValue}
                </span>
              </div>
              <div
                className={cn(
                  "mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] uppercase tracking-[0.08em]",
                  isActive ? "text-[#0A1628]/65" : "text-white/35",
                )}
              >
                <span className="truncate">{tab.audience}</span>
                <span className="truncate text-right">{tab.metricLabel}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
