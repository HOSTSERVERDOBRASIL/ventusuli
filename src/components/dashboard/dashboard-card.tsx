import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  subtitle,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-2xl border border-white/10 bg-[#121f34]/95 text-white shadow-[0_12px_45px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_18px_55px_rgba(0,0,0,0.35)] motion-safe:animate-[fade-up_420ms_ease-out_both]",
        className,
      )}
    >
      {title ? (
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold tracking-tight text-slate-100">{title}</CardTitle>
          {subtitle ? <p className="text-sm text-slate-300">{subtitle}</p> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
