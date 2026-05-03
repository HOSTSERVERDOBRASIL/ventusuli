"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#0F2743] px-3.5 py-2 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition [color-scheme:dark] focus:border-[#F5A623]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A623]/20 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-[#0F2743] [&>option]:text-slate-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = "Select";

export { Select };
