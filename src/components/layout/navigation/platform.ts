import { BellRing, CreditCard, FileSearch, LayoutDashboard, Users } from "lucide-react";
import type { NavItem } from "@/components/layout/navigation/types";
import { UserRole } from "@/types";

export const platformNavItems: NavItem[] = [
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
    label: "Organizações",
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
    label: "Locação da Plataforma",
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
];
