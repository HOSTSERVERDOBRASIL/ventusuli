import { Prisma } from "@prisma/client";
import { createCuidLike } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/request-auth";

type AuditActorType = "USER" | "SYSTEM" | "INTEGRATION";

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  organizationId?: string | null;
  actorId?: string | null;
  actorType?: AuditActorType;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeData?: Prisma.InputJsonValue | null;
  afterData?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}

export function getAuditRequestContext(req: Request): Pick<AuditLogInput, "requestId" | "ipAddress" | "userAgent"> {
  return {
    requestId: req.headers.get("x-request-id"),
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
  };
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public.audit_logs (
      id,
      "organizationId",
      "actorId",
      "actorType",
      action,
      "entityType",
      "entityId",
      "requestId",
      "ipAddress",
      "userAgent",
      "beforeData",
      "afterData",
      metadata,
      "createdAt"
    )
    VALUES (
      ${createCuidLike()},
      ${input.organizationId ?? null},
      ${input.actorId ?? null},
      ${input.actorType ?? "USER"}::"public"."AuditActorType",
      ${input.action},
      ${input.entityType},
      ${input.entityId ?? null},
      ${input.requestId ?? null},
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null},
      ${input.beforeData === undefined ? null : input.beforeData},
      ${input.afterData === undefined ? null : input.afterData},
      ${input.metadata === undefined ? null : input.metadata},
      NOW()
    )
  `);
}

export async function writeAuthAuditLog(
  req: Request,
  auth: AuthContext,
  input: Omit<AuditLogInput, "organizationId" | "actorId" | "actorType" | "requestId" | "ipAddress" | "userAgent">,
): Promise<void> {
  await writeAuditLog({
    ...input,
    ...getAuditRequestContext(req),
    organizationId: auth.organizationId,
    actorId: auth.userId,
    actorType: "USER",
  });
}
