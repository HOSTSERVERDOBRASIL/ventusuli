import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "highlight";
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, tone = "default", className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all",
        tone === "highlight"
          ? "border-amber-300/30 bg-[linear-gradient(160deg,#3b2b12,#1a2638)]"
          : "border-white/10 bg-[linear-gradient(180deg,#122741,#0f2136)]",
        className,
      )}
    >
      <p className="text-xs uppercase tracking-[0.11em] text-slate-300">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-sky-300" /> : null}
        <p className="text-2xl font-bold leading-none text-white">{value}</p>
      </div>
    </div>
  );
}

