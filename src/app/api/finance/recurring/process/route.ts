import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import {
  generateRecurringMembershipCharges,
  isValidMonthKey,
} from "@/lib/finance-recurring";
import { normalizeFinanceProfile } from "@/lib/finance-profile";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isFinanceRole } from "@/lib/request-auth";

const processSchema = z.object({
  monthKey: z.string().trim().optional(),
});

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isFinanceRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao Financeiro.", 403);

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = processSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const monthKey = parsed.data.monthKey?.trim() || currentMonthKey();
  if (!isValidMonthKey(monthKey)) {
    return apiError("VALIDATION_ERROR", "Competencia invalida. Use YYYY-MM.", 400);
  }

  const organization = await prisma.organization.findUnique({
    where: { id: auth.organizationId },
    select: { settings: true, name: true },
  });
  if (!organization) {
    return apiError("USER_NOT_FOUND", "Organizacao nao encontrada.", 404);
  }

  const financeProfile = normalizeFinanceProfile(organization.settings);
  if (!financeProfile.recurringChargeEnabled) {
    return apiError(
      "VALIDATION_ERROR",
      "Ative a mensalidade recorrente nas configuracoes da assessoria antes de processar.",
      400,
    );
  }
  if (financeProfile.recurringMonthlyFeeCents <= 0) {
    return apiError(
      "VALIDATION_ERROR",
      "Defina um valor de mensalidade maior que zero nas configuracoes da assessoria.",
      400,
    );
  }

  const result = await prisma.$transaction((tx) =>
    generateRecurringMembershipCharges(tx, {
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      monthKey,
      financeProfile,
    }),
  );

  return NextResponse.json({
    data: {
      ...result,
      organizationName: organization.name,
    },
  });
}
