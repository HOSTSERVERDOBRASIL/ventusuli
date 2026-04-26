import { Prisma } from "@prisma/client";

interface MemberNumberRow {
  member_sequence: number;
  member_number: string;
}

function formatMemberNumber(sequence: number): string {
  return `ASSOC-${String(sequence).padStart(5, "0")}`;
}

export async function ensureAthleteMemberNumber(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    userId: string;
  },
): Promise<MemberNumberRow> {
  const existing = await tx.$queryRaw<MemberNumberRow[]>`
    SELECT member_sequence, member_number
    FROM public.athlete_profiles
    WHERE organization_id = ${params.organizationId}
      AND user_id = ${params.userId}
      AND member_sequence IS NOT NULL
      AND member_number IS NOT NULL
    LIMIT 1
  `;

  if (existing[0]) return existing[0];

  await tx.$queryRaw`
    SELECT id
    FROM public.organizations
    WHERE id = ${params.organizationId}
    LIMIT 1
    FOR UPDATE
  `;

  const rows = await tx.$queryRaw<Array<{ next_sequence: number | bigint | null }>>`
    SELECT COALESCE(MAX(member_sequence), 0) + 1 AS next_sequence
    FROM public.athlete_profiles
    WHERE organization_id = ${params.organizationId}
  `;

  const nextSequence = Number(rows[0]?.next_sequence ?? 1);
  const memberNumber = formatMemberNumber(nextSequence);

  await tx.$executeRaw`
    UPDATE public.athlete_profiles
    SET member_sequence = ${nextSequence},
        member_number = ${memberNumber},
        member_since = COALESCE(member_since, NOW())
    WHERE organization_id = ${params.organizationId}
      AND user_id = ${params.userId}
  `;

  return {
    member_sequence: nextSequence,
    member_number: memberNumber,
  };
}
