import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { processBirthdayBonus } from "@/lib/points/birthdayBonus";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const bodySchema = z.object({
  date: z.string().datetime().optional(),
});

function hasValidCronSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 && token === cronSecret;
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  const cronAuthorized = hasValidCronSecret(req);

  let organizationIds: string[];
  if (cronAuthorized) {
    organizationIds = (await prisma.organization.findMany({ select: { id: true } })).map(
      (item) => item.id,
    );
  } else {
    if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
    if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);
    organizationIds = [auth.organizationId];
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const date = parsed.data.date ? new Date(parsed.data.date) : new Date();
  const perOrganization: Array<{ organizationId: string; credited: number; skipped: number }> = [];
  let credited = 0;
  let skipped = 0;

  for (const organizationId of organizationIds) {
    const result = await processBirthdayBonus(organizationId, date);
    perOrganization.push({ organizationId, ...result });
    credited += result.credited;
    skipped += result.skipped;
  }

  return NextResponse.json({
    date: date.toISOString(),
    credited,
    skipped,
    perOrganization,
  });
}
