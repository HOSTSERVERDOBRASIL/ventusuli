import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { getExpiringWarnings } from "@/lib/points/expirationService";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const querySchema = z.object({
  daysAhead: z.coerce.number().int().min(1).max(365).default(30),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    daysAhead: req.nextUrl.searchParams.get("daysAhead") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const data = await getExpiringWarnings(auth.organizationId, parsed.data.daysAhead);
  return NextResponse.json({ data, daysAhead: parsed.data.daysAhead });
}
