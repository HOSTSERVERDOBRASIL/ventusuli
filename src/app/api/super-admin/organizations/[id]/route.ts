import { NextRequest, NextResponse } from "next/server";
import { OrgPlan, OrgStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthContext, isSuperAdminRole } from "@/lib/request-auth";
import { updateOrganizationBySuperAdminSchema } from "@/lib/validations/auth";

function mapPlan(plan: string | undefined): OrgPlan | undefined {
  if (!plan) return undefined;
  if (plan === "FREE" || plan === "STARTER" || plan === "PRO" || plan === "ENTERPRISE") {
    return plan;
  }
  return undefined;
}

function mapStatus(status: string | undefined): OrgStatus | undefined {
  if (!status) return undefined;
  if (
    status === "PENDING_SETUP" ||
    status === "ACTIVE" ||
    status === "SUSPENDED" ||
    status === "TRIAL" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return undefined;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

  const organizationId = params.id?.trim();
  if (!organizationId) {
    return apiError("VALIDATION_ERROR", "ID da assessoria e obrigatorio.", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = updateOrganizationBySuperAdminSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const plan = mapPlan(parsed.data.plan);
  const status = mapStatus(parsed.data.status);

  if (!plan && !status) {
    return apiError("VALIDATION_ERROR", "Informe ao menos um campo: plan ou status.", 400);
  }

  const existing = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!existing) {
    return apiError("ORG_NOT_FOUND", "Assessoria nao encontrada.", 404);
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(plan ? { plan } : {}),
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      created_at: true,
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: updated.plan,
      status: updated.status,
      createdAt: updated.created_at,
    },
  });
}
