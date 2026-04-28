import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { listUserPointActivityEntries } from "@/lib/points/activityService";
import { getAuthContext } from "@/lib/request-auth";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const parsed = querySchema.safeParse({
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const result = await listUserPointActivityEntries({
    organizationId: auth.organizationId,
    userId: auth.userId,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return NextResponse.json(result);
}
