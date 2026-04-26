import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const user = await prisma.user.findFirst({
    where: {
      id: auth.userId,
      organization_id: auth.organizationId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatar_url: true,
      role: true,
      account_status: true,
      organization_id: true,
      athlete_profile: {
        select: {
          athlete_status: true,
          signup_source: true,
          onboarding_completed_at: true,
          member_number: true,
          member_since: true,
          cpf: true,
          phone: true,
          city: true,
          state: true,
          birth_date: true,
          gender: true,
          emergency_contact: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          logo_url: true,
          settings: true,
        },
      },
    },
  });

  if (!user) {
    return apiError("USER_NOT_FOUND", "Usuário não encontrado.", 404);
  }

  return NextResponse.json({ data: user });
}
