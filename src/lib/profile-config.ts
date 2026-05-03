import {
  BadgeCheck,
  Building2,
  Crown,
  Handshake,
  Headphones,
  Megaphone,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@/types";
import {
  collapseRolesToProductProfiles,
  productProfileDescription,
  productProfileForRole,
  productProfileLabel,
} from "@/lib/product-profiles";

export interface ProfileConfig {
  role: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
}

export const PROFILE_CONFIG: Record<UserRole, ProfileConfig> = {
  [UserRole.SUPER_ADMIN]: {
    role: UserRole.SUPER_ADMIN,
    label: productProfileLabel("platform"),
    shortLabel: "Plataforma",
    description: productProfileDescription("platform"),
    href: "/super-admin",
    icon: ShieldCheck,
    accent: "text-violet-200 bg-violet-500/12 border-violet-300/25",
  },
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    label: productProfileLabel("admin"),
    shortLabel: "Admin",
    description: productProfileDescription("admin"),
    href: "/admin",
    icon: Shield,
    accent: "text-sky-200 bg-sky-500/12 border-sky-300/25",
  },
  [UserRole.MANAGER]: {
    role: UserRole.MANAGER,
    label: productProfileLabel("coordinator"),
    shortLabel: "Coord.",
    description: productProfileDescription("coordinator"),
    href: "/gestor",
    icon: SlidersHorizontal,
    accent: "text-cyan-100 bg-cyan-500/12 border-cyan-300/25",
  },
  [UserRole.FINANCE]: {
    role: UserRole.FINANCE,
    label: productProfileLabel("finance"),
    shortLabel: "Financeiro",
    description: productProfileDescription("finance"),
    href: "/admin/financeiro",
    icon: Building2,
    accent: "text-emerald-100 bg-emerald-500/12 border-emerald-300/25",
  },
  [UserRole.ORGANIZER]: {
    role: UserRole.ORGANIZER,
    label: productProfileLabel("coordinator"),
    shortLabel: "Coord.",
    description: productProfileDescription("coordinator"),
    href: "/organizador",
    icon: Megaphone,
    accent: "text-orange-100 bg-orange-500/12 border-orange-300/25",
  },
  [UserRole.COACH]: {
    role: UserRole.COACH,
    label: productProfileLabel("coach"),
    shortLabel: "Treinador",
    description: productProfileDescription("coach"),
    href: "/coach",
    icon: UserRoundCheck,
    accent: "text-lime-100 bg-lime-500/12 border-lime-300/25",
  },
  [UserRole.SUPPORT]: {
    role: UserRole.SUPPORT,
    label: productProfileLabel("coordinator"),
    shortLabel: "Coord.",
    description: productProfileDescription("coordinator"),
    href: "/suporte",
    icon: Headphones,
    accent: "text-teal-100 bg-teal-500/12 border-teal-300/25",
  },
  [UserRole.MODERATOR]: {
    role: UserRole.MODERATOR,
    label: productProfileLabel("coordinator"),
    shortLabel: "Coord.",
    description: productProfileDescription("coordinator"),
    href: "/moderador",
    icon: BadgeCheck,
    accent: "text-rose-100 bg-rose-500/12 border-rose-300/25",
  },
  [UserRole.PARTNER]: {
    role: UserRole.PARTNER,
    label: productProfileLabel("coordinator"),
    shortLabel: "Coord.",
    description: productProfileDescription("coordinator"),
    href: "/parceiro",
    icon: Handshake,
    accent: "text-amber-100 bg-amber-500/12 border-amber-300/25",
  },
  [UserRole.PREMIUM_ATHLETE]: {
    role: UserRole.PREMIUM_ATHLETE,
    label: productProfileLabel("athlete"),
    shortLabel: "Atleta",
    description: productProfileDescription("athlete"),
    href: "/premium",
    icon: Crown,
    accent: "text-yellow-100 bg-yellow-500/12 border-yellow-300/25",
  },
  [UserRole.ATHLETE]: {
    role: UserRole.ATHLETE,
    label: productProfileLabel("athlete"),
    shortLabel: "Atleta",
    description: productProfileDescription("athlete"),
    href: "/",
    icon: Trophy,
    accent: "text-blue-100 bg-blue-500/12 border-blue-300/25",
  },
};

const PROFILE_ORDER: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.FINANCE,
  UserRole.COACH,
  UserRole.ATHLETE,
  UserRole.ORGANIZER,
  UserRole.SUPPORT,
  UserRole.MODERATOR,
  UserRole.PARTNER,
  UserRole.PREMIUM_ATHLETE,
];

export function sortRolesForProfiles(roles: readonly UserRole[]): UserRole[] {
  const unique = new Set(roles);
  const orderedRoles = PROFILE_ORDER.filter((role) => unique.has(role));
  return collapseRolesToProductProfiles(orderedRoles).sort((a, b) => {
    const profileA = productProfileForRole(a);
    const profileB = productProfileForRole(b);
    const order = ["platform", "admin", "coordinator", "finance", "coach", "athlete"];
    return order.indexOf(profileA) - order.indexOf(profileB);
  });
}

export function getProfileConfig(role: UserRole | null | undefined): ProfileConfig | null {
  if (!role) return null;
  return PROFILE_CONFIG[role] ?? null;
}

export function getDefaultProfileRole(roles: readonly UserRole[]): UserRole | null {
  return sortRolesForProfiles(roles)[0] ?? null;
}
