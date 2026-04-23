"use client";

import { RoleGate } from "@/components/auth/RoleGate";
import { UserRole } from "@/types";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={[UserRole.COACH]} redirectTo="/dashboard">
      {children}
    </RoleGate>
  );
}
