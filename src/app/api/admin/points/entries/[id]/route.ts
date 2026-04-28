import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  reviewPointActivityEntry,
  updatePendingPointActivityEntry,
} from "@/lib/points/activityService";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const patchSchema = z.object({
  action: z.enum(["UPDATE", "APPROVE", "REJECT"]),
  points: z.number().int().positive().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  proofUrl: z.string().trim().url().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  if (parsed.data.action === "UPDATE") {
    const data = await updatePendingPointActivityEntry({
      organizationId: auth.organizationId,
      entryId: params.id,
      points: parsed.data.points,
      note: parsed.data.note ?? null,
      proofUrl: parsed.data.proofUrl ?? null,
    });

    if (!data) {
      return apiError("USER_NOT_FOUND", "Lancamento pendente nao encontrado.", 404);
    }

    return NextResponse.json({ data });
  }

  const data = await reviewPointActivityEntry({
    organizationId: auth.organizationId,
    entryId: params.id,
    action: parsed.data.action === "APPROVE" ? "APPROVE" : "REJECT",
    adminId: auth.userId,
    note: parsed.data.note ?? null,
    points: parsed.data.points,
  });

  if (!data) {
    return apiError("USER_NOT_FOUND", "Lancamento nao encontrado.", 404);
  }

  return NextResponse.json({ data });
}
