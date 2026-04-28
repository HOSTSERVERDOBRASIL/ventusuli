import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getLoyaltySnapshot } from "@/lib/loyalty/service";
import { getAuthContext } from "@/lib/request-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const snapshot = await getLoyaltySnapshot(auth.userId, auth.organizationId);
  return NextResponse.json({ data: snapshot.missions });
}
