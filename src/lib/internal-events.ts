import { Prisma } from "@prisma/client";
import { createCuidLike } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

export interface InternalEventInput {
  organizationId: string;
  name: string;
  sourceType: string;
  sourceId: string;
  userId?: string | null;
  idempotencyKey?: string;
  payload?: Prisma.InputJsonValue | null;
}

export interface InternalEventResult {
  id: string;
  created: boolean;
}

export function buildInternalEventKey(input: Pick<InternalEventInput, "name" | "sourceType" | "sourceId">): string {
  return `${input.name}:${input.sourceType}:${input.sourceId}`;
}

export async function recordInternalEvent(input: InternalEventInput): Promise<InternalEventResult> {
  const idempotencyKey = input.idempotencyKey ?? buildInternalEventKey(input);
  const id = createCuidLike();

  const rows = await prisma.$queryRaw<Array<{ id: string; inserted: boolean }>>(Prisma.sql`
    INSERT INTO public.internal_events (
      id,
      "organizationId",
      "userId",
      name,
      "sourceType",
      "sourceId",
      "idempotencyKey",
      payload,
      status,
      attempts,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${input.organizationId},
      ${input.userId ?? null},
      ${input.name},
      ${input.sourceType},
      ${input.sourceId},
      ${idempotencyKey},
      ${input.payload ?? null},
      'PENDING'::"public"."InternalEventStatus",
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT ("organizationId", "idempotencyKey")
    DO UPDATE SET
      payload = COALESCE(public.internal_events.payload, EXCLUDED.payload),
      "updatedAt" = public.internal_events."updatedAt"
    RETURNING id, (xmax = 0) AS inserted
  `);

  const row = rows[0];
  return { id: row?.id ?? id, created: Boolean(row?.inserted) };
}
