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
    label: "Administrador da plataforma",
    shortLabel: "Plataforma",
    description: "Operacao global, auditoria e organizacoes.",
    href: "/super-admin",
    icon: ShieldCheck,
    accent: "text-violet-200 bg-violet-500/12 border-violet-300/25",
  },
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    label: "Gestor da assessoria",
    shortLabel: "Admin",
    description: "Configuracao, atletas, provas, financeiro e pontos.",
    href: "/admin",
    icon: Shield,
    accent: "text-sky-200 bg-sky-500/12 border-sky-300/25",
  },
  [UserRole.MANAGER]: {
    role: UserRole.MANAGER,
    label: "Gestor geral",
    shortLabel: "Gestor",
    description: "Visao executiva e acompanhamento da operacao.",
    href: "/gestor",
    icon: SlidersHorizontal,
    accent: "text-cyan-100 bg-cyan-500/12 border-cyan-300/25",
  },
  [UserRole.FINANCE]: {
    role: UserRole.FINANCE,
    label: "Financeiro",
    shortLabel: "Financeiro",
    description: "Recebimentos, inscricoes e pendencias financeiras.",
    href: "/admin/financeiro",
    icon: Building2,
    accent: "text-emerald-100 bg-emerald-500/12 border-emerald-300/25",
  },
  [UserRole.ORGANIZER]: {
    role: UserRole.ORGANIZER,
    label: "Organizador de eventos",
    shortLabel: "Organizador",
    description: "Calendario, check-in, participacao e logistica.",
    href: "/organizador",
    icon: Megaphone,
    accent: "text-orange-100 bg-orange-500/12 border-orange-300/25",
  },
  [UserRole.COACH]: {
    role: UserRole.COACH,
    label: "Treinador",
    shortLabel: "Coach",
    description: "Acompanhamento tecnico, treinos e agenda.",
    href: "/coach",
    icon: UserRoundCheck,
    accent: "text-lime-100 bg-lime-500/12 border-lime-300/25",
  },
  [UserRole.SUPPORT]: {
    role: UserRole.SUPPORT,
    label: "Suporte",
    shortLabel: "Suporte",
    description: "Fila de atendimento, contas e operacao assistida.",
    href: "/suporte",
    icon: Headphones,
    accent: "text-teal-100 bg-teal-500/12 border-teal-300/25",
  },
  [UserRole.MODERATOR]: {
    role: UserRole.MODERATOR,
    label: "Moderador",
    shortLabel: "Moderador",
    description: "Comunicados, comunidade, fotos e conteudo.",
    href: "/moderador",
    icon: BadgeCheck,
    accent: "text-rose-100 bg-rose-500/12 border-rose-300/25",
  },
  [UserRole.PARTNER]: {
    role: UserRole.PARTNER,
    label: "Parceiro",
    shortLabel: "Parceiro",
    description: "Patrocinios, beneficios e relacionamento.",
    href: "/parceiro",
    icon: Handshake,
    accent: "text-amber-100 bg-amber-500/12 border-amber-300/25",
  },
  [UserRole.PREMIUM_ATHLETE]: {
    role: UserRole.PREMIUM_ATHLETE,
    label: "Atleta premium",
    shortLabel: "Premium",
    description: "Experiencia avancada de treinos, provas e beneficios.",
    href: "/premium",
    icon: Crown,
    accent: "text-yellow-100 bg-yellow-500/12 border-yellow-300/25",
  },
  [UserRole.ATHLETE]: {
    role: UserRole.ATHLETE,
    label: "Atleta",
    shortLabel: "Atleta",
    description: "Treinos, provas, pontos, recompensas e comunidade.",
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
  UserRole.ORGANIZER,
  UserRole.COACH,
  UserRole.SUPPORT,
  UserRole.MODERATOR,
  UserRole.PARTNER,
  UserRole.PREMIUM_ATHLETE,
  UserRole.ATHLETE,
];

export function sortRolesForProfiles(roles: readonly UserRole[]): UserRole[] {
  const unique = new Set(roles);
  return PROFILE_ORDER.filter((role) => unique.has(role));
}

export function getProfileConfig(role: UserRole | null | undefined): ProfileConfig | null {
  if (!role) return null;
  return PROFILE_CONFIG[role] ?? null;
}

export function getDefaultProfileRole(roles: readonly UserRole[]): UserRole | null {
  return sortRolesForProfiles(roles)[0] ?? null;
}
