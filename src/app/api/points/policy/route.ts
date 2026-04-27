import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getOrganizationPointPolicy } from "@/lib/points/policy";
import { getAuthContext } from "@/lib/request-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const policy = await getOrganizationPointPolicy(auth.organizationId);
  return NextResponse.json({ data: policy });
}
