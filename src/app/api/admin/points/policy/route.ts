import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  getOrganizationPointPolicy,
  mergePointPolicySettings,
  normalizePointPolicy,
} from "@/lib/points/policy";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const policySchema = z.object({
  pointValueCents: z.number().int().min(1).max(1000),
  expirationMonths: z.number().int().min(1).max(120),
  athletePolicyText: z.string().trim().min(20).max(1200),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Gestor.", 403);

  const policy = await getOrganizationPointPolicy(auth.organizationId);
  return NextResponse.json({ data: policy });
}

export async function PATCH(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Gestor.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = policySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const current = await prisma.organization.findUnique({
    where: { id: auth.organizationId },
    select: { settings: true },
  });

  if (!current) return apiError("USER_NOT_FOUND", "Organizacao nao encontrada.", 404);

  const updated = await prisma.organization.update({
    where: { id: auth.organizationId },
    data: {
      settings: mergePointPolicySettings(current.settings, parsed.data),
    },
    select: { settings: true },
  });

  return NextResponse.json({ data: normalizePointPolicy(updated.settings) });
}
