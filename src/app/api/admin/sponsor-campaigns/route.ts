import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuthAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { createCuidLike } from "@/lib/ids";
import { recordInternalEvent } from "@/lib/internal-events";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

interface CampaignRow {
  id: string;
  organizationId: string;
  sponsorId: string;
  title: string;
  description: string | null;
  campaignType: string;
  budgetCents: number;
  pointsBudget: number;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sponsorName: string;
}

const querySchema = z.object({
  sponsorId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "FINISHED", "CANCELLED"]).optional(),
});

const createSchema = z.object({
  sponsorId: z.string().min(1),
  title: z.string().trim().min(2),
  description: z.string().trim().max(2000).optional().nullable(),
  campaignType: z.string().trim().min(1),
  budgetCents: z.number().int().min(0).default(0),
  pointsBudget: z.number().int().min(0).default(0),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "FINISHED", "CANCELLED"]).default("DRAFT"),
}).superRefine((value, ctx) => {
  if (value.startsAt && value.endsAt && value.endsAt < value.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fim da campanha nao pode ser anterior ao inicio.",
      path: ["endsAt"],
    });
  }
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    sponsorId: req.nextUrl.searchParams.get("sponsorId") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Query invalida.", 400);

  const filters: Prisma.Sql[] = [Prisma.sql`c."organizationId" = ${auth.organizationId}`];
  if (parsed.data.sponsorId) filters.push(Prisma.sql`c."sponsorId" = ${parsed.data.sponsorId}`);
  if (parsed.data.status) filters.push(Prisma.sql`c.status = ${parsed.data.status}::"public"."SponsorCampaignStatus"`);

  const rows = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    SELECT c.*, s.name AS "sponsorName"
    FROM public.sponsor_campaigns c
    INNER JOIN public.sponsors s ON s.id = c."sponsorId"
    WHERE ${Prisma.join(filters, " AND ")}
    ORDER BY c."createdAt" DESC
  `);

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const sponsor = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM public.sponsors
    WHERE id = ${parsed.data.sponsorId}
      AND "organizationId" = ${auth.organizationId}
    LIMIT 1
  `);
  if (!sponsor[0]) return apiError("USER_NOT_FOUND", "Patrocinador nao encontrado.", 404);

  const payload = parsed.data;
  const id = createCuidLike();
  const rows = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    INSERT INTO public.sponsor_campaigns (
      id,
      "organizationId",
      "sponsorId",
      title,
      description,
      "campaignType",
      "budgetCents",
      "pointsBudget",
      "startsAt",
      "endsAt",
      status,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${auth.organizationId},
      ${payload.sponsorId},
      ${payload.title},
      ${payload.description ?? null},
      ${payload.campaignType},
      ${payload.budgetCents},
      ${payload.pointsBudget},
      ${payload.startsAt ?? null},
      ${payload.endsAt ?? null},
      ${payload.status}::"public"."SponsorCampaignStatus",
      NOW(),
      NOW()
    )
    RETURNING *, ''::text AS "sponsorName"
  `);

  await Promise.all([
    writeAuthAuditLog(req, auth, {
      action: "sponsor_campaign.created",
      entityType: "SponsorCampaign",
      entityId: id,
      afterData: {
        ...payload,
        startsAt: payload.startsAt?.toISOString() ?? null,
        endsAt: payload.endsAt?.toISOString() ?? null,
      },
    }),
    recordInternalEvent({
      organizationId: auth.organizationId,
      userId: auth.userId,
      name: "sponsor.campaign_created",
      sourceType: "SponsorCampaign",
      sourceId: id,
      payload: {
        sponsorId: payload.sponsorId,
        status: payload.status,
        pointsBudget: payload.pointsBudget,
      },
    }),
  ]);

  return NextResponse.json({ data: rows[0] }, { status: 201 });
}
