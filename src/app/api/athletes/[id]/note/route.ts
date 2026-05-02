import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const noteSchema = z.object({
  note: z.string().trim().max(1200),
});

function canManageAthletes(role: UserRole): boolean {
  const value = String(role);
  return value === "ADMIN" || value === "MANAGER";
}

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const athlete = await prisma.user.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
      role: UserRole.ATHLETE,
    },
    select: { id: true },
  });

  if (!athlete) return apiError("USER_NOT_FOUND", "Atleta não encontrado.", 404);

  const profile = await prisma.athleteProfile.findUnique({ where: { user_id: params.id } });

  const previousEmergency =
    profile?.emergency_contact &&
    typeof profile.emergency_contact === "object" &&
    !Array.isArray(profile.emergency_contact)
      ? (profile.emergency_contact as Record<string, unknown>)
      : {};

  const mergedEmergency = {
    ...previousEmergency,
    internal_note: parsed.data.note,
  };

  await prisma.athleteProfile.upsert({
    where: { user_id: params.id },
    update: {
      emergency_contact: mergedEmergency,
    },
    create: {
      user_id: params.id,
      organization_id: auth.organizationId,
      emergency_contact: mergedEmergency,
    },
  });

  return NextResponse.json({ data: { athleteId: params.id, note: parsed.data.note } });
}
