import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isStaffRole } from "@/lib/request-auth";

const createInviteSchema = z
  .object({
    label: z.string().trim().max(80).optional(),
    reusable: z.boolean().default(false),
    maxUses: z.number().int().min(1).max(10000).optional(),
    expiresAt: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: "Data de expiracao invalida." })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.reusable && value.maxUses === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe maxUses quando reusable=false.",
        path: ["maxUses"],
      });
    }
  });

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function readBooleanSetting(settings: unknown, key: string, fallback: boolean): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return fallback;
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : fallback;
}

function toInviteOutput(
  invite: {
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
  },
  origin: string,
  actors?: {
    createdByName?: string | null;
    createdByEmail?: string | null;
    acceptedUserName?: string | null;
    acceptedUserEmail?: string | null;
    acceptedUserMemberNumber?: string | null;
  },
) {
  const expired = invite.expires_at ? invite.expires_at.getTime() < Date.now() : false;
  const availableUses = invite.max_uses === null ? null : Math.max(0, invite.max_uses - invite.used_count);
  const exhausted = availableUses !== null && availableUses <= 0;
  const status = !invite.active ? "INACTIVE" : expired ? "EXPIRED" : exhausted ? "EXHAUSTED" : "AVAILABLE";

  return {
    id: invite.id,
    token: invite.token,
    label: invite.label,
    active: invite.active,
    expiresAt: invite.expires_at,
    expired,
    status,
    maxUses: invite.max_uses,
    usedCount: invite.used_count,
    availableUses,
    reusable: invite.max_uses === null,
    inviteKind: invite.invite_kind,
    invitedEmail: invite.invited_email,
    invitedName: invite.invited_name,
    createdBy: invite.created_by
      ? {
          id: invite.created_by,
          name: actors?.createdByName ?? null,
          email: actors?.createdByEmail ?? null,
        }
      : null,
    acceptedUser: invite.accepted_user_id
      ? {
          id: invite.accepted_user_id,
          name: actors?.acceptedUserName ?? null,
          email: actors?.acceptedUserEmail ?? null,
          memberNumber: actors?.acceptedUserMemberNumber ?? null,
        }
      : null,
    acceptedAt: invite.accepted_at,
    createdAt: invite.created_at,
    signupUrl: `${origin}/register/atleta?inviteToken=${invite.token}`,
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isStaffRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao time administrativo.", 403);

  const [invites, organization] = await Promise.all([
    prisma.organizationInvite.findMany({
      where: { organization_id: auth.organizationId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        token: true,
        label: true,
        active: true,
        expires_at: true,
        max_uses: true,
        used_count: true,
        invite_kind: true,
        invited_email: true,
        invited_name: true,
        created_by: true,
        accepted_user_id: true,
        accepted_at: true,
        created_at: true,
      },
    }),
    prisma.organization.findUnique({
      where: { id: auth.organizationId },
      select: {
        slug: true,
        settings: true,
      },
    }),
  ]);

  const userIds = Array.from(
    new Set(
      invites
        .flatMap((invite) => [invite.created_by, invite.accepted_user_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, organization_id: auth.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          athlete_profile: { select: { member_number: true } },
        },
      })
    : [];

  const userById = new Map(users.map((user) => [user.id, user]));
  const inviteOutputs = invites.map((invite) => {
    const createdBy = invite.created_by ? userById.get(invite.created_by) : null;
    const acceptedUser = invite.accepted_user_id ? userById.get(invite.accepted_user_id) : null;
    return toInviteOutput(invite, req.nextUrl.origin, {
      createdByName: createdBy?.name ?? null,
      createdByEmail: createdBy?.email ?? null,
      acceptedUserName: acceptedUser?.name ?? null,
      acceptedUserEmail: acceptedUser?.email ?? null,
      acceptedUserMemberNumber: acceptedUser?.athlete_profile?.member_number ?? null,
    });
  });

  return NextResponse.json({
    data: inviteOutputs,
    summary: {
      total: inviteOutputs.length,
      available: inviteOutputs.filter((invite) => invite.status === "AVAILABLE").length,
      used: inviteOutputs.filter((invite) => invite.acceptedUser).length,
      expired: inviteOutputs.filter((invite) => invite.status === "EXPIRED").length,
      athleteReferral: inviteOutputs.filter((invite) => invite.inviteKind === "ATHLETE_REFERRAL").length,
      adminGeneral: inviteOutputs.filter((invite) => invite.inviteKind !== "ATHLETE_REFERRAL").length,
    },
    policy: {
      slug: organization?.slug ?? "",
      allowAthleteSelfSignup: readBooleanSetting(organization?.settings, "allowAthleteSelfSignup", false),
      requireAthleteApproval: readBooleanSetting(organization?.settings, "requireAthleteApproval", true),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isStaffRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao time administrativo.", 403);

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

  const invite = await prisma.organizationInvite.create({
    data: {
      organization_id: auth.organizationId,
      token: generateInviteToken(),
      label: parsed.data.label ?? null,
      active: true,
      max_uses: parsed.data.reusable ? null : (parsed.data.maxUses ?? 1),
      expires_at: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      invite_kind: "GENERAL",
      created_by: auth.userId,
    },
    select: {
      id: true,
      token: true,
      label: true,
      active: true,
      expires_at: true,
      max_uses: true,
      used_count: true,
      invite_kind: true,
      invited_email: true,
      invited_name: true,
      created_by: true,
      accepted_user_id: true,
      accepted_at: true,
      created_at: true,
    },
  });

  return NextResponse.json({ data: toInviteOutput(invite, req.nextUrl.origin) }, { status: 201 });
}
