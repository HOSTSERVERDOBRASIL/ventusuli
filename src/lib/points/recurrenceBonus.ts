import { creditPoints } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";

interface UserCountRow {
  userId: string;
  participations: number | bigint;
}

interface BonusResult {
  credited: number;
  skipped: number;
}

function toMonthKey(month: number): string {
  return String(month).padStart(2, "0");
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function processMonthlyBonus(orgId: string, month: number, year: number): Promise<BonusResult> {
  const users = await prisma.$queryRaw<UserCountRow[]>`
    SELECT
      "userId",
      COUNT(*)::bigint AS participations
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${orgId}
      AND "sourceType" = 'EVENT_PARTICIPATION'
      AND EXTRACT(MONTH FROM "createdAt") = ${month}
      AND EXTRACT(YEAR FROM "createdAt") = ${year}
    GROUP BY "userId"
    HAVING COUNT(*) >= 3
  `;

  let credited = 0;
  let skipped = 0;

  for (const user of users) {
    const referenceCode = `REC-M-${user.userId}-${year}-${toMonthKey(month)}`;
    const result = await creditPoints({
      orgId,
      userId: user.userId,
      sourceType: "RECURRENCE",
      points: 10,
      description: `Bonus mensal de recorrencia ${toMonthKey(month)}/${year}`,
      referenceCode,
      createdBy: "system:recurrence",
    });

    if (result.created) credited += 1;
    else skipped += 1;
  }

  return { credited, skipped };
}

function quarterRange(quarter: 1 | 2 | 3 | 4, year: number): { startDate: Date; endDate: Date } {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, startMonth + 3, 1, 0, 0, 0, 0));
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  endDate.setUTCHours(23, 59, 59, 999);
  return { startDate, endDate };
}

export async function processQuarterlyBonus(orgId: string, quarter: 1 | 2 | 3 | 4, year: number): Promise<BonusResult> {
  const { startDate, endDate } = quarterRange(quarter, year);

  const users = await prisma.$queryRaw<UserCountRow[]>`
    SELECT
      "userId",
      COUNT(*)::bigint AS participations
    FROM public."AthletePointLedger"
    WHERE "organizationId" = ${orgId}
      AND "sourceType" = 'EVENT_PARTICIPATION'
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
    GROUP BY "userId"
    HAVING COUNT(*) >= 5
  `;

  let credited = 0;
  let skipped = 0;

  for (const user of users) {
    const referenceCode = `REC-Q-${user.userId}-${year}-Q${quarter}`;
    const result = await creditPoints({
      orgId,
      userId: user.userId,
      sourceType: "RECURRENCE",
      points: 20,
      description: `Bonus trimestral de recorrencia Q${quarter}/${year} (${toIsoDate(startDate)} a ${toIsoDate(endDate)})`,
      referenceCode,
      createdBy: "system:recurrence",
    });

    if (result.created) credited += 1;
    else skipped += 1;
  }

  return { credited, skipped };
}
