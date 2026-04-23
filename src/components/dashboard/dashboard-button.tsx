import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const styleByVariant = {
  primary: "bg-[#1d4ed8] text-white hover:bg-[#1e40af]",
  success: "bg-emerald-500 text-white hover:bg-emerald-400",
  warning: "bg-[#F5A623] text-[#0A1628] hover:bg-[#e59a1f]",
  neutral: "bg-slate-700 text-slate-100 hover:bg-slate-600",
};

export function DashboardButton({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof styleByVariant;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60",
        styleByVariant[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
