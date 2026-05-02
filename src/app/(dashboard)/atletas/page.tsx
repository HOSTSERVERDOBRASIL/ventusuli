"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

/**
 * Legacy alias kept only for backward compatibility.
 * Canonical routes:
 * - ADMIN -> /admin/atletas
 * - COACH -> /coach/atletas
 */
export default function AtletasLegacyRedirectPage() {
  const router = useRouter();
  const { hydrated, userRoles } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;

    if (userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.MANAGER)) {
      router.replace("/admin/atletas");
      return;
    }

    if (userRoles.includes(UserRole.COACH)) {
      router.replace("/coach/atletas");
      return;
    }

    router.replace("/dashboard");
  }, [hydrated, router, userRoles]);

  return (
    <main className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-slate-400">Redirecionando...</p>
    </main>
  );
}
