import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  createPointActivityEntry,
  listPointActivityEntries,
} from "@/lib/points/activityService";
import { getAuthContext, isAdminRole } from "@/lib/request-auth";

const createSchema = z.object({
  activityId: z.string().min(1),
  userId: z.string().min(1),
  points: z.number().int().positive(),
  note: z.string().trim().max(500).optional().nullable(),
  proofUrl: z.string().trim().url().optional().nullable(),
});

const querySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  activityId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao ADMIN.", 403);

  const parsed = querySchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    activityId: req.nextUrl.searchParams.get("activityId") ?? undefined,
    userId: req.nextUrl.searchParams.get("userId") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const result = await listPointActivityEntries({
    organizationId: auth.organizationId,
    status: parsed.data.status,
    activityId: parsed.data.activityId,
    userId: parsed.data.userId,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return NextResponse.json(result);
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

  try {
    const data = await createPointActivityEntry({
      organizationId: auth.organizationId,
      activityId: parsed.data.activityId,
      userId: parsed.data.userId,
      points: parsed.data.points,
      source: "ADMIN",
      note: parsed.data.note ?? null,
      proofUrl: parsed.data.proofUrl ?? null,
      createdBy: auth.userId,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel criar lancamento.";
    return apiError("VALIDATION_ERROR", message, 400);
  }
}
