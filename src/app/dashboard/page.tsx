"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

/**
 * /dashboard is a lightweight dispatcher.
 * It resolves the correct landing page based on role and profile state,
 * then performs a client-side redirect.
 *
 * Routes:
 *   SUPER_ADMIN                   →  /super-admin
 *   ADMIN                        →  /admin
 *   COACH                        →  /coach
 *   ATHLETE with CPF             →  /  (main athlete dashboard)
 *   ATHLETE without CPF          →  /onboarding/atleta
 *   Unauthenticated              →  /login
 */
export default function DashboardDispatcher() {
  const router = useRouter();
  const { hydrated, userRole, hasCpf } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;

    if (!userRole) {
      router.replace("/login");
      return;
    }

    if (userRole === UserRole.SUPER_ADMIN) {
      router.replace("/super-admin");
      return;
    }

    if (userRole === UserRole.ADMIN) {
      router.replace("/admin");
      return;
    }

    if (userRole === UserRole.COACH) {
      router.replace("/coach");
      return;
    }

    // ATHLETE
    if (hasCpf === false) {
      router.replace("/onboarding/atleta");
      return;
    }

    router.replace("/");
  }, [hydrated, hasCpf, router, userRole]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 text-slate-100">
      <p className="text-sm text-slate-400">Carregando...</p>
    </main>
  );
}
