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
    created_at: Date;
  },
  origin: string,
) {
  const expired = invite.expires_at ? invite.expires_at.getTime() < Date.now() : false;
  const availableUses = invite.max_uses === null ? null : Math.max(0, invite.max_uses - invite.used_count);
  return {
    id: invite.id,
    token: invite.token,
    label: invite.label,
    active: invite.active,
    expiresAt: invite.expires_at,
    expired,
    maxUses: invite.max_uses,
    usedCount: invite.used_count,
    availableUses,
    reusable: invite.max_uses === null,
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

  return NextResponse.json({
    data: invites.map((invite) => toInviteOutput(invite, req.nextUrl.origin)),
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
    },
    select: {
      id: true,
      token: true,
      label: true,
      active: true,
      expires_at: true,
      max_uses: true,
      used_count: true,
      created_at: true,
    },
  });

  return NextResponse.json({ data: toInviteOutput(invite, req.nextUrl.origin) }, { status: 201 });
}

