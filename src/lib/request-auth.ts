import { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";

const ROLE_VALUES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN", "COACH", "ATHLETE"];

export interface AuthContext {
  userId: string;
  role: UserRole;
  organizationId: string;
}

export type AccessTokenPrecedence = "bearer-first" | "cookie-first";

function parseRole(raw: string | null): UserRole | null {
  if (!raw) return null;
  const role = raw.toUpperCase() as UserRole;
  return ROLE_VALUES.includes(role) ? role : null;
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
  const organizationId = req.headers.get("x-org-id");

  if (!userId || !role || !organizationId) return null;

  return {
    userId,
    role,
    organizationId,
  };
}

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN";
}

export function isStaffRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "COACH";
}

export function isSuperAdminRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
