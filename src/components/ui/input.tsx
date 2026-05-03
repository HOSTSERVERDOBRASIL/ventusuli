import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#0F2743] px-3.5 py-2 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition [color-scheme:dark] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-100 placeholder:text-slate-400 focus:border-[#F5A623]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5A623]/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
