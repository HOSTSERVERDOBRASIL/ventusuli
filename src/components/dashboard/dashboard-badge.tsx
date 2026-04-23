import { cn } from "@/lib/utils";

type BadgeVariant = "confirmed" | "pending" | "interest" | "cancelled" | "neutral";

const badgeStyle: Record<BadgeVariant, string> = {
  confirmed: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100",
  pending: "border-amber-300/40 bg-amber-400/20 text-amber-100",
  interest: "border-blue-300/40 bg-blue-500/20 text-blue-100",
  cancelled: "border-red-300/40 bg-red-500/20 text-red-100",
  neutral: "border-slate-300/30 bg-slate-500/20 text-slate-100",
};

export function DashboardBadge({
  label,
  variant,
  className,
}: {
  label: string;
  variant: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide transition-all duration-200 hover:-translate-y-0.5",
        badgeStyle[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}
