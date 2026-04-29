import { Prisma } from "@prisma/client";
import { FinanceProfile } from "@/lib/finance-profile";

export interface RecurringChargeRunInput {
  organizationId: string;
  actorUserId: string;
  monthKey: string;
  financeProfile: FinanceProfile;
}

export interface RecurringChargeRunResult {
  monthKey: string;
  generatedCount: number;
  skippedCount: number;
  totalAmountCents: number;
  generatedIds: string[];
}

function toMonthStart(monthKey: string): Date {
  return new Date(`${monthKey}-01T12:00:00.000Z`);
}

function toDueDate(monthStart: Date, billingDay: number | null, graceDays: number): Date {
  const dueDay = Math.max(1, Math.min(31, billingDay ?? 5));
  const dueDate = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), dueDay, 12, 0, 0, 0));
  dueDate.setUTCDate(dueDate.getUTCDate() + Math.max(0, graceDays));
  return dueDate;
}

function buildReferenceCode(userId: string, monthKey: string): string {
  return `REC-MENSALIDADE-${userId}-${monthKey}`;
}

export function isValidMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export async function generateRecurringMembershipCharges(
  tx: Prisma.TransactionClient,
  input: RecurringChargeRunInput,
): Promise<RecurringChargeRunResult> {
  const monthStart = toMonthStart(input.monthKey);
  const dueAt = toDueDate(
    monthStart,
    input.financeProfile.billingDay,
    input.financeProfile.recurringGraceDays,
  );

  const athletes = await tx.user.findMany({
    where: {
      organization_id: input.organizationId,
      role: "ATHLETE",
      account_status: "ACTIVE",
      athlete_profile: {
        is: {
          athlete_status: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const existing = await tx.financialEntry.findMany({
    where: {
      organization_id: input.organizationId,
      reference_code: {
        in: athletes.map((athlete) => buildReferenceCode(athlete.id, input.monthKey)),
      },
    },
    select: {
      reference_code: true,
    },
  });
  const existingCodes = new Set(existing.map((entry) => entry.reference_code).filter(Boolean));

  let generatedCount = 0;
  let skippedCount = 0;
  let totalAmountCents = 0;
  const generatedIds: string[] = [];

  for (const athlete of athletes) {
    const referenceCode = buildReferenceCode(athlete.id, input.monthKey);
    if (existingCodes.has(referenceCode)) {
      skippedCount += 1;
      continue;
    }

    const created = await tx.financialEntry.create({
      data: {
        organization_id: input.organizationId,
        subject_user_id: athlete.id,
        type: "INCOME",
        amount_cents: input.financeProfile.recurringMonthlyFeeCents,
        category: "Mensalidades",
        description: `${input.financeProfile.recurringDescription} ${input.monthKey}`,
        occurred_at: monthStart,
        due_at: dueAt,
        settled_at: null,
        status: "OPEN",
        entry_kind: "RECEIVABLE",
        account_code: input.financeProfile.defaultAccountCode,
        cost_center: input.financeProfile.defaultCostCenter,
        counterparty: `${athlete.name} <${athlete.email}>`,
        payment_method: input.financeProfile.defaultPaymentMethod,
        document_url: null,
        reference_code: referenceCode,
        created_by: input.actorUserId,
      },
      select: { id: true },
    });

    generatedCount += 1;
    totalAmountCents += input.financeProfile.recurringMonthlyFeeCents;
    generatedIds.push(created.id);
  }

  return {
    monthKey: input.monthKey,
    generatedCount,
    skippedCount,
    totalAmountCents,
    generatedIds,
  };
}
