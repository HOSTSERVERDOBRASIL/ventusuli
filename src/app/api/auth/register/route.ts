import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";

export async function POST(_req: NextRequest) {
  return apiError(
    "VALIDATION_ERROR",
    "Endpoint descontinuado. Use /api/auth/register-admin ou /api/auth/register-athlete.",
    410,
  );
}
