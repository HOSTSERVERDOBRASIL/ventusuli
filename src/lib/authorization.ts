import { UserRole } from "@/types";

export const ROLE_GROUPS = {
  platform: [UserRole.SUPER_ADMIN] as const,
  platformAdmin: [UserRole.SUPER_ADMIN] as const,
  tenant: [UserRole.ADMIN, UserRole.FINANCE, UserRole.COACH, UserRole.ATHLETE] as const,
  tenantAdmin: [UserRole.ADMIN] as const,
  tenantFinance: [UserRole.ADMIN, UserRole.FINANCE] as const,
  tenantStaff: [UserRole.ADMIN, UserRole.COACH] as const,
  coach: [UserRole.COACH] as const,
  athlete: [UserRole.ATHLETE] as const,
  noticesRead: [UserRole.ADMIN, UserRole.COACH, UserRole.ATHLETE] as const,
  noticesManage: [UserRole.ADMIN] as const,
} as const;

export type AccessPolicy =
  | "TENANT_AUTHENTICATED"
  | "SUPER_ADMIN_ONLY"
  | "ADMIN_ONLY"
  | "FINANCE_AREA"
  | "TENANT_STAFF"
  | "COACH_AREA"
  | "ATHLETE_AREA"
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
  NOTICES_READ: ROLE_GROUPS.noticesRead,
  NOTICES_MANAGE: ROLE_GROUPS.noticesManage,
};

export function canAccessPolicy(role: UserRole | null | undefined, policy: AccessPolicy): boolean {
  if (!role) return false;
  return POLICY_ROLES[policy].includes(role);
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
  { prefix: "/", policy: "ATHLETE_AREA" },
  { prefix: "/super-admin", policy: "SUPER_ADMIN_ONLY" },
  { prefix: "/admin/atletas", policy: "ADMIN_ONLY" },
  { prefix: "/admin/financeiro", policy: "FINANCE_AREA" },
  { prefix: "/admin", policy: "ADMIN_ONLY" },
  { prefix: "/coach", policy: "COACH_AREA" },
  { prefix: "/atletas", policy: "ADMIN_ONLY" },
  { prefix: "/provas", policy: "ATHLETE_AREA" },
  { prefix: "/minhas-inscricoes", policy: "ATHLETE_AREA" },
  { prefix: "/financeiro", policy: "ATHLETE_AREA" },
  { prefix: "/treinos", policy: "ATHLETE_AREA" },
  { prefix: "/calendario", policy: "ATHLETE_AREA" },
  { prefix: "/evolucao", policy: "ATHLETE_AREA" },
  { prefix: "/comunidade", policy: "ATHLETE_AREA" },
  { prefix: "/avisos", policy: "ATHLETE_AREA" },
  { prefix: "/recompensas", policy: "ATHLETE_AREA" },
  { prefix: "/meus-resgates", policy: "ATHLETE_AREA" },
  { prefix: "/perfil", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/configuracoes", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/dashboard", policy: "TENANT_AUTHENTICATED" },
  { prefix: "/onboarding", policy: "TENANT_AUTHENTICATED" },
];

export const API_ROUTE_POLICY_RULES: RoutePolicyRule[] = [
  { prefix: "/api/super-admin", policy: "SUPER_ADMIN_ONLY" },
  { prefix: "/api/admin/athletes", policy: "ADMIN_ONLY" },
  { prefix: "/api/admin/invites", policy: "ADMIN_ONLY" },
  { prefix: "/api/admin", policy: "ADMIN_ONLY" },
  { prefix: "/api/finance", policy: "FINANCE_AREA" },
  { prefix: "/api/payments", policy: "FINANCE_AREA" },
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
  { prefix: "/api/rewards", policy: "TENANT_AUTHENTICATED" },
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
