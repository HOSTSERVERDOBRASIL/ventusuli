import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricStripTone = "default" | "highlight" | "warning" | "danger" | "positive";

export interface MetricStripItem {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: MetricStripTone;
}

interface MetricStripProps {
  items: MetricStripItem[];
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  columnsClassName?: string;
}

const VALUE_TONE_CLASS: Record<MetricStripTone, string> = {
  default: "text-white",
  highlight: "text-amber-200",
  warning: "text-orange-200",
  danger: "text-red-200",
  positive: "text-emerald-200",
};

const DOT_TONE_CLASS: Record<MetricStripTone, string> = {
  default: "bg-sky-300/70",
  highlight: "bg-amber-300",
  warning: "bg-orange-300",
  danger: "bg-red-300",
  positive: "bg-emerald-300",
};

export function MetricStrip({
  items,
  title,
  description,
  action,
  className,
  columnsClassName = "sm:grid-cols-2 xl:grid-cols-6",
}: MetricStripProps) {
  const hasHeader = Boolean(title || description || action);

  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#10233a]/80 text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-white">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-slate-300">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}

      <dl className={cn("grid", columnsClassName)}>
        {items.map((item) => {
          const tone = item.tone ?? "default";
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="min-w-0 border-t border-white/10 px-4 py-3 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"
            >
              <dt className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE_CLASS[tone])} />
                <span className="truncate">{item.label}</span>
              </dt>
              <dd className="mt-1.5 flex min-w-0 items-center gap-2">
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-sky-300" /> : null}
                <span
                  className={cn(
                    "min-w-0 break-words text-xl font-bold leading-tight",
                    VALUE_TONE_CLASS[tone],
                  )}
                >
                  {item.value}
                </span>
              </dd>
              {item.description ? (
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
              ) : null}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
