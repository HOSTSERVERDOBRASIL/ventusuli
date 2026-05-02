import { NextRequest, NextResponse } from "next/server";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { normalizeRoles } from "@/lib/access-profiles";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";
import { UserRole } from "@/types";

const assignProfilesSchema = z.object({
  roles: z.array(z.nativeEnum(PrismaUserRole)).max(10).default([]),
});

const ALL_ASSIGNABLE_ROLES = [
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
] as const;

type RoleLike = UserRole | PrismaUserRole | string;

interface RouteParams {
  params: { id: string };
}

function canManageAccessProfiles(roles: readonly RoleLike[]): boolean {
  return roles.some((role) => role === UserRole.ADMIN || role === UserRole.MANAGER);
}

function canAssignRole(authRoles: readonly RoleLike[], role: UserRole): boolean {
  if (role === UserRole.SUPER_ADMIN) return authRoles.some((authRole) => authRole === UserRole.SUPER_ADMIN);
  return true;
}

function getAssignableRoles(authRoles: readonly RoleLike[]): UserRole[] {
  return authRoles.some((role) => role === UserRole.SUPER_ADMIN)
    ? [UserRole.SUPER_ADMIN, ...ALL_ASSIGNABLE_ROLES]
    : [...ALL_ASSIGNABLE_ROLES];
}

function hasConflictingAthleteRoles(roles: readonly UserRole[]): boolean {
  return roles.includes(UserRole.ATHLETE) && roles.includes(UserRole.PREMIUM_ATHLETE);
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAccessProfiles(auth.roles)) {
    return apiError("FORBIDDEN", "Acesso restrito ao time administrativo.", 403);
  }

  const user = await prisma.user.findFirst({
    where: { id: params.id, organization_id: auth.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      athlete_profile: { select: { id: true } },
      access_profiles: {
        orderBy: { created_at: "asc" },
        select: { id: true, role: true, active: true, created_at: true, updated_at: true },
      },
    },
  });

  if (!user) return apiError("USER_NOT_FOUND", "Usuario nao encontrado.", 404);
  const activeAccessRoles = user.access_profiles
    .filter((profile) => profile.active)
    .map((profile) => String(profile.role));
  const hasPremiumAthlete =
    user.role === PrismaUserRole.PREMIUM_ATHLETE || activeAccessRoles.includes(UserRole.PREMIUM_ATHLETE);

  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        primaryRole: user.role,
      },
      roles: normalizeRoles([
        user.role,
        ...activeAccessRoles,
        user.athlete_profile && !hasPremiumAthlete ? UserRole.ATHLETE : null,
      ]),
      assignableRoles: getAssignableRoles(auth.roles),
      accessProfiles: user.access_profiles,
    },
  });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAccessProfiles(auth.roles)) {
    return apiError("FORBIDDEN", "Acesso restrito ao time administrativo.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = assignProfilesSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const user = await prisma.user.findFirst({
    where: { id: params.id, organization_id: auth.organizationId },
    select: { id: true, role: true },
  });

  if (!user) return apiError("USER_NOT_FOUND", "Usuario nao encontrado.", 404);

  const requestedRoles = normalizeRoles(parsed.data.roles.map(String));
  if (hasConflictingAthleteRoles(requestedRoles)) {
    return apiError(
      "VALIDATION_ERROR",
      "Escolha apenas um perfil de atleta: ATHLETE ou PREMIUM_ATHLETE.",
      400,
    );
  }

  if (requestedRoles.some((role) => !canAssignRole(auth.roles, role))) {
    return apiError("FORBIDDEN", "Somente super admin pode conceder perfil de plataforma.", 403);
  }

  if (
    user.role === PrismaUserRole.ATHLETE &&
    requestedRoles.includes(UserRole.PREMIUM_ATHLETE)
  ) {
    return apiError(
      "VALIDATION_ERROR",
      "Este usuario ja tem ATHLETE como perfil principal. Altere o perfil principal antes de usar PREMIUM_ATHLETE.",
      400,
    );
  }

  if (
    user.role === PrismaUserRole.PREMIUM_ATHLETE &&
    requestedRoles.includes(UserRole.ATHLETE)
  ) {
    return apiError(
      "VALIDATION_ERROR",
      "Este usuario ja tem PREMIUM_ATHLETE como perfil principal. Altere o perfil principal antes de usar ATHLETE.",
      400,
    );
  }

  const extraRoles = requestedRoles.filter((role) => role !== String(user.role));

  await prisma.$transaction(async (tx) => {
    await tx.userAccessProfile.updateMany({
      where: {
        user_id: user.id,
        role: { notIn: extraRoles as PrismaUserRole[] },
      },
      data: { active: false },
    });

    for (const role of extraRoles) {
      await tx.userAccessProfile.upsert({
        where: {
          user_id_role: {
            user_id: user.id,
            role: role as PrismaUserRole,
          },
        },
        create: {
          user_id: user.id,
          organization_id: auth.organizationId,
          role: role as PrismaUserRole,
          active: true,
          assigned_by: auth.userId,
        },
        update: {
          active: true,
          assigned_by: auth.userId,
        },
      });
    }
  });

  const profiles = await prisma.userAccessProfile.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "asc" },
    select: { id: true, role: true, active: true, created_at: true, updated_at: true },
  });

  return NextResponse.json({
    data: {
      userId: user.id,
      primaryRole: user.role,
      roles: normalizeRoles([
        String(user.role),
        ...profiles.filter((profile) => profile.active).map((profile) => String(profile.role)),
      ]),
      assignableRoles: getAssignableRoles(auth.roles),
      accessProfiles: profiles,
    },
  });
}
