import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { OrgPlan, OrgStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthContext, isSuperAdminRole } from "@/lib/request-auth";
import { createOrganizationBySuperAdminSchema } from "@/lib/validations/auth";
import { generateSlug } from "@/lib/auth";
import { getRequiredRuntimeEnv } from "@/lib/env";

function buildActivationLink(token: string): string {
  const appUrl = getRequiredRuntimeEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${appUrl}/activate-admin?token=${encodeURIComponent(token)}`;
}

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function mapPlan(plan: string | undefined): OrgPlan {
  if (plan === "STARTER" || plan === "PRO" || plan === "ENTERPRISE") return plan;
  return OrgPlan.FREE;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

  const organizations = await prisma.organization.findMany({
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      created_at: true,
      _count: { select: { users: true, admin_invites: true } },
    },
  });

  return NextResponse.json({
    data: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      status: org.status,
      createdAt: org.created_at,
      usersCount: org._count.users,
      adminInvitesCount: org._count.admin_invites,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createOrganizationBySuperAdminSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const { orgName, orgSlug, adminEmail, inviteExpiresInDays, plan } = parsed.data;
  const baseSlug = orgSlug ?? generateSlug(orgName);

  if (!baseSlug) {
    return apiError("VALIDATION_ERROR", "Nao foi possivel gerar slug valido para a assessoria.", 400);
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, organization_id: true },
  });
  if (existingByEmail) {
    return apiError(
      "VALIDATION_ERROR",
      "Ja existe um usuario com este email em outra conta. Use um email administrativo inedito.",
      409,
    );
  }

  const existingOrg = await prisma.organization.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });
  if (existingOrg) {
    return apiError("VALIDATION_ERROR", "Slug da assessoria ja esta em uso.", 409);
  }

  const token = generateInviteToken();
  const expirationDays = inviteExpiresInDays ?? 14;
  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1_000);

  const created = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: orgName,
        slug: baseSlug,
        plan: mapPlan(plan),
        status: OrgStatus.PENDING_SETUP,
        settings: {
          allowAthleteSelfSignup: false,
          requireAthleteApproval: true,
        },
      },
      select: { id: true, name: true, slug: true, plan: true, status: true, created_at: true },
    });

    const invite = await tx.adminActivationInvite.create({
      data: {
        organization_id: organization.id,
        email: adminEmail,
        token,
        role: "ADMIN",
        active: true,
        expires_at: expiresAt,
        invited_by: auth.userId,
      },
      select: {
        id: true,
        email: true,
        token: true,
        active: true,
        expires_at: true,
        created_at: true,
      },
    });

    return { organization, invite };
  });

  return NextResponse.json(
    {
      data: {
        organization: {
          id: created.organization.id,
          name: created.organization.name,
          slug: created.organization.slug,
          plan: created.organization.plan,
          status: created.organization.status,
          createdAt: created.organization.created_at,
        },
        adminInvite: {
          id: created.invite.id,
          email: created.invite.email,
          token: created.invite.token,
          active: created.invite.active,
          expiresAt: created.invite.expires_at,
          createdAt: created.invite.created_at,
          activationLink: buildActivationLink(created.invite.token),
        },
      },
    },
    { status: 201 },
  );
}
