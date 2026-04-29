import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface SponsorRow {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  websiteUrl: string | null;
  sponsorType: string;
  activeCampaigns: number | bigint;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  const filters: Prisma.Sql[] = [Prisma.sql`s.status = 'ACTIVE'::"public"."SponsorStatus"`];
  if (auth?.organizationId) filters.push(Prisma.sql`s."organizationId" = ${auth.organizationId}`);

  const rows = await prisma.$queryRaw<SponsorRow[]>(Prisma.sql`
    SELECT
      s.id,
      s.name,
      s."logoUrl",
      s.description,
      s."websiteUrl",
      s."sponsorType",
      COUNT(c.id)::bigint AS "activeCampaigns"
    FROM public.sponsors s
    LEFT JOIN public.sponsor_campaigns c
      ON c."sponsorId" = s.id
      AND c.status = 'ACTIVE'::"public"."SponsorCampaignStatus"
      AND (c."startsAt" IS NULL OR c."startsAt" <= NOW())
      AND (c."endsAt" IS NULL OR c."endsAt" >= NOW())
    WHERE ${Prisma.join(filters, " AND ")}
    GROUP BY s.id
    ORDER BY s."createdAt" DESC
  `);

  return NextResponse.json({
    data: rows.map((row) => ({ ...row, activeCampaigns: Number(row.activeCampaigns) })),
  });
}
