"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import {
  PAGE_ROUTE_POLICY_RULES,
  canAccessPolicyAny,
  getRoutePolicy,
} from "@/lib/authorization";
import { UserRole } from "@/types";

function canAccessAdmin(roles: readonly UserRole[], pathname: string): boolean {
  const policy = getRoutePolicy(pathname, PAGE_ROUTE_POLICY_RULES);
  return policy ? canAccessPolicyAny(roles, policy) : false;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, userRoles } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;
    if (!canAccessAdmin(userRoles, pathname)) {
      router.replace("/dashboard");
    }
  }, [hydrated, pathname, router, userRoles]);

  if (!hydrated || !canAccessAdmin(userRoles, pathname)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-300">Validando permissÃ£o...</p>
      </div>
    );
  }

  return <>{children}</>;
}
