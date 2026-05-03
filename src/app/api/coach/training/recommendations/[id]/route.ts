import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const updateSchema = z.object({
  status: z.enum(["APPLIED", "DISMISSED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!["COACH", "ADMIN", "MANAGER"].includes(auth.role)) {
    return apiError("FORBIDDEN", "Acesso restrito ao time técnico.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body inválido.", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Status inválido.", 400);

  const current = await prisma.aIRecommendation.findFirst({
    where: {
      id: params.id,
      organization_id: auth.organizationId,
    },
    select: { id: true },
  });
  if (!current) return apiError("USER_NOT_FOUND", "Recomendação não encontrada.", 404);

  const updated = await prisma.aIRecommendation.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status,
      reviewer_id: auth.userId,
      reviewed_at: new Date(),
    },
    select: {
      id: true,
      recommendation_type: true,
      summary: true,
      status: true,
      reviewed_at: true,
    },
  });

  return NextResponse.json({ data: updated });
}
