import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiException } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";

const createInviteSchema = z.object({
  label: z.string().trim().max(80).optional(),
  invitedEmail: z.string().trim().email("E-mail do convidado invalido.").optional(),
  invitedName: z.string().trim().min(2).max(120).optional(),
  max_uses: z.number().int().min(1).max(10000).nullable().optional(),
  expires_at: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Data de expiracao invalida.",
    })
    .nullable()
    .optional(),
});

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function canCreateInvite(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.ATHLETE;
}

interface InviteRow {
  id: string;
  token: string;
  label: string | null;
  active: boolean;
  expires_at: Date | null;
  max_uses: number | null;
  used_count: number;
  invite_kind: string;
  invited_email: string | null;
  invited_name: string | null;
  created_by: string | null;
  accepted_user_id: string | null;
  accepted_at: Date | null;
  created_at: Date;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toInviteOutput(invite: InviteRow) {
  return {
    id: invite.id,
    token: invite.token,
    label: invite.label,
    active: invite.active,
    expires_at: invite.expires_at,
    max_uses: invite.max_uses,
    used_count: invite.used_count,
    invite_kind: invite.invite_kind,
    invited_email: invite.invited_email,
    invited_name: invite.invited_name,
    created_by: invite.created_by,
    accepted_user_id: invite.accepted_user_id,
    accepted_at: invite.accepted_at,
    created_at: invite.created_at,
    signupUrl: `/register/atleta?inviteToken=${invite.token}`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
    if (!canCreateInvite(auth.role)) {
      return apiError("FORBIDDEN", "Apenas administradores e atletas podem criar convites.", 403);
    }

    const invites =
      auth.role === UserRole.ATHLETE
        ? await prisma.$queryRaw<InviteRow[]>`
            SELECT
              id,
              token,
              label,
              active,
              expires_at,
              max_uses,
              used_count,
              invite_kind,
              invited_email,
              invited_name,
              created_by,
              accepted_user_id,
              accepted_at,
              created_at
            FROM public.organization_invites
            WHERE organization_id = ${auth.organizationId}
              AND created_by = ${auth.userId}
            ORDER BY created_at DESC
          `
        : await prisma.$queryRaw<InviteRow[]>`
            SELECT
              id,
              token,
              label,
              active,
              expires_at,
              max_uses,
              used_count,
              invite_kind,
              invited_email,
              invited_name,
              created_by,
              accepted_user_id,
              accepted_at,
              created_at
            FROM public.organization_invites
            WHERE organization_id = ${auth.organizationId}
            ORDER BY created_at DESC
          `;

    return NextResponse.json({ data: invites.map(toInviteOutput) });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel carregar convites.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
    if (!canCreateInvite(auth.role)) {
      return apiError("FORBIDDEN", "Apenas administradores e atletas podem criar convites.", 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
    }

    const { label, invitedEmail, invitedName, max_uses, expires_at } = parsed.data;
    const isAthleteInvite = auth.role === UserRole.ATHLETE;

    if (isAthleteInvite && !invitedEmail) {
      return apiError("VALIDATION_ERROR", "Informe o e-mail do amigo convidado.", 400);
    }

    const inviteKind = isAthleteInvite ? "ATHLETE_REFERRAL" : invitedEmail ? "INDIVIDUAL" : "GENERAL";
    const maxUses = isAthleteInvite || invitedEmail ? 1 : (max_uses ?? null);
    const normalizedEmail = invitedEmail ? normalizeEmail(invitedEmail) : null;
    const inviteLabel =
      label ??
      (invitedName
        ? `Convite para ${invitedName}`
        : normalizedEmail
          ? `Convite para ${normalizedEmail}`
          : null);

    const rows = await prisma.$queryRaw<InviteRow[]>`
      INSERT INTO public.organization_invites (
        id,
        organization_id,
        token,
        label,
        active,
        expires_at,
        max_uses,
        used_count,
        invite_kind,
        invited_email,
        invited_name,
        created_by,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${auth.organizationId},
        ${generateInviteToken()},
        ${inviteLabel},
        true,
        ${expires_at ? new Date(expires_at) : null},
        ${maxUses},
        0,
        ${inviteKind},
        ${normalizedEmail},
        ${invitedName ?? null},
        ${auth.userId},
        NOW()
      )
      RETURNING
        id,
        token,
        label,
        active,
        expires_at,
        max_uses,
        used_count,
        invite_kind,
        invited_email,
        invited_name,
        created_by,
        accepted_user_id,
        accepted_at,
        created_at
    `;

    return NextResponse.json({ data: toInviteOutput(rows[0]) }, { status: 201 });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel criar convite.");
  }
}
