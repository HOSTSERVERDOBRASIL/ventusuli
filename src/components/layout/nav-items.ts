"use client";

import {
  BellRing,
  CalendarDays,
  ClipboardList,
  Coins,
  Gift,
  Heart,
  IdCard,
  LayoutDashboard,
  Settings,
  Shield,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { ComponentType } from "react";
import { AccessPolicy, ROLE_GROUPS, canAccessPolicy } from "@/lib/authorization";
import { UserRole } from "@/types";

export type NavSection = "journey" | "operation" | "coaching" | "platform" | "account";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
  policy: AccessPolicy;
  section: NavSection;
  quickSearch?: boolean;
}

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/provas",
    label: "Provas",
    icon: Trophy,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/minhas-inscricoes",
    label: "Inscricoes e Pagamentos",
    icon: ClipboardList,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: Wallet,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/calendario",
    label: "Calendario",
    icon: CalendarDays,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/evolucao",
    label: "Evolucao e Ranking",
    icon: TrendingUp,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/comunidade",
    label: "Comunidade",
    icon: Heart,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/avisos",
    label: "Avisos",
    icon: BellRing,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/recompensas",
    label: "Recompensas",
    icon: Gift,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },
  {
    href: "/meus-resgates",
    label: "Meus Resgates",
    icon: Coins,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "journey",
    quickSearch: true,
  },

  {
    href: "/admin",
    label: "Cockpit Admin",
    icon: Shield,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/eventos",
    label: "Gestao de Provas",
    icon: Trophy,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/atletas",
    label: "Atletas",
    icon: Users,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/financeiro",
    label: "Financeiro Admin",
    icon: Wallet,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/recompensas",
    label: "Recompensas Admin",
    icon: Gift,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/resgates",
    label: "Resgates Admin",
    icon: Coins,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/pontos",
    label: "Pontos Admin",
    icon: TrendingUp,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/avisos",
    label: "Avisos Admin",
    icon: BellRing,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "NOTICES_MANAGE",
    section: "operation",
    quickSearch: true,
  },
  {
    href: "/admin/configuracoes",
    label: "Configuracoes Admin",
    icon: Settings,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "operation",
    quickSearch: true,
  },

  {
    href: "/coach",
    label: "Painel Tecnico",
    icon: LayoutDashboard,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
  {
    href: "/coach/atletas",
    label: "Atletas",
    icon: Users,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
  {
    href: "/coach/avisos",
    label: "Avisos",
    icon: BellRing,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },

  {
    href: "/super-admin/organizations",
    label: "Organizacoes",
    icon: Users,
    roles: [UserRole.SUPER_ADMIN],
    policy: "SUPER_ADMIN_ONLY",
    section: "platform",
    quickSearch: true,
  },
  {
    href: "/super-admin/admin-invites",
    label: "Convites Admin",
    icon: BellRing,
    roles: [UserRole.SUPER_ADMIN],
    policy: "SUPER_ADMIN_ONLY",
    section: "platform",
    quickSearch: true,
  },

  {
    href: "/perfil",
    label: "Meu Perfil",
    icon: IdCard,
    roles: [...ROLE_GROUPS.tenant],
    policy: "TENANT_AUTHENTICATED",
    section: "account",
    quickSearch: true,
  },
  {
    href: "/configuracoes/conta",
    label: "Configuracoes",
    icon: Settings,
    roles: [...ROLE_GROUPS.tenant],
    policy: "TENANT_AUTHENTICATED",
    section: "account",
    quickSearch: true,
  },
  {
    href: "/super-admin",
    label: "Minha Conta Plataforma",
    icon: IdCard,
    roles: [UserRole.SUPER_ADMIN],
    policy: "SUPER_ADMIN_ONLY",
    section: "account",
    quickSearch: true,
  },
];

export function getVisibleNavItems(role: UserRole | null): NavItem[] {
  if (!role) {
    return navItems.filter((item) => item.roles.includes(UserRole.ATHLETE));
  }

  return navItems.filter((item) => item.roles.includes(role) && canAccessPolicy(role, item.policy));
}

export function getQuickSearchLinks(role: UserRole | null): Array<{ href: string; label: string }> {
  return getVisibleNavItems(role)
    .filter((item) => item.quickSearch !== false)
    .map((item) => ({ href: item.href, label: item.label }));
}

export function splitNavBySection(role: UserRole | null): {
  journey: NavItem[];
  operation: NavItem[];
  coaching: NavItem[];
  platform: NavItem[];
  account: NavItem[];
} {
  const visible = getVisibleNavItems(role);
  return {
    journey: visible.filter((item) => item.section === "journey"),
    operation: visible.filter((item) => item.section === "operation"),
    coaching: visible.filter((item) => item.section === "coaching"),
    platform: visible.filter((item) => item.section === "platform"),
    account: visible.filter((item) => item.section === "account"),
  };
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  if (href === "/coach") return pathname === "/coach";
  if (href === "/super-admin") return pathname === "/super-admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
