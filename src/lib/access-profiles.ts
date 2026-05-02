import { UserRole } from "@/types";

const ROLE_PRIORITY: UserRole[] = [
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

export function normalizeRoles(roles: Array<UserRole | string | null | undefined>): UserRole[] {
  const allowed = new Set(Object.values(UserRole));
  const unique = new Set<UserRole>();

  for (const role of roles) {
    if (!role) continue;
    const normalized = String(role).toUpperCase() as UserRole;
    if (allowed.has(normalized)) unique.add(normalized);
  }

  return ROLE_PRIORITY.filter((role) => unique.has(role));
}

export function buildEffectiveRoles(params: {
  primaryRole: UserRole | string;
  accessRoles?: Array<UserRole | string | null | undefined> | null;
  hasAthleteProfile?: boolean | null;
}): UserRole[] {
  const explicitRoles = normalizeRoles([params.primaryRole, ...(params.accessRoles ?? [])]);
  const hasPremiumAthlete = explicitRoles.includes(UserRole.PREMIUM_ATHLETE);

  return normalizeRoles([
    ...explicitRoles,
    params.hasAthleteProfile && !hasPremiumAthlete ? UserRole.ATHLETE : null,
  ]);
}

export function primaryRoleFromRoles(roles: readonly UserRole[]): UserRole | null {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? roles[0] ?? null;
}
