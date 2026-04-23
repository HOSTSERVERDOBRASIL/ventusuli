"use client";

import { AppShell } from "@/components/layout/AppShell";

interface DashboardShellProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  return <AppShell user={user}>{children}</AppShell>;
}

