"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DoorOpen, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProfileConfig } from "@/lib/profile-config";
import { resolveOrganizationLogo } from "@/lib/brand";
import { rolesLabel } from "@/lib/role-labels";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { isNavItemActive, splitNavBySection, type NavItem } from "@/components/layout/nav-items";
import { ProfileSwitcher } from "@/components/layout/ProfileSwitcher";
import { UserRole } from "@/types";

function initialsFromName(name?: string | null): string {
  if (!name) return "VS";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavGroup({
  pathname,
  title,
  items,
}: {
  pathname: string;
  title: string;
  items: NavItem[];
}) {
  if (!items.length) return null;

  return (
    <div className="mb-3">
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all duration-150",
              isNavItemActive(pathname, href)
                ? "border-transparent bg-[#1E90FF]/10 border-l-[3px] !border-l-[#1E90FF] text-white"
                : "border-transparent text-white/50 hover:bg-white/[0.04] hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { userRoles, activeRole, clearAccessToken, currentUser, organization } = useAuthToken();
  const navScope = activeRole ? [activeRole] : userRoles;
  const groups = splitNavBySection(navScope);
  const navGroups = [
    { title: "Início", items: groups.home },
    { title: "Provas e agenda", items: groups.events },
    { title: "Financeiro", items: groups.finance },
    { title: "Pontos e benefícios", items: groups.points },
    { title: "Comunicação", items: groups.communication },
    { title: "Técnico", items: groups.coaching },
    { title: "Administração", items: groups.admin },
    { title: "Plataforma", items: groups.platform },
    { title: "Conta", items: groups.account },
  ];

  const organizationLogo = resolveOrganizationLogo(organization?.logo_url);
  const hasAthleteProfile =
    userRoles.includes(UserRole.ATHLETE) || userRoles.includes(UserRole.PREMIUM_ATHLETE);
  const onlyPlatform = userRoles.includes(UserRole.SUPER_ADMIN) && !hasAthleteProfile;
  const profileHref = onlyPlatform
    ? "/super-admin"
    : hasAthleteProfile
      ? "/perfil"
      : "/configuracoes/conta";
  const profileLabel = onlyPlatform ? "Plataforma" : hasAthleteProfile ? "Perfil" : "Conta";
  const activeProfile = getProfileConfig(activeRole ?? userRoles[0]);

  const handleLogout = async () => {
    clearAccessToken();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best effort
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex h-full w-[200px] flex-col overflow-hidden border-r border-white/[0.06] bg-[#0A1628]">
      <div className="border-b border-white/[0.06] p-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1.5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
            <img
              src={organizationLogo}
              alt="Logo da assessoria"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(3,10,22,0.5)]"
            />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-[14px] font-bold leading-tight text-white">
              {organization?.name ?? "Ventu Suli"}
            </span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-white/35">
              {organization?.slug ?? "grupo de corrida"}
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <ProfileSwitcher className="mb-3" />
        {navGroups.map((group, index) =>
          group.items.length > 0 ? (
            <div key={group.title}>
              {index > 0 ? <div className="mb-2 h-px bg-white/[0.06]" /> : null}
              <NavGroup pathname={pathname} title={group.title} items={group.items} />
            </div>
          ) : null,
        )}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1E90FF]/20 text-[11px] font-bold text-white">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt="Avatar do usuário"
                className="h-full w-full object-cover"
              />
            ) : (
              <>{initialsFromName(currentUser?.name)}</>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white">
              {currentUser?.name ?? "Usuário"}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              {activeProfile ? (
                <span className="max-w-[86px] truncate rounded border border-[#ffc229]/25 bg-[#ffc229]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#ffc229]">
                  {activeProfile.shortLabel}
                </span>
              ) : null}
              <span className="truncate text-[10px] text-white/35">
                {activeProfile ? "Perfil ativo" : rolesLabel(userRoles)}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex gap-2 px-1">
          <Link
            href={profileHref}
            className="flex items-center gap-1.5 text-[11px] text-white/35 transition hover:text-white"
          >
            <UserCircle2 className="h-3.5 w-3.5" /> {profileLabel}
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 text-[11px] text-white/35 transition hover:text-white"
          >
            <DoorOpen className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
