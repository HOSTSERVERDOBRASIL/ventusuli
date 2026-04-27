import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";
import { isAllowedImageUrl } from "@/lib/storage/image-url";

interface RewardItemRow {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  pointsCost: number;
  cashPriceCents: number;
  allowPoints: boolean;
  allowCash: boolean;
  allowMixed: boolean;
  maxPointsDiscountPercent: number;
  minimumCashCents: number;
  stockQuantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CountRow {
  total: number | bigint;
}

const querySchema = z.object({
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  category: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().min(1),
  imageUrl: z
    .string()
    .trim()
    .min(1)
    .refine((value) => isAllowedImageUrl(value), {
      message: "Imagem da recompensa invalida. Use upload oficial ou URL http/https.",
    })
    .optional()
    .nullable(),
  pointsCost: z.number().int().min(0),
  cashPriceCents: z.number().int().min(0),
  allowPoints: z.boolean(),
  allowCash: z.boolean(),
  allowMixed: z.boolean(),
  maxPointsDiscountPercent: z.number().int().min(0).max(100),
  minimumCashCents: z.number().int().min(0),
  stockQuantity: z.number().int().min(0),
  active: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (!value.allowPoints && !value.allowCash) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe pelo menos uma forma de resgate: pontos ou PIX.",
      path: ["allowPoints"],
    });
  }
  if (value.allowMixed && (!value.allowPoints || !value.allowCash)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Resgate misto exige pontos e PIX habilitados.",
      path: ["allowMixed"],
    });
  }
  if (value.minimumCashCents > value.cashPriceCents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Valor minimo em PIX nao pode superar o preco do produto.",
      path: ["minimumCashCents"],
    });
  }
});

function toCuidLike(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `c${ts}${rand}`;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    active: req.nextUrl.searchParams.get("active") ?? undefined,
    category: req.nextUrl.searchParams.get("category") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const { active, category, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const filters: Prisma.Sql[] = [Prisma.sql`"organizationId" = ${auth.organizationId}`];
  if (active !== undefined) filters.push(Prisma.sql`active = ${active}`);
  if (category) filters.push(Prisma.sql`category = ${category}`);

  const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM public."RewardItem"
      ${whereSql}
    `),
    prisma.$queryRaw<RewardItemRow[]>(Prisma.sql`
      SELECT *
      FROM public."RewardItem"
      ${whereSql}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

  return NextResponse.json({ data: rows, total, page, totalPages });
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

  const payload = parsed.data;

  const createdRows = await prisma.$queryRaw<RewardItemRow[]>(Prisma.sql`
    INSERT INTO public."RewardItem" (
      id,
      "organizationId",
      name,
      description,
      category,
      "imageUrl",
      "pointsCost",
      "cashPriceCents",
      "allowPoints",
      "allowCash",
      "allowMixed",
      "maxPointsDiscountPercent",
      "minimumCashCents",
      "stockQuantity",
      active,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${toCuidLike()},
      ${auth.organizationId},
      ${payload.name},
      ${payload.description ?? null},
      ${payload.category},
      ${payload.imageUrl ?? null},
      ${payload.pointsCost},
      ${payload.cashPriceCents},
      ${payload.allowPoints},
      ${payload.allowCash},
      ${payload.allowMixed},
      ${payload.maxPointsDiscountPercent},
      ${payload.minimumCashCents},
      ${payload.stockQuantity},
      ${payload.active},
      NOW(),
      NOW()
    )
    RETURNING *
  `);

  return NextResponse.json({ data: createdRows[0] }, { status: 201 });
}
