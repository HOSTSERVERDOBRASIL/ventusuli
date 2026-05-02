"use client";

import { RoleGate } from "@/components/auth/RoleGate";
import { UserRole } from "@/types";

export default function ProvasLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={[UserRole.ATHLETE, UserRole.PREMIUM_ATHLETE]} redirectTo="/">
      {children}
    </RoleGate>
  );
}
