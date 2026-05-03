import { UserRole } from "@/types";

export const ROLE_GROUPS = {
  platform: [UserRole.SUPER_ADMIN] as const,
  platformAdmin: [UserRole.SUPER_ADMIN] as const,
  tenant: [
    UserRole.ADMIN,
    UserRole.FINANCE,
    UserRole.COACH,
    UserRole.ATHLETE,
    UserRole.PREMIUM_ATHLETE,
    UserRole.MANAGER,
    UserRole.ORGANIZER,
    UserRole.SUPPORT,
    UserRole.MODERATOR,
    UserRole.PARTNER,
  ] as const,
  tenantAdmin: [UserRole.ADMIN] as const,
  tenantFinance: [UserRole.ADMIN, UserRole.FINANCE] as const,
  tenantStaff: [UserRole.ADMIN, UserRole.COACH, UserRole.MANAGER, UserRole.SUPPORT] as const,
  coach: [UserRole.ADMIN, UserRole.COACH] as const,
  athlete: [UserRole.ATHLETE, UserRole.PREMIUM_ATHLETE] as const,
  premiumAthlete: [UserRole.PREMIUM_ATHLETE] as const,
  manager: [UserRole.MANAGER, UserRole.ADMIN] as const,
  organizer: [UserRole.ORGANIZER, UserRole.ADMIN, UserRole.MANAGER] as const,
  support: [UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPER_ADMIN] as const,
  moderator: [UserRole.MODERATOR, UserRole.ADMIN, UserRole.MANAGER] as const,
  partner: [UserRole.PARTNER, UserRole.ADMIN, UserRole.MANAGER] as const,
  noticesRead: [
    UserRole.ADMIN,
    UserRole.COACH,
    UserRole.ATHLETE,
    UserRole.PREMIUM_ATHLETE,
    UserRole.MANAGER,
    UserRole.SUPPORT,
    UserRole.MODERATOR,
  ] as const,
  noticesManage: [UserRole.ADMIN, UserRole.MANAGER, UserRole.MODERATOR] as const,
} as const;

export type AccessPolicy =
  | "TENANT_AUTHENTICATED"
  | "SUPER_ADMIN_ONLY"
  | "ADMIN_ONLY"
  | "FINANCE_AREA"
  | "TENANT_STAFF"
  | "COACH_AREA"
  | "ATHLETE_AREA"
  | "PREMIUM_ATHLETE_AREA"
  | "MANAGER_AREA"
  | "ORGANIZER_AREA"
  | "SUPPORT_AREA"
  | "MODERATOR_AREA"
  | "PARTNER_AREA"
  | "NOTICES_READ"
  | "NOTICES_MANAGE";

const POLICY_ROLES: Record<AccessPolicy, readonly UserRole[]> = {
  TENANT_AUTHENTICATED: ROLE_GROUPS.tenant,
  SUPER_ADMIN_ONLY: ROLE_GROUPS.platformAdmin,
  ADMIN_ONLY: ROLE_GROUPS.tenantAdmin,
  FINANCE_AREA: ROLE_GROUPS.tenantFinance,
  TENANT_STAFF: ROLE_GROUPS.tenantStaff,
  COACH_AREA: ROLE_GROUPS.coach,
  ATHLETE_AREA: ROLE_GROUPS.athlete,
  PREMIUM_ATHLETE_AREA: ROLE_GROUPS.premiumAthlete,
  MANAGER_AREA: ROLE_GROUPS.manager,
  ORGANIZER_AREA: ROLE_GROUPS.organizer,
  SUPPORT_AREA: ROLE_GROUPS.support,
  MODERATOR_AREA: ROLE_GROUPS.moderator,
  PARTNER_AREA: ROLE_GROUPS.partner,
  NOTICES_READ: ROLE_GROUPS.noticesRead,
  NOTICES_MANAGE: ROLE_GROUPS.noticesManage,
};

export function canAccessPolicy(role: UserRole | null | undefined, policy: AccessPolicy): boolean {
  if (!role) return false;
  return POLICY_ROLES[policy].includes(role);
}

export function canAccessPolicyAny(
  roles: readonly UserRole[] | null | undefined,
  policy: AccessPolicy,
): boolean {
  if (!roles?.length) return false;
  return roles.some((role) => canAccessPolicy(role, policy));
}

export function resolveRoleForPolicy(
  roles: readonly UserRole[] | null | undefined,
  policy: AccessPolicy,
): UserRole | null {
  if (!roles?.length) return null;
  return roles.find((role) => canAccessPolicy(role, policy)) ?? null;
}

export function hasAnyRole(
  role: UserRole | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}

export interface RoutePolicyRule {
  prefix: string;
  policy: AccessPolicy;
  methods?: readonly string[];
}

export const PAGE_ROUTE_POLICY_RULES: RoutePolicyRule[] = [
  { prefix: "/super-admin", policy: "SUPER_ADMIN_ONLY" },
  { prefix: "/admin/eventos", policy: "ORGANIZER_AREA" },
  { prefix: "/admin/avisos", policy: "NOTICES_MANAGE" },
  { prefix: "/admin/fotos", policy: "MODERATOR_AREA" },
  { prefix: "/admin/patrocinadores", policy: "PARTNER_AREA" },
  { prefix: "/admin/atletas", policy: "MANAGER_AREA" },
  { prefix: "/admin/financeiro", policy: "FINANCE_AREA" },
  { prefix: "/admin/recompensas", policy: "MANAGER_AREA" },
  { prefix: "/admin/resgates", policy: "MANAGER_AREA" },
  { prefix: "/admin/pontos", policy: "MANAGER_AREA" },
  { prefix: "/admin", policy: "ADMIN_ONLY" },
  { prefix: "/coach", policy: "COACH_AREA" },
  { prefix: "/gestor", policy: "MANAGER_AREA" },
  { prefix: "/organizador", policy: "ORGANIZER_AREA" },
  { prefix: "/premium", policy: "PREMIUM_ATHLETE_AREA" },
  { prefix: "/suporte", policy: "SUPPORT_AREA" },
  { prefix: "/moderador", policy: "MODERATOR_AREA" },
  { prefix: "/parceiro", policy: "PARTNER_AREA" },
  { prefix: "/atletas", policy: "ADMIN_ONLY" },
  { prefix: "/provas", policy: "ATHLETE_AREA" },
  { prefix: "/minhas-inscricoes", policy: "ATHLETE_AREA" },
  { prefix: "/financeiro", policy: "ATHLETE_AREA" },
  { prefix: "/treinos", policy: "ATHLETE_AREA" },
  { prefix: "/calendario", policy: "ATHLETE_AREA" },
  { prefix: "/evolucao", policy: "ATHLETE_AREA" },
  { prefix: "/comunidade", policy: "ATHLETE_AREA" },
  { prefix: "/avisos", policy: "ATHLETE_AREA" },
  { prefix: "/fotos", policy: "ATHLETE_AREA" },
  { prefix: "/recompensas", policy: "ATHLETE_AREA" },
  { prefix: "/meus-resgates", policy: "ATHLETE_AREA" },
  { prefix: "/patrocinadores", policy: "ATHLETE_AREA" },
  { prefix: "/perfil", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/configuracoes", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/selecionar-perfil", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/dashboard", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/onboarding", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/", policy: "ATHLETE_AREA" },
];

export const API_ROUTE_POLICY_RULES: RoutePolicyRule[] = [
  { prefix: "/api/super-admin", policy: "SUPER_ADMIN_ONLY" },
  { prefix: "/api/admin/athletes", policy: "MANAGER_AREA" },
  { prefix: "/api/admin/race-plans", policy: "ORGANIZER_AREA" },
  { prefix: "/api/admin/invites", policy: "ADMIN_ONLY" },
  { prefix: "/api/admin/photos", policy: "MODERATOR_AREA" },
  { prefix: "/api/admin/sponsors", policy: "PARTNER_AREA" },
  { prefix: "/api/admin/sponsor-campaigns", policy: "PARTNER_AREA" },
  { prefix: "/api/admin/rewards", policy: "MANAGER_AREA" },
  { prefix: "/api/admin/redemptions", policy: "MANAGER_AREA" },
  { prefix: "/api/admin/points", policy: "MANAGER_AREA" },
  { prefix: "/api/admin", policy: "ADMIN_ONLY" },
  { prefix: "/api/finance", policy: "FINANCE_AREA" },
  { prefix: "/api/payments", policy: "FINANCE_AREA" },
  { prefix: "/api/organizer", policy: "ORGANIZER_AREA" },
  { prefix: "/api/manager", policy: "MANAGER_AREA" },
  { prefix: "/api/support", policy: "SUPPORT_AREA" },
  { prefix: "/api/moderation", policy: "MODERATOR_AREA" },
  { prefix: "/api/partner", policy: "PARTNER_AREA" },
  { prefix: "/api/invites", policy: "TENANT_AUTHENTICATED", methods: ["POST"] },
  { prefix: "/api/invites", policy: "ADMIN_ONLY" },
  { prefix: "/api/coach", policy: "COACH_AREA" },
  { prefix: "/api/notices", policy: "NOTICES_READ", methods: ["GET"] },
  { prefix: "/api/notices", policy: "NOTICES_MANAGE", methods: ["POST", "PATCH", "DELETE", "PUT"] },
  {
    prefix: "/api/notices/",
    policy: "NOTICES_MANAGE",
    methods: ["POST", "PATCH", "DELETE", "PUT"],
  },
  { prefix: "/api/organization", policy: "ADMIN_ONLY", methods: ["PATCH", "POST", "DELETE"] },
  { prefix: "/api/athletes", policy: "TENANT_STAFF" },
  { prefix: "/api/reports", policy: "ADMIN_ONLY" },
  { prefix: "/api/community", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/events", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/race-plans", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/rewards", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/photos", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/sponsors", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/points", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/registrations", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/api/me", policy: "TENANT_AUTHENTICATED" },
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getRoutePolicy(
  pathname: string,
  rules: readonly RoutePolicyRule[],
  method?: string,
): AccessPolicy | null {
  for (const rule of rules) {
    if (!pathMatchesPrefix(pathname, rule.prefix)) continue;
    if (rule.methods && method && !rule.methods.includes(method.toUpperCase())) continue;
    if (rule.methods && !method) continue;
    return rule.policy;
  }
  return null;
}
