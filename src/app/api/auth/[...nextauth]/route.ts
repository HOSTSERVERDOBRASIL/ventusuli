import { NextResponse } from "next/server";

function disabledResponse() {
  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "NextAuth está desativado. Use /api/auth/login e /api/auth/refresh.",
      },
    },
    { status: 404 },
  );
}

export const GET = disabledResponse;
export const POST = disabledResponse;
