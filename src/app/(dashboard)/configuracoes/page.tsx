"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

export default function ConfiguracoesDispatcherPage() {
  const router = useRouter();
  const { hydrated, userRole } = useAuthToken();

  useEffect(() => {
    if (!hydrated) return;

    if (!userRole) {
      router.replace("/login");
      return;
    }

    if (userRole === UserRole.ADMIN) {
      router.replace("/admin/configuracoes");
      return;
    }

    if (userRole === UserRole.ATHLETE || userRole === UserRole.COACH) {
      router.replace("/configuracoes/conta");
      return;
    }

    router.replace("/super-admin");
  }, [hydrated, router, userRole]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 text-slate-100">
      <p className="text-sm text-slate-400">Carregando configuracoes...</p>
    </main>
  );
}
