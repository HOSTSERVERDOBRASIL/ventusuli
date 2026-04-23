import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardSection({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-300">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
