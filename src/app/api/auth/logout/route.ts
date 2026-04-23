import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashRefreshToken } from "@/lib/auth";
import { REFRESH_TOKEN_COOKIE, clearAccessCookie, clearRefreshCookie } from "@/lib/cookies";
import { isDemoModeEnabled } from "@/lib/auth-config";
import { logError, logInfo, withRequestContext } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const incomingToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const demoEnabled = isDemoModeEnabled();

  try {
    if (incomingToken && !demoEnabled) {
      const token_hash = hashRefreshToken(incomingToken);

      // Revoke silently and avoid leaking token existence details.
      await prisma.refreshToken.updateMany({
        where: { token_hash, revoked: false },
        data: { revoked: true },
      });
    }
  } catch (error) {
    logError(
      "auth_logout_revoke_failed",
      withRequestContext(req, { error: error instanceof Error ? error.message : String(error) }),
    );
  }

  const response = NextResponse.json(
    { message: "Logout realizado com sucesso." },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
  clearRefreshCookie(response);
  clearAccessCookie(response);
  logInfo("auth_logout_success", withRequestContext(req));
  return response;
}
