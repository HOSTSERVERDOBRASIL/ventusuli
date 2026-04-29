import { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";

const ROLE_VALUES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN", "FINANCE", "COACH", "ATHLETE"];

export interface AuthContext {
  userId: string;
  role: UserRole;
  roles: UserRole[];
  primaryRole: UserRole;
  organizationId: string;
  orgId: string;
}

export type AccessTokenPrecedence = "bearer-first" | "cookie-first";

function parseRole(raw: string | null): UserRole | null {
  if (!raw) return null;
  const role = raw.toUpperCase() as UserRole;
  return ROLE_VALUES.includes(role) ? role : null;
}

function parseRoles(raw: string | null, fallback: UserRole): UserRole[] {
  if (!raw) return [fallback];
  const roles = raw
    .split(",")
    .map((item) => parseRole(item.trim()))
    .filter((role): role is UserRole => Boolean(role));

  return roles.length ? roles : [fallback];
}

export function getAccessTokenFromRequest(
  req: NextRequest,
  precedence: AccessTokenPrecedence = "bearer-first",
): string | null {
  const authorization = req.headers.get("authorization");
  const headerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const cookieToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  return precedence === "cookie-first"
    ? (cookieToken ?? headerToken)
    : (headerToken ?? cookieToken);
}

export function getAuthContext(req: NextRequest): AuthContext | null {
  const userId = req.headers.get("x-user-id");
  const role = parseRole(req.headers.get("x-user-role"));
  const primaryRole = parseRole(req.headers.get("x-user-primary-role"));
  const organizationId = req.headers.get("x-org-id");

  if (!userId || !role || !organizationId) return null;
  const roles = parseRoles(req.headers.get("x-user-roles"), role);

  return {
    userId,
    role,
    roles,
    primaryRole: primaryRole ?? role,
    organizationId,
    orgId: organizationId,
  };
}

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN";
}

export function isFinanceRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "FINANCE";
}

export function isStaffRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "FINANCE" || role === "COACH";
}

export function isSuperAdminRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
