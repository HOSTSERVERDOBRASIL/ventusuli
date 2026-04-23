"use client";

import { RoleGate } from "@/components/auth/RoleGate";
import { UserRole } from "@/types";

export default function MinhasInscricoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={[UserRole.ATHLETE]} redirectTo="/">
      {children}
    </RoleGate>
  );
}
