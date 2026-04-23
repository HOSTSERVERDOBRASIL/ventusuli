import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionIntent = "primary" | "secondary" | "danger";

const INTENT_CLASS: Record<ActionIntent, string> = {
  primary: "bg-[#F5A623] text-[#0A1628] hover:bg-[#e59a1f]",
  secondary: "border border-white/20 bg-[#0F2743] text-slate-100 hover:bg-[#14375C]",
  danger: "bg-red-500/90 text-white hover:bg-red-500",
};

interface ActionButtonProps extends Omit<ButtonProps, "variant"> {
  intent?: ActionIntent;
}

export function ActionButton({ intent = "primary", className, ...props }: ActionButtonProps) {
  return <Button className={cn(INTENT_CLASS[intent], className)} {...props} />;
}

