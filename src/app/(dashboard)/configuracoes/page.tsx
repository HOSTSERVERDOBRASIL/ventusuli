"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

export default function ConfiguracoesDispatcherPage() {
  const router = useRouter();
  const { hydrated, userRole, userRoles } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;

    if (!userRole) {
      router.replace("/login");
      return;
    }

    if (userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.MANAGER)) {
      router.replace("/admin/configuracoes");
      return;
    }

    if (
      userRoles.some((role) =>
        [
          UserRole.ATHLETE,
          UserRole.PREMIUM_ATHLETE,
          UserRole.COACH,
          UserRole.ORGANIZER,
          UserRole.SUPPORT,
          UserRole.MODERATOR,
          UserRole.PARTNER,
          UserRole.FINANCE,
        ].includes(role),
      )
    ) {
      router.replace("/configuracoes/conta");
      return;
    }

    router.replace("/super-admin");
  }, [hydrated, router, userRole, userRoles]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 text-slate-100">
      <p className="text-sm text-slate-400">Carregando configuracoes...</p>
    </main>
  );
}
