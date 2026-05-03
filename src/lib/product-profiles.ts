import { UserRole } from "@/types";

export type ProductProfile = "platform" | "admin" | "finance" | "coordinator" | "coach" | "athlete";

export const CANONICAL_ASSIGNABLE_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.FINANCE,
  UserRole.COACH,
  UserRole.ATHLETE,
] as const;

const COORDINATOR_ROLES = new Set<UserRole>([
  UserRole.MANAGER,
  UserRole.ORGANIZER,
  UserRole.SUPPORT,
  UserRole.MODERATOR,
  UserRole.PARTNER,
]);

const ATHLETE_ROLES = new Set<UserRole>([UserRole.ATHLETE, UserRole.PREMIUM_ATHLETE]);

export function parseUserRole(role: UserRole | string | null | undefined): UserRole | null {
  if (!role) return null;
  const normalized = String(role).toUpperCase() as UserRole;
  return Object.values(UserRole).includes(normalized) ? normalized : null;
}

export function productProfileForRole(role: UserRole | string | null | undefined): ProductProfile {
  const parsed = parseUserRole(role);
  if (parsed === UserRole.SUPER_ADMIN) return "platform";
  if (parsed === UserRole.ADMIN) return "admin";
  if (parsed === UserRole.FINANCE) return "finance";
  if (parsed === UserRole.COACH) return "coach";
  if (parsed && COORDINATOR_ROLES.has(parsed)) return "coordinator";
  if (parsed && ATHLETE_ROLES.has(parsed)) return "athlete";
  return "athlete";
}

export function productProfileLabel(profile: ProductProfile): string {
  if (profile === "platform") return "Administrador da plataforma";
  if (profile === "admin") return "Gestor do grupo";
  if (profile === "finance") return "Financeiro";
  if (profile === "coordinator") return "Coordenador";
  if (profile === "coach") return "Treinador";
  return "Atleta";
}

export function productProfileDescription(profile: ProductProfile): string {
  if (profile === "platform") return "Operacao global, auditoria e organizacoes.";
  if (profile === "admin") return "Acesso completo a configuracoes, equipe, financeiro e operacao.";
  if (profile === "finance") return "Recebimentos, cobrancas, relatorios e pendencias.";
  if (profile === "coordinator") return "Operacao de atletas, provas, comunicacao, pontos e parceiros.";
  if (profile === "coach") return "Acompanhamento tecnico, treinos, atletas e agenda.";
  return "Treinos, provas, inscricoes, pontos, recompensas e comunidade.";
}

export function canonicalRoleForProductProfile(profile: ProductProfile): UserRole {
  if (profile === "platform") return UserRole.SUPER_ADMIN;
  if (profile === "admin") return UserRole.ADMIN;
  if (profile === "finance") return UserRole.FINANCE;
  if (profile === "coordinator") return UserRole.MANAGER;
  if (profile === "coach") return UserRole.COACH;
  return UserRole.ATHLETE;
}

export function isCoordinatorRole(role: UserRole | string | null | undefined): boolean {
  const parsed = parseUserRole(role);
  return Boolean(parsed && COORDINATOR_ROLES.has(parsed));
}

export function isAthleteProductRole(role: UserRole | string | null | undefined): boolean {
  const parsed = parseUserRole(role);
  return Boolean(parsed && ATHLETE_ROLES.has(parsed));
}

export function collapseRolesToProductProfiles(roles: readonly UserRole[]): UserRole[] {
  const seenProfiles = new Set<ProductProfile>();
  const result: UserRole[] = [];

  for (const role of roles) {
    const profile = productProfileForRole(role);
    if (seenProfiles.has(profile)) continue;
    seenProfiles.add(profile);
    result.push(role);
  }

  return result;
}
