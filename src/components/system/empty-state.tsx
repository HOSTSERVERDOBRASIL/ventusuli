import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description = "Nao ha dados para exibir no momento.",
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-[#0f2239] p-6 text-center sm:p-8", className)}>
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#142b45] text-slate-200 shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-300">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
