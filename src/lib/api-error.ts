import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

// ─── Error codes ──────────────────────────────────────────────────────────────

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_EXISTS"
  | "ORG_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "TOKEN_REVOKED"
  | "RATE_LIMIT_EXCEEDED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleApiException(
  error: unknown,
  fallbackMessage = "Erro interno inesperado.",
): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiError("VALIDATION_ERROR", "Conflito de dados unicos.", 409);
    }
    if (error.code === "P2025") {
      return apiError("USER_NOT_FOUND", "Registro nao encontrado.", 404);
    }
  }

  logError("Unhandled API exception", {
    fallbackMessage,
    error: error instanceof Error ? error.message : String(error),
  });
  return apiError("INTERNAL_ERROR", fallbackMessage, 500);
}
