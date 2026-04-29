"use client";

import {
  BarChart3,
  BellRing,
  CalendarDays,
  Camera,
  ClipboardList,
  Coins,
  CreditCard,
  Dumbbell,
  FileSearch,
  Gift,
  Handshake,
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
import { AccessPolicy, ROLE_GROUPS, canAccessPolicyAny } from "@/lib/authorization";
import { UserRole } from "@/types";

export type NavSection =
  | "home"
  | "events"
  | "finance"
  | "points"
  | "communication"
  | "coaching"
  | "admin"
  | "platform"
  | "account";

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
    section: "home",
    quickSearch: true,
  },
  {
    href: "/provas",
    label: "Provas",
    icon: Trophy,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "events",
    quickSearch: true,
  },
  {
    href: "/minhas-inscricoes",
    label: "Inscricoes e Pagamentos",
    icon: ClipboardList,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "events",
    quickSearch: true,
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: Wallet,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "finance",
    quickSearch: true,
  },
  {
    href: "/treinos",
    label: "Treinos",
    icon: Dumbbell,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "home",
    quickSearch: true,
  },
  {
    href: "/calendario",
    label: "Calendario",
    icon: CalendarDays,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "events",
    quickSearch: true,
  },
  {
    href: "/evolucao",
    label: "Evolucao e Ranking",
    icon: TrendingUp,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "home",
    quickSearch: true,
  },
  {
    href: "/comunidade",
    label: "Comunidade",
    icon: Heart,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "communication",
    quickSearch: true,
  },
  {
    href: "/avisos",
    label: "Avisos",
    icon: BellRing,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "communication",
    quickSearch: true,
  },
  {
    href: "/fotos",
    label: "Fotos",
    icon: Camera,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "points",
    quickSearch: true,
  },
  {
    href: "/recompensas",
    label: "Recompensas",
    icon: Gift,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "points",
    quickSearch: true,
  },
  {
    href: "/meus-resgates",
    label: "Meus Resgates",
    icon: Coins,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "points",
    quickSearch: true,
  },
  {
    href: "/patrocinadores",
    label: "Patrocinadores",
    icon: Handshake,
    roles: [...ROLE_GROUPS.athlete],
    policy: "ATHLETE_AREA",
    section: "communication",
    quickSearch: true,
  },

  {
    href: "/admin",
    label: "Visao Geral",
    icon: Shield,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "home",
    quickSearch: true,
  },
  {
    href: "/admin/eventos",
    label: "Provas",
    icon: Trophy,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "events",
    quickSearch: true,
  },
  {
    href: "/admin/atletas",
    label: "Atletas",
    icon: Users,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "admin",
    quickSearch: true,
  },
  {
    href: "/admin/financeiro",
    label: "Financeiro",
    icon: BarChart3,
    roles: [...ROLE_GROUPS.tenantFinance],
    policy: "FINANCE_AREA",
    section: "finance",
    quickSearch: true,
  },
  {
    href: "/admin/recompensas",
    label: "Catalogo de Recompensas",
    icon: Gift,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "points",
    quickSearch: true,
  },
  {
    href: "/admin/resgates",
    label: "Resgates",
    icon: Coins,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "points",
    quickSearch: true,
  },
  {
    href: "/admin/pontos",
    label: "Pontos e Auditoria",
    icon: TrendingUp,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "points",
    quickSearch: true,
  },
  {
    href: "/admin/avisos",
    label: "Avisos",
    icon: BellRing,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "NOTICES_MANAGE",
    section: "communication",
    quickSearch: true,
  },
  {
    href: "/admin/configuracoes",
    label: "Configuracoes",
    icon: Settings,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "admin",
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
    href: "/coach/treinos",
    label: "Treinos",
    icon: Dumbbell,
    roles: [...ROLE_GROUPS.coach],
    policy: "COACH_AREA",
    section: "coaching",
    quickSearch: true,
  },
  {
    href: "/admin/fotos",
    label: "Fotos",
    icon: Camera,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "points",
    quickSearch: true,
  },
  {
    href: "/admin/patrocinadores",
    label: "Patrocinadores",
    icon: Handshake,
    roles: [...ROLE_GROUPS.tenantAdmin],
    policy: "ADMIN_ONLY",
    section: "finance",
    quickSearch: true,
  },
  {
    href: "/coach/calendario",
    label: "Calendario Tecnico",
    icon: CalendarDays,
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
    href: "/super-admin",
    label: "Painel Plataforma",
    icon: LayoutDashboard,
    roles: [UserRole.SUPER_ADMIN],
    policy: "SUPER_ADMIN_ONLY",
    section: "home",
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
    label: "Convites de Acesso",
    icon: BellRing,
    roles: [UserRole.SUPER_ADMIN],
    policy: "SUPER_ADMIN_ONLY",
    section: "platform",
    quickSearch: true,
  },
  {
    href: "/super-admin/billing",
    label: "Locacao da Plataforma",
    icon: CreditCard,
    roles: [UserRole.SUPER_ADMIN],
    policy: "SUPER_ADMIN_ONLY",
    section: "platform",
    quickSearch: true,
  },
  {
    href: "/super-admin/audit",
    label: "Auditoria",
    icon: FileSearch,
    roles: [UserRole.SUPER_ADMIN],
    policy: "SUPER_ADMIN_ONLY",
    section: "platform",
    quickSearch: true,
  },

  {
    href: "/perfil",
    label: "Perfil",
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
];

export function getVisibleNavItems(roles: UserRole | UserRole[] | null): NavItem[] {
  const normalizedRoles = Array.isArray(roles) ? roles : roles ? [roles] : [];

  if (!normalizedRoles.length) {
    return navItems.filter((item) => item.roles.includes(UserRole.ATHLETE));
  }

  return navItems.filter(
    (item) =>
      item.roles.some((role) => normalizedRoles.includes(role)) &&
      canAccessPolicyAny(normalizedRoles, item.policy),
  );
}

export function getQuickSearchLinks(roles: UserRole | UserRole[] | null): Array<{ href: string; label: string }> {
  return getVisibleNavItems(roles)
    .filter((item) => item.quickSearch !== false)
    .map((item) => ({ href: item.href, label: item.label }));
}

export function splitNavBySection(roles: UserRole | UserRole[] | null): {
  home: NavItem[];
  events: NavItem[];
  finance: NavItem[];
  points: NavItem[];
  communication: NavItem[];
  coaching: NavItem[];
  admin: NavItem[];
  platform: NavItem[];
  account: NavItem[];
} {
  const visible = getVisibleNavItems(roles);
  return {
    home: visible.filter((item) => item.section === "home"),
    events: visible.filter((item) => item.section === "events"),
    finance: visible.filter((item) => item.section === "finance"),
    points: visible.filter((item) => item.section === "points"),
    communication: visible.filter((item) => item.section === "communication"),
    coaching: visible.filter((item) => item.section === "coaching"),
    admin: visible.filter((item) => item.section === "admin"),
    platform: visible.filter((item) => item.section === "platform"),
    account: visible.filter((item) => item.section === "account"),
  };
}

export function isNavItemActive(pathname: string, href: string): boolean {
  const hrefPath = href.split("?")[0] ?? href;
  if (hrefPath === "/") return pathname === "/";
  if (hrefPath === "/admin") return pathname === "/admin";
  if (hrefPath === "/coach") return pathname === "/coach";
  if (hrefPath === "/super-admin") return pathname === "/super-admin";
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}
