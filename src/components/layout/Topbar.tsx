"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, ChevronRight, LogOut, Menu, Search } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { getQuickSearchLinks } from "@/components/layout/nav-items";
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
  const { clearAccessToken, userRole, organization, currentUser } = useAuthToken();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const quickLinks = useMemo(() => getQuickSearchLinks(userRole), [userRole]);
  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quickLinks;
    return quickLinks.filter((item) => item.label.toLowerCase().includes(q));
  }, [quickLinks, query]);
  const organizationLogo = (() => {
    const logoUrl = organization?.logo_url?.trim();
    if (!logoUrl) return "/branding/ventu-suli-logo.png";
    if (logoUrl.toLowerCase().includes("cdn.seudominio.com/logo.png"))
      return "/branding/ventu-suli-logo.png";
    return logoUrl;
  })();
  const profileHref = userRole === UserRole.SUPER_ADMIN ? "/super-admin" : "/perfil";
  const profileLabel = userRole === UserRole.SUPER_ADMIN ? "Plataforma" : "Meu perfil";

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

      {/* Breadcrumb */}
      <div className="hidden items-center gap-2 text-[13px] lg:flex">
        <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[#1E90FF]/40 bg-transparent shadow-[0_10px_24px_rgba(3,10,22,0.45)]">
          <img
            src={organizationLogo}
            alt="Logo da assessoria"
            className="h-full w-full scale-[1.35] object-cover mix-blend-screen drop-shadow-[0_8px_16px_rgba(3,10,22,0.45)]"
          />
        </div>
        <span className="text-white/30">{organization?.name ?? "Ventu Suli"}</span>
        <ChevronRight className="h-3.5 w-3.5 text-white/20" />
        <span className="font-semibold text-white">Dashboard</span>
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
                  placeholder="Buscar página..."
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
                  <p className="px-4 py-2 text-[13px] text-white/30">Nenhuma página encontrada.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notificações"
          onClick={() => toast.info("Sem novas notificações no momento.")}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/55 transition hover:bg-white/[0.05]"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#1E90FF]" />
        </button>

        {/* Avatar */}
        <Link
          href={profileHref}
          aria-label={profileLabel}
          className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-[13px] text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[#1E90FF]/20 text-[10px] font-bold text-white">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt="Avatar do usuário"
                className="h-full w-full object-cover"
              />
            ) : (
              <>{(currentUser?.name ?? user?.name ?? "U")[0]?.toUpperCase()}</>
            )}
          </div>
          <span className="hidden font-medium sm:block">
            {currentUser?.name?.split(" ")[0] ?? "Perfil"}
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
