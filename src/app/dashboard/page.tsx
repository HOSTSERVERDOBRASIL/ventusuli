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
 *   SUPER_ADMIN                   â†’  /super-admin
 *   ADMIN                        â†’  /admin
 *   MANAGER                      â†’  /gestor
 *   FINANCE                      â†’  /admin/financeiro
 *   ORGANIZER                    â†’  /organizador
 *   COACH                        â†’  /coach
 *   SUPPORT                      â†’  /suporte
 *   MODERATOR                    â†’  /moderador
 *   PARTNER                      â†’  /parceiro
 *   PREMIUM_ATHLETE              â†’  /premium
 *   ATHLETE with CPF             â†’  /  (main athlete dashboard)
 *   ATHLETE without CPF          â†’  /onboarding/atleta
 *   Unauthenticated              â†’  /login
 */
export default function DashboardDispatcher() {
  const router = useRouter();
  const { hydrated, userRole, userRoles, hasCpf } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;

    if (!userRole) {
      router.replace("/login");
      return;
    }

    if (userRoles.includes(UserRole.SUPER_ADMIN)) {
      router.replace("/super-admin");
      return;
    }

    if (userRoles.includes(UserRole.ADMIN)) {
      router.replace("/admin");
      return;
    }

    if (userRoles.includes(UserRole.MANAGER)) {
      router.replace("/gestor");
      return;
    }

    if (userRoles.includes(UserRole.FINANCE)) {
      router.replace("/admin/financeiro");
      return;
    }

    if (userRoles.includes(UserRole.ORGANIZER)) {
      router.replace("/organizador");
      return;
    }

    if (userRoles.includes(UserRole.COACH)) {
      router.replace("/coach");
      return;
    }

    if (userRoles.includes(UserRole.SUPPORT)) {
      router.replace("/suporte");
      return;
    }

    if (userRoles.includes(UserRole.MODERATOR)) {
      router.replace("/moderador");
      return;
    }

    if (userRoles.includes(UserRole.PARTNER)) {
      router.replace("/parceiro");
      return;
    }

    if (userRoles.includes(UserRole.PREMIUM_ATHLETE)) {
      router.replace("/premium");
      return;
    }

    // ATHLETE
    if (hasCpf === false) {
      router.replace("/onboarding/atleta");
      return;
    }

    router.replace("/");
  }, [hydrated, hasCpf, router, userRole, userRoles]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 text-slate-100">
      <p className="text-sm text-slate-400">Carregando...</p>
    </main>
  );
}
