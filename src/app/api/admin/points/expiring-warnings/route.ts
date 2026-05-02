import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { notifyPointsExpiringSoon } from "@/lib/notifications/domain-events";
import { getExpiringWarnings } from "@/lib/points/expirationService";
import { prisma } from "@/lib/prisma";
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

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = querySchema.safeParse({
    daysAhead:
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as { daysAhead?: unknown }).daysAhead
        : undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const warnings = await getExpiringWarnings(auth.organizationId, parsed.data.daysAhead);
  const expirationDate = new Date();
  expirationDate.setUTCDate(expirationDate.getUTCDate() + parsed.data.daysAhead);

  for (const warning of warnings) {
    await notifyPointsExpiringSoon(prisma, {
      organizationId: auth.organizationId,
      userId: warning.userId,
      points: warning.pointsExpiring,
      expirationDate,
      daysAhead: parsed.data.daysAhead,
    });
  }

  return NextResponse.json({
    daysAhead: parsed.data.daysAhead,
    notified: warnings.length,
    data: warnings,
  });
}
