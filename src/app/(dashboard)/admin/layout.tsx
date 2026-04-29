"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN];
const FINANCE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.FINANCE];

function canAccessAdmin(role: UserRole | null, pathname: string): boolean {
  if (!role) return false;
  if (pathname === "/admin/financeiro" || pathname.startsWith("/admin/financeiro/")) {
    return FINANCE_ROLES.includes(role);
  }
  if (/^\/admin\/eventos\/[^/]+$/.test(pathname)) {
    return FINANCE_ROLES.includes(role);
  }
  return ADMIN_ROLES.includes(role);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, userRole } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;
    if (!canAccessAdmin(userRole, pathname)) {
      // Athletes and unauthenticated users go to the main dashboard.
      router.replace("/");
    }
  }, [hydrated, pathname, router, userRole]);

  if (!hydrated || !canAccessAdmin(userRole, pathname)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-300">Validando permissÃ£o...</p>
      </div>
    );
  }

  return <>{children}</>;
}
