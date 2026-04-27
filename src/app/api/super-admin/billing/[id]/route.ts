import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isSuperAdminRole } from "@/lib/request-auth";

const patchSchema = z.object({
  action: z.enum(["MARK_PAID", "CANCEL", "REOPEN"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

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

  const data =
    parsed.data.action === "MARK_PAID"
      ? { status: "PAID", paid_at: new Date() }
      : parsed.data.action === "CANCEL"
        ? { status: "CANCELLED", paid_at: null }
        : { status: "OPEN", paid_at: null };

  const updated = await prisma.platformBillingInvoice.update({
    where: { id: params.id },
    data,
    select: { id: true, status: true, paid_at: true },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      status: updated.status,
      paidAt: updated.paid_at?.toISOString() ?? null,
    },
  });
}
