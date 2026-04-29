"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { getQuickSearchLinks, getVisibleNavItems } from "@/components/layout/nav-items";
import { rolesLabel } from "@/lib/role-labels";
import { UserRole } from "@/types";

interface TopbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMobileMenuOpen: () => void;
}

export function Topbar({ user, onMobileMenuOpen }: TopbarProps) {
  const { clearAccessToken, userRoles, organization, currentUser } = useAuthToken();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const quickLinks = useMemo(() => getQuickSearchLinks(userRoles), [userRoles]);
  const currentPageLabel = useMemo(() => {
    const items = getVisibleNavItems(userRoles);
    const active = items
      .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return active?.label ?? "Dashboard";
  }, [pathname, userRoles]);
  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quickLinks;
    return quickLinks.filter((item) => item.label.toLowerCase().includes(q));
  }, [quickLinks, query]);
  const onlyPlatform = userRoles.includes(UserRole.SUPER_ADMIN) && !userRoles.includes(UserRole.ATHLETE);
  const profileHref = onlyPlatform ? "/super-admin" : "/perfil";
  const profileLabel = onlyPlatform ? "Plataforma" : "Meu perfil";
  const displayName = currentUser?.name ?? user?.name ?? "Usuario";
  const displayInitial = displayName[0]?.toUpperCase() ?? "U";

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

  // Close search on Escape
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#0D1B2A] px-4 sm:px-6">
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={onMobileMenuOpen}
        aria-label="Abrir menu"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/55 transition hover:bg-white/[0.05] lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden min-w-0 items-center gap-3 text-[13px] lg:flex">
        <div className="min-w-0">
          <span className="block truncate font-semibold text-white">{currentPageLabel}</span>
          <span className="block truncate text-[11px] text-white/35">
            {organization?.name ?? "Ventu Suli"}
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <button
            type="button"
            aria-label="Buscar"
            onClick={() => setSearchOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/55 transition hover:bg-white/[0.05]"
          >
            <Search className="h-4 w-4" />
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-10 z-30 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/[0.1] bg-[#112240] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="p-3">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar pÃ¡gina..."
                  className="w-full rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#1E90FF] focus:ring-1 focus:ring-[#1E90FF]/20"
                />
              </div>
              <div className="max-h-52 overflow-y-auto pb-2">
                {filteredLinks.length ? (
                  filteredLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      className="block px-4 py-2 text-[13px] text-white/70 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))
                ) : (
                  <p className="px-4 py-2 text-[13px] text-white/30">Nenhuma pÃ¡gina encontrada.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button
          type="button"
          aria-label="NotificaÃ§Ãµes"
          onClick={() => toast.info("Sem novas notificaÃ§Ãµes no momento.")}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/55 transition hover:bg-white/[0.05]"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#1E90FF]" />
        </button>

        {/* Avatar */}
        <Link
          href={profileHref}
          aria-label={profileLabel}
          className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-[13px] text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[#1E90FF]/20 text-[10px] font-bold text-white">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt="Avatar do usuÃ¡rio"
                className="h-full w-full object-cover"
              />
            ) : (
              <>{displayInitial}</>
            )}
          </div>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[140px] truncate font-medium leading-tight">{displayName}</span>
            <span className="block max-w-[140px] truncate text-[10px] leading-tight text-white/35">
              {rolesLabel(userRoles)}
            </span>
          </span>
        </Link>

        {/* Logout */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] px-3 text-[12px] font-semibold text-white/50 transition hover:bg-white/[0.05] hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Sair</span>
        </button>
      </div>
    </header>
  );
}
