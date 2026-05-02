import { UserRole } from "@/types";

export function roleLabel(role: UserRole | string | null | undefined): string {
  if (role === UserRole.SUPER_ADMIN || role === "SUPER_ADMIN") return "Administrador da plataforma";
  if (role === UserRole.ADMIN || role === "ADMIN") return "Gestor da assessoria";
  if (role === UserRole.FINANCE || role === "FINANCE") return "Financeiro";
  if (role === UserRole.COACH || role === "COACH") return "Treinador";
  if (role === UserRole.ATHLETE || role === "ATHLETE") return "Atleta";
  if (role === UserRole.ORGANIZER || role === "ORGANIZER") return "Organizador";
  if (role === UserRole.MANAGER || role === "MANAGER") return "Gestor geral";
  if (role === UserRole.PREMIUM_ATHLETE || role === "PREMIUM_ATHLETE") return "Atleta premium";
  if (role === UserRole.SUPPORT || role === "SUPPORT") return "Suporte";
  if (role === UserRole.MODERATOR || role === "MODERATOR") return "Moderador";
  if (role === UserRole.PARTNER || role === "PARTNER") return "Parceiro";
  return "Usuario";
}

export function rolesLabel(roles: Array<UserRole | string> | null | undefined): string {
  if (!roles?.length) return "Usuario";
  return roles.map(roleLabel).join(" + ");
}

export function managedAthleteLabel(): string {
  return "Atleta Associado";
}
