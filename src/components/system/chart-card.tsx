import type { ReactNode } from "react";
import { SectionCard } from "@/components/system/section-card";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  legend?: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, action, children, legend, className }: ChartCardProps) {
  return (
    <SectionCard title={title} description={subtitle} action={action} className={className}>
      <div className="space-y-3">
        <div className="min-h-[220px] rounded-xl border border-white/10 bg-[#0f2239] p-2">{children}</div>
        {legend ? <div className="rounded-xl border border-white/10 bg-[#0f2239] p-3">{legend}</div> : null}
      </div>
    </SectionCard>
  );
}
