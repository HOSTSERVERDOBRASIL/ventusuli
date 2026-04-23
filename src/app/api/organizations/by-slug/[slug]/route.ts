import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

function readBooleanSetting(settings: unknown, key: string, fallback: boolean): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return fallback;
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : fallback;
}

export async function GET(_req: NextRequest, context: { params: { slug: string } }) {
  const slug = context.params.slug?.trim().toLowerCase();
  if (!slug) return apiError("VALIDATION_ERROR", "Slug da assessoria invalido.", 400);

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logo_url: true,
      settings: true,
    },
  });

  if (!organization) {
    return apiError("ORG_NOT_FOUND", "Assessoria nao encontrada para este slug.", 404);
  }

  const requireAthleteApproval = readBooleanSetting(
    organization.settings,
    "requireAthleteApproval",
    false,
  );
  const allowAthleteSelfSignup = readBooleanSetting(
    organization.settings,
    "allowAthleteSelfSignup",
    false,
  );

  return NextResponse.json(
    {
      data: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logo_url,
        requireAthleteApproval,
        allowAthleteSelfSignup,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
