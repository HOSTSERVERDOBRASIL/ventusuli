import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { ensureAthleteMemberNumber } from "@/lib/athletes/member-number";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const payloadSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "BLOCK"]),
});

function canManageAthletes(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

interface RouteParams {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) {
    return apiError("FORBIDDEN", "Somente time administrativo pode gerenciar atletas.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const athlete = await prisma.user.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      role: "ATHLETE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      athlete_profile: { select: { athlete_status: true } },
    },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta nao encontrado.", 404);

  const action = parsed.data.action;

  const nextAccountStatus = action === "APPROVE" ? "ACTIVE" : "SUSPENDED";
  const nextAthleteStatus =
    action === "APPROVE" ? "ACTIVE" : action === "REJECT" ? "REJECTED" : "BLOCKED";

  if (athlete.athlete_profile?.athlete_status === nextAthleteStatus) {
    return apiError("VALIDATION_ERROR", "Atleta ja esta neste status.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: athlete.id },
      data: { account_status: nextAccountStatus },
    });

    await tx.athleteProfile.upsert({
      where: { user_id: athlete.id },
      update: {
        organization_id: auth.organizationId,
        athlete_status: nextAthleteStatus,
      },
      create: {
        user_id: athlete.id,
        organization_id: auth.organizationId,
        athlete_status: nextAthleteStatus,
      },
    });

    if (action === "APPROVE") {
      await ensureAthleteMemberNumber(tx, {
        organizationId: auth.organizationId,
        userId: athlete.id,
      });
    }
  });

  return NextResponse.json({
    data: {
      id: athlete.id,
      name: athlete.name,
      email: athlete.email,
      athleteStatus: nextAthleteStatus,
    },
  });
}
