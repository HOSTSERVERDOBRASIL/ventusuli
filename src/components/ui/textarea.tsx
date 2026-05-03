import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-w-0 rounded-xl border border-white/15 bg-[#0F2743] px-3.5 py-2 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition placeholder:text-slate-400 focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
