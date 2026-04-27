import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isSuperAdminRole } from "@/lib/request-auth";
import { getRequiredRuntimeEnv } from "@/lib/env";

const createInviteSchema = z.object({
  organizationId: z.string().uuid("organizationId invalido"),
  email: z.string().trim().email("Email invalido").toLowerCase(),
  role: z.enum(["ADMIN", "FINANCE", "COACH"]).default("ADMIN"),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function buildActivationLink(token: string): string {
  const appUrl = getRequiredRuntimeEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `${appUrl}/activate-admin?token=${encodeURIComponent(token)}`;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

  const organizationId = req.nextUrl.searchParams.get("organizationId")?.trim();

  const invites = await prisma.adminActivationInvite.findMany({
    where: organizationId ? { organization_id: organizationId } : undefined,
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      organization_id: true,
      email: true,
      role: true,
      active: true,
      expires_at: true,
      accepted_at: true,
      created_at: true,
      token: true,
      organization: {
        select: { id: true, name: true, slug: true, plan: true, status: true },
      },
    },
  });

  return NextResponse.json({
    data: invites.map((invite) => ({
      id: invite.id,
      organizationId: invite.organization_id,
      email: invite.email,
      role: invite.role,
      active: invite.active,
      expiresAt: invite.expires_at,
      acceptedAt: invite.accepted_at,
      createdAt: invite.created_at,
      token: invite.token,
      activationLink: buildActivationLink(invite.token),
      organization: invite.organization,
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

  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const organization = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { id: true, name: true, slug: true, plan: true, status: true },
  });
  if (!organization) {
    return apiError("ORG_NOT_FOUND", "Assessoria nao encontrada.", 404);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, organization_id: true },
  });
  if (existingUser) {
    return apiError("VALIDATION_ERROR", "Email ja esta em uso por um usuario existente.", 409);
  }

  const activeInvite = await prisma.adminActivationInvite.findFirst({
    where: {
      organization_id: parsed.data.organizationId,
      email: parsed.data.email,
      active: true,
      accepted_at: null,
    },
    select: { id: true },
  });
  if (activeInvite) {
    return apiError("VALIDATION_ERROR", "Ja existe convite ativo para este email nesta assessoria.", 409);
  }

  const expiresInDays = parsed.data.expiresInDays ?? 14;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1_000);
  const role = parsed.data.role as UserRole;
  const token = generateInviteToken();

  const invite = await prisma.adminActivationInvite.create({
    data: {
      organization_id: parsed.data.organizationId,
      email: parsed.data.email,
      role,
      token,
      active: true,
      expires_at: expiresAt,
      invited_by: auth.userId,
    },
    select: {
      id: true,
      organization_id: true,
      email: true,
      role: true,
      active: true,
      expires_at: true,
      accepted_at: true,
      created_at: true,
      token: true,
      organization: {
        select: { id: true, name: true, slug: true, plan: true, status: true },
      },
    },
  });

  return NextResponse.json(
    {
      data: {
        id: invite.id,
        organizationId: invite.organization_id,
        email: invite.email,
        role: invite.role,
        active: invite.active,
        expiresAt: invite.expires_at,
        acceptedAt: invite.accepted_at,
        createdAt: invite.created_at,
        token: invite.token,
        activationLink: buildActivationLink(invite.token),
        organization: invite.organization,
      },
    },
    { status: 201 },
  );
}
