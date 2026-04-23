import { cn } from "@/lib/utils";

interface LoadingStateProps {
  lines?: number;
  className?: string;
  dense?: boolean;
}

export function LoadingState({ lines = 3, className, dense = false }: LoadingStateProps) {
  return (
    <div className={cn("space-y-3 rounded-2xl border border-white/10 bg-[#0f2239] p-4", className)}>
      <div className="surface-shimmer h-3 w-40 rounded-md" />
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className={cn("surface-shimmer rounded-xl", dense ? "h-7" : "h-10")} />
      ))}
    </div>
  );
}
