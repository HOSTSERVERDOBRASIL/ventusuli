import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_POINT_VALUE_CENTS = 10;
export const DEFAULT_POINT_EXPIRATION_MONTHS = 12;

export interface PointPolicy {
  pointValueCents: number;
  expirationMonths: number;
  athletePolicyText: string;
}

export const DEFAULT_ATHLETE_POLICY_TEXT =
  "Voce ganha pontos ao participar de provas da assessoria e pode receber bonus por inscricao antecipada, pagamento antecipado e campanhas. Os pontos podem ser usados para trocar brindes ou reduzir o valor de produtos com complemento em PIX quando permitido.";

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function readText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function normalizePointPolicy(settings: unknown): PointPolicy {
  const root = readObject(settings);
  const policy = readObject(root.pointsPolicy);

  return {
    pointValueCents: readNumber(policy.pointValueCents, DEFAULT_POINT_VALUE_CENTS),
    expirationMonths: readNumber(policy.expirationMonths, DEFAULT_POINT_EXPIRATION_MONTHS),
    athletePolicyText: readText(policy.athletePolicyText, DEFAULT_ATHLETE_POLICY_TEXT),
  };
}

export function mergePointPolicySettings(
  settings: unknown,
  policy: PointPolicy,
): Prisma.InputJsonObject {
  const root = readObject(settings);

  return {
    ...root,
    pointsPolicy: {
      pointValueCents: policy.pointValueCents,
      expirationMonths: policy.expirationMonths,
      athletePolicyText: policy.athletePolicyText,
    },
  };
}

export async function getOrganizationPointPolicy(
  organizationId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PointPolicy> {
  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  return normalizePointPolicy(organization?.settings);
}
