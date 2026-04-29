import { UserRole } from "@/types";

export function roleLabel(role: UserRole | string | null | undefined): string {
  if (role === UserRole.SUPER_ADMIN || role === "SUPER_ADMIN") return "Administrador da plataforma";
  if (role === UserRole.ADMIN || role === "ADMIN") return "Gestor da assessoria";
  if (role === UserRole.FINANCE || role === "FINANCE") return "Financeiro";
  if (role === UserRole.COACH || role === "COACH") return "Treinador";
  if (role === UserRole.ATHLETE || role === "ATHLETE") return "Atleta";
  return "Usuario";
}

export function rolesLabel(roles: Array<UserRole | string> | null | undefined): string {
  if (!roles?.length) return "Usuario";
  return roles.map(roleLabel).join(" + ");
}

export function managedAthleteLabel(): string {
  return "Atleta Associado";
}
