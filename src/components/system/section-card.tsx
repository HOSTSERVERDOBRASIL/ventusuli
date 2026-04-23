import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "min-w-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,#152a45,#0f2138)] text-white shadow-[0_16px_45px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      {title || description || action ? (
        <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 sm:flex-row">
          <div className="space-y-1">
            {title ? <CardTitle className="text-lg font-semibold tracking-tight text-slate-100">{title}</CardTitle> : null}
            {description ? <p className="text-sm text-slate-300">{description}</p> : null}
          </div>
          {action ? <div className="w-full sm:w-auto">{action}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("min-w-0 pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
