"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { getQuickSearchLinks, getVisibleNavItems } from "@/components/layout/nav-items";
import { ProfileSwitcher } from "@/components/layout/ProfileSwitcher";
import { getProfileConfig } from "@/lib/profile-config";
import { rolesLabel } from "@/lib/role-labels";
import { getNotifications, markNotificationRead } from "@/services/notification-service";
import { UserNotificationItem } from "@/services/types";
import { UserRole } from "@/types";

interface TopbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMobileMenuOpen: () => void;
}

function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return "U";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Topbar({ user, onMobileMenuOpen }: TopbarProps) {
  const {
    accessToken,
    clearAccessToken,
    hydrated,
    userRoles,
    activeRole,
    organization,
    currentUser,
  } = useAuthToken();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState("");
  const navScope = useMemo(() => (activeRole ? [activeRole] : userRoles), [activeRole, userRoles]);

  const quickLinks = useMemo(() => getQuickSearchLinks(navScope), [navScope]);
  const currentPageLabel = useMemo(() => {
    const items = getVisibleNavItems(navScope);
    const active = items
      .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return active?.label ?? "Dashboard";
  }, [navScope, pathname]);
  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quickLinks;
    return quickLinks.filter((item) => item.label.toLowerCase().includes(q));
  }, [quickLinks, query]);
  const hasAthleteProfile =
    userRoles.includes(UserRole.ATHLETE) || userRoles.includes(UserRole.PREMIUM_ATHLETE);
  const onlyPlatform = userRoles.includes(UserRole.SUPER_ADMIN) && !hasAthleteProfile;
  const profileHref = onlyPlatform ? "/super-admin" : hasAthleteProfile ? "/perfil" : "/configuracoes/conta";
  const profileLabel = onlyPlatform ? "Plataforma" : hasAthleteProfile ? "Meu perfil" : "Conta";
  const displayName = currentUser?.name ?? user?.name ?? "Usuário";
  const displayInitials = initialsFromName(displayName);
  const avatarUrl = currentUser?.avatar_url ?? user?.image ?? null;
  const activeProfile = getProfileConfig(activeRole ?? userRoles[0]);

  const loadNotifications = useCallback(async () => {
    if (!hydrated) return;
    setNotificationsLoading(true);
    try {
      const payload = await getNotifications({ accessToken, limit: 6 });
      setNotifications(payload.data);
      setUnreadCount(payload.meta.unread_count);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, [accessToken, hydrated]);

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

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notificationsOpen]);

  const handleNotificationClick = (notification: UserNotificationItem) => {
    setNotificationsOpen(false);
    if (!notification.read_at) {
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      );
    }
    void markNotificationRead(notification.id, accessToken).catch(() => undefined);
  };

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
        <div className="relative">
          <button
            type="button"
            aria-label="Notificações"
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              if (!notificationsOpen) void loadNotifications();
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/55 transition hover:bg-white/[0.05]"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1E90FF] px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white/25" />
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-10 z-30 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/[0.1] bg-[#112240] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                <span className="text-[13px] font-semibold text-white">Notificações</span>
                <Link
                  href="/avisos"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[11px] font-semibold text-[#8ec5ff] transition hover:text-white"
                >
                  Avisos
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {notificationsLoading ? (
                  <p className="px-4 py-3 text-[13px] text-white/35">Carregando...</p>
                ) : notifications.length ? (
                  notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.url ?? "/avisos"}
                      onClick={() => handleNotificationClick(notification)}
                      className="flex gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.05]"
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          notification.read_at ? "bg-white/20" : "bg-[#1E90FF]"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-white">
                          {notification.title}
                        </span>
                        <span className="mt-1 block max-h-10 overflow-hidden text-[12px] leading-snug text-white/45">
                          {notification.body}
                        </span>
                        <span className="mt-2 block text-[10px] font-semibold text-white/25">
                          {formatNotificationTime(notification.created_at)}
                        </span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="px-4 py-3 text-[13px] text-white/35">
                    Sem notificações no momento.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <ProfileSwitcher compact />

        {/* Avatar */}
        <Link
          href={profileHref}
          aria-label={profileLabel}
          className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-[13px] text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <div className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-[#1E90FF]/20 text-[10px] font-bold text-white">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar do usuário"
                fill
                sizes="20px"
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <>{displayInitials}</>
            )}
          </div>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[140px] truncate font-medium leading-tight">{displayName}</span>
            <span className="block max-w-[140px] truncate text-[10px] leading-tight text-white/35">
              {activeProfile ? activeProfile.shortLabel : rolesLabel(userRoles)}
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
