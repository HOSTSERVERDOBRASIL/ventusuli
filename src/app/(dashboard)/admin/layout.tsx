"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN];

function canAccessAdmin(role: UserRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, userRole } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;
    if (!canAccessAdmin(userRole)) {
      // Athletes and unauthenticated users go to the main dashboard.
      router.replace("/");
    }
  }, [hydrated, router, userRole]);

  if (!hydrated || !canAccessAdmin(userRole)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-300">Validando permissão...</p>
      </div>
    );
  }

  return <>{children}</>;
}
