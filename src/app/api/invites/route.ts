import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const createInviteSchema = z.object({
  label: z.string().trim().max(80).optional(),
  max_uses: z.number().int().min(1).max(10000).nullable().optional(),
  expires_at: z
    .string()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), { message: "Data de expiração inválida." })
    .nullable()
    .optional(),
});

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao administrador.", 403);

  const invites = await prisma.organizationInvite.findMany({
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
  });

  return NextResponse.json({ data: invites });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao administrador.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados inválidos.", 400);
  }

  const { label, max_uses, expires_at } = parsed.data;

  const invite = await prisma.organizationInvite.create({
    data: {
      organization_id: auth.organizationId,
      token: generateInviteToken(),
      label: label ?? null,
      active: true,
      max_uses: max_uses ?? null,
      expires_at: expires_at ? new Date(expires_at) : null,
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

  return NextResponse.json({ data: invite }, { status: 201 });
}
