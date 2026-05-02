"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveOrganizationLogo } from "@/lib/brand";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { isNavItemActive, splitNavBySection, type NavItem } from "@/components/layout/nav-items";
import { ProfileSwitcher } from "@/components/layout/ProfileSwitcher";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

function MobileGroup({
  pathname,
  title,
  items,
  onClose,
}: {
  pathname: string;
  title: string;
  items: NavItem[];
  onClose: () => void;
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[11px] uppercase tracking-[0.12em] text-[#87a8d1]">{title}</p>
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          className={cn(
            "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
            isNavItemActive(pathname, href)
              ? "border-[#2f5d8f] bg-[#112947] text-[#FDE7B8]"
              : "border-transparent text-[#b8cbe4] hover:border-[#20426a] hover:bg-[#0c1f37] hover:text-white",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </div>
  );
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { userRoles, activeRole, organization } = useAuthToken();
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

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        className={cn(
          "relative h-full w-[min(20rem,88vw)] border-r border-[#1b3556] bg-[radial-gradient(circle_at_10%_10%,rgba(16,39,65,0.6),transparent_30%),linear-gradient(180deg,#071227,#060f20)] p-4 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden">
              <img
                src={organizationLogo}
                alt="Logo da assessoria"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(3,10,22,0.45)]"
              />
            </div>
            <p className="text-sm font-semibold text-white">{organization?.name ?? "Menu"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu lateral"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#22466f] bg-[#0f233e] text-[#c8dbf8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-3 overflow-y-auto pb-8">
          <ProfileSwitcher className="mb-1" />
          {navGroups.map((group) => (
            <MobileGroup
              key={group.title}
              pathname={pathname}
              title={group.title}
              items={group.items}
              onClose={onClose}
            />
          ))}
        </nav>
      </aside>
    </div>
  );
}
