import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface RouteParams {
  params: { id: string };
}

function canManageAthletes(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const athlete = await prisma.user.findFirst({
    where: { id: params.id, organization_id: auth.organizationId, role: "ATHLETE" },
    select: { id: true, name: true, email: true },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta nao encontrado.", 404);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: athlete.id },
      data: { account_status: "SUSPENDED" },
    });

    await tx.athleteProfile.upsert({
      where: { user_id: athlete.id },
      update: {
        organization_id: auth.organizationId,
        athlete_status: "REJECTED",
      },
      create: {
        user_id: athlete.id,
        organization_id: auth.organizationId,
        athlete_status: "REJECTED",
      },
    });
  });

  return NextResponse.json({
    data: {
      id: athlete.id,
      name: athlete.name,
      email: athlete.email,
      athleteStatus: "REJECTED",
    },
  });
}
