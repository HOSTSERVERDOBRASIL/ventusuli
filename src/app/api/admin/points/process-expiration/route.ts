import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { expirePoints } from "@/lib/points/expirationService";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

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

  const organizationIds = cronAuthorized
    ? (await prisma.organization.findMany({ select: { id: true } })).map((item) => item.id)
    : [auth!.organizationId];

  const perOrganization: Array<{ organizationId: string; usersAffected: number; pointsExpired: number }> = [];

  let usersAffected = 0;
  let pointsExpired = 0;

  for (const organizationId of organizationIds) {
    const result = await expirePoints(organizationId);
    perOrganization.push({ organizationId, ...result });
    usersAffected += result.usersAffected;
    pointsExpired += result.pointsExpired;
  }

  return NextResponse.json({ usersAffected, pointsExpired, perOrganization });
}
