import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "positive" | "warning" | "danger" | "neutral" | "info";

const TONE_CLASS: Record<StatusTone, string> = {
  positive: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100",
  warning: "border-amber-300/40 bg-amber-400/20 text-amber-100",
  danger: "border-red-300/40 bg-red-500/20 text-red-100",
  neutral: "border-slate-300/30 bg-slate-500/20 text-slate-100",
  info: "border-sky-300/40 bg-sky-500/20 text-sky-100",
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  return <Badge className={cn(TONE_CLASS[tone], className)}>{label}</Badge>;
}

