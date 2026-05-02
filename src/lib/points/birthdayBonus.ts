import { getOptionalIntegrationEnv } from "@/lib/env";
import { notifyBirthdayIndividual } from "@/lib/notifications/domain-events";
import { creditPoints } from "@/lib/points/pointsService";
import { prisma } from "@/lib/prisma";

interface BirthdayUserRow {
  userId: string;
}

interface BirthdayBonusResult {
  credited: number;
  skipped: number;
}

function birthdayPoints(): number {
  return getOptionalIntegrationEnv().BIRTHDAY_POINTS ?? 50;
}

function toMonthKey(month: number): string {
  return String(month).padStart(2, "0");
}

function toDayKey(day: number): string {
  return String(day).padStart(2, "0");
}

export async function processBirthdayBonus(
  organizationId: string,
  inputDate = new Date(),
): Promise<BirthdayBonusResult> {
  const month = inputDate.getUTCMonth() + 1;
  const day = inputDate.getUTCDate();
  const year = inputDate.getUTCFullYear();
  const points = birthdayPoints();

  const users = await prisma.$queryRaw<BirthdayUserRow[]>`
    SELECT u.id AS "userId"
    FROM public.users u
    INNER JOIN public.athlete_profiles p ON p.user_id = u.id
    WHERE u.organization_id = ${organizationId}
      AND u.account_status = 'ACTIVE'
      AND p.athlete_status = 'ACTIVE'
      AND p.birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM p.birth_date) = ${month}
      AND EXTRACT(DAY FROM p.birth_date) = ${day}
  `;

  let credited = 0;
  let skipped = 0;

  for (const user of users) {
    const referenceCode = `BDAY-${user.userId}-${year}`;
    const result = await creditPoints({
      orgId: organizationId,
      userId: user.userId,
      sourceType: "BIRTHDAY",
      points,
      description: `Bonus de aniversario ${toDayKey(day)}/${toMonthKey(month)}/${year}`,
      referenceCode,
      createdBy: "system:birthday",
    });

    if (result.created) {
      credited += 1;
      await notifyBirthdayIndividual(prisma, {
        organizationId,
        userId: user.userId,
        points,
        year,
      });
    } else {
      skipped += 1;
    }
  }

  return { credited, skipped };
}
