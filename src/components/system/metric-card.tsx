import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricTone = "default" | "highlight" | "warning" | "danger";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: MetricTone;
  description?: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<MetricTone, string> = {
  default: "border-white/10 bg-[linear-gradient(180deg,#122741,#0f2136)]",
  highlight: "border-amber-300/30 bg-[linear-gradient(160deg,#3b2b12,#1a2638)]",
  warning: "border-orange-300/30 bg-[linear-gradient(160deg,#3a2410,#172437)]",
  danger: "border-red-300/30 bg-[linear-gradient(160deg,#3a1418,#172437)]",
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  description,
  className,
}: MetricCardProps) {
  return (
    <div className={cn("rounded-2xl border p-4 transition-all", TONE_CLASS[tone], className)}>
      <p className="text-xs uppercase tracking-[0.11em] text-slate-300">{label}</p>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-sky-300" /> : null}
        <p className="min-w-0 break-words text-2xl font-bold leading-tight text-white">{value}</p>
      </div>
      {description ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}
