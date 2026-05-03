import { NextRequest, NextResponse } from "next/server";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { apiError } from "@/lib/api-error";
import { normalizeRoles } from "@/lib/access-profiles";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";
import { CANONICAL_ASSIGNABLE_ROLES } from "@/lib/product-profiles";
import { UserRole } from "@/types";

function canManageAccessProfiles(roles: readonly string[]): boolean {
  return roles.includes(UserRole.ADMIN);
}

function getAssignableRoles(authRoles: readonly string[]): UserRole[] {
  return authRoles.includes(UserRole.SUPER_ADMIN)
    ? [UserRole.SUPER_ADMIN, ...CANONICAL_ASSIGNABLE_ROLES]
    : [...CANONICAL_ASSIGNABLE_ROLES];
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const authRoles = auth.roles.map(String);
  if (!canManageAccessProfiles(authRoles)) {
    return apiError("FORBIDDEN", "Acesso restrito ao time administrativo.", 403);
  }

  const users = await prisma.user.findMany({
    where: {
      organization_id: auth.organizationId,
      account_status: { not: "SUSPENDED" },
      OR: [
        { role: { not: PrismaUserRole.ATHLETE } },
        { athlete_profile: { isNot: null } },
        { access_profiles: { some: { active: true } } },
      ],
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      account_status: true,
      athlete_profile: { select: { id: true } },
      access_profiles: {
        orderBy: { created_at: "asc" },
        select: { role: true, active: true },
      },
    },
  });

  return NextResponse.json({
    data: users.map((user) => {
      const accessRoles = user.access_profiles
        .filter((profile) => profile.active)
        .map((profile) => String(profile.role));
      const hasPremiumAthlete =
        user.role === PrismaUserRole.PREMIUM_ATHLETE || accessRoles.includes(UserRole.PREMIUM_ATHLETE);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.account_status,
        primaryRole: user.role,
        roles: normalizeRoles([
          String(user.role),
          ...accessRoles,
          user.athlete_profile && !hasPremiumAthlete ? UserRole.ATHLETE : null,
        ]),
      };
    }),
    assignableRoles: getAssignableRoles(authRoles),
  });
}
