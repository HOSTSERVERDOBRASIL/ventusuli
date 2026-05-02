"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import {
  PROFILE_CONFIG,
  getProfileConfig,
  sortRolesForProfiles,
} from "@/lib/profile-config";
import {
  PAGE_ROUTE_POLICY_RULES,
  canAccessPolicy,
  getRoutePolicy,
} from "@/lib/authorization";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";

function isInternalPath(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function resolveProfileTarget(role: UserRole, nextPath: string | null): string {
  if (isInternalPath(nextPath)) {
    const policy = getRoutePolicy(nextPath, PAGE_ROUTE_POLICY_RULES);
    if (!policy || canAccessPolicy(role, policy)) return nextPath;
  }

  return PROFILE_CONFIG[role].href;
}

export function ProfileSelectionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrated, userRoles, activeRole, setActiveRole } = useAuthToken();
  const roles = useMemo(() => sortRolesForProfiles(userRoles), [userRoles]);
  const nextPath = searchParams.get("next");

  useEffect(() => {
    if (!hydrated) return;
    if (roles.length === 0) {
      router.replace("/login");
      return;
    }
    if (roles.length === 1) {
      const role = roles[0];
      setActiveRole(role);
      router.replace(resolveProfileTarget(role, nextPath));
    }
  }, [hydrated, nextPath, roles, router, setActiveRole]);

  const handleSelect = (role: UserRole) => {
    setActiveRole(role);
    router.push(resolveProfileTarget(role, nextPath));
  };

  return (
    <AuthShell
      fitViewport
      title="Escolha seu perfil"
      description="Use o mesmo login para entrar no contexto certo de trabalho, prova ou atendimento."
    >
      {!hydrated ? (
        <div className="flex min-h-48 items-center justify-center text-slate-200">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Preparando perfis...
        </div>
      ) : (
        <div className="space-y-2.5">
          {roles.map((role) => {
            const config = getProfileConfig(role);
            if (!config) return null;
            const Icon = config.icon;
            const selected = activeRole === role;

            return (
              <button
                key={role}
                type="button"
                onClick={() => handleSelect(role)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                  selected
                    ? "border-[#ffc229]/45 bg-[#ffc229]/10"
                    : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]",
                )}
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg border", config.accent)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{config.label}</span>
                    {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#ffc229]" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-300">
                    {config.description}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-[#ffc229]" />
              </button>
            );
          })}
        </div>
      )}
    </AuthShell>
  );
}
