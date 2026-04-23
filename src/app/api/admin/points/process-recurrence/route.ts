import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { processMonthlyBonus, processQuarterlyBonus } from "@/lib/points/recurrenceBonus";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const bodySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

function getQuarterFromMonth(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

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

  if (!cronAuthorized) {
    if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
    if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const { month, year } = parsed.data;
  const quarter = getQuarterFromMonth(month);

  const organizationIds = cronAuthorized
    ? (await prisma.organization.findMany({ select: { id: true } })).map((item) => item.id)
    : [auth!.organizationId];

  const perOrganization: Array<{
    organizationId: string;
    monthly: { credited: number; skipped: number };
    quarterly: { credited: number; skipped: number };
  }> = [];

  let monthlyCredited = 0;
  let monthlySkipped = 0;
  let quarterlyCredited = 0;
  let quarterlySkipped = 0;

  for (const organizationId of organizationIds) {
    const monthly = await processMonthlyBonus(organizationId, month, year);
    const quarterly = await processQuarterlyBonus(organizationId, quarter, year);

    perOrganization.push({ organizationId, monthly, quarterly });

    monthlyCredited += monthly.credited;
    monthlySkipped += monthly.skipped;
    quarterlyCredited += quarterly.credited;
    quarterlySkipped += quarterly.skipped;
  }

  return NextResponse.json({
    month,
    year,
    quarter,
    monthly: {
      credited: monthlyCredited,
      skipped: monthlySkipped,
    },
    quarterly: {
      credited: quarterlyCredited,
      skipped: quarterlySkipped,
    },
    perOrganization,
  });
}
