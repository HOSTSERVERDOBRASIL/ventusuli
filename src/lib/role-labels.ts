import { UserRole } from "@/types";
import { productProfileForRole, productProfileLabel } from "@/lib/product-profiles";

export function roleLabel(role: UserRole | string | null | undefined): string {
  if (!role) return "Usuario";
  return productProfileLabel(productProfileForRole(role));
}

export function rolesLabel(roles: Array<UserRole | string> | null | undefined): string {
  if (!roles?.length) return "Usuario";
  return Array.from(new Set(roles.map(roleLabel))).join(" + ");
}

export function managedAthleteLabel(): string {
  return "Atleta do grupo";
}
