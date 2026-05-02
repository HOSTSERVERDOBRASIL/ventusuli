"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { PROFILE_CONFIG, getProfileConfig, sortRolesForProfiles } from "@/lib/profile-config";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";

interface ProfileSwitcherProps {
  compact?: boolean;
  className?: string;
  redirectOnChange?: boolean;
}

export function ProfileSwitcher({
  compact = false,
  className,
  redirectOnChange = true,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const { userRoles, activeRole, setActiveRole } = useAuthToken();
  const roles = useMemo(() => sortRolesForProfiles(userRoles), [userRoles]);

  if (roles.length <= 1) return null;

  const selectedRole = activeRole && roles.includes(activeRole) ? activeRole : roles[0];
  const selectedConfig = getProfileConfig(selectedRole);
  if (!selectedConfig) return null;

  const Icon = selectedConfig.icon;

  const handleChange = (role: UserRole) => {
    setActiveRole(role);
    if (redirectOnChange) {
      router.push(PROFILE_CONFIG[role].href);
    }
  };

  if (compact) {
    return (
      <label
        className={cn(
          "relative hidden h-9 min-w-[150px] items-center gap-2 rounded-lg border border-[#1b3350] bg-[#07192b]/85 pl-2.5 pr-8 text-[12px] text-white/75 shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition hover:border-sky-400/35 sm:flex",
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5 text-[#ffc229]" />
        <span className="sr-only">Perfil ativo</span>
        <select
          value={selectedRole}
          onChange={(event) => handleChange(event.target.value as UserRole)}
          className="min-w-0 flex-1 appearance-none bg-transparent font-semibold outline-none"
        >
          {roles.map((role) => (
            <option key={role} value={role} className="bg-[#0d1b2a] text-white">
              {PROFILE_CONFIG[role].shortLabel}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-white/35" />
      </label>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-[#1b3350] bg-[#07192b]/85 p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
            selectedConfig.accent,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-white">Perfil ativo</p>
          <p className="truncate text-[10px] text-white/40">{selectedConfig.shortLabel}</p>
        </div>
      </div>
      <label className="relative block">
        <span className="sr-only">Selecionar perfil</span>
        <select
          value={selectedRole}
          onChange={(event) => handleChange(event.target.value as UserRole)}
          className="h-9 w-full appearance-none rounded-md border border-white/[0.08] bg-[#04111f] px-3 pr-8 text-[12px] font-semibold text-white outline-none transition focus:border-[#ffc229]/70"
        >
          {roles.map((role) => (
            <option key={role} value={role} className="bg-[#0d1b2a] text-white">
              {PROFILE_CONFIG[role].label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
      </label>
    </div>
  );
}
