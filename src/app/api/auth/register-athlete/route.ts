import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAthleteMemberNumber } from "@/lib/athletes/member-number";
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "@/lib/auth";
import { registerAthleteSchema } from "@/lib/validations/auth";
import { apiError } from "@/lib/api-error";
import { setAccessCookie, setRefreshCookie } from "@/lib/cookies";
import { getAuthConfigError, isDemoModeEnabled } from "@/lib/auth-config";
import { checkRateLimit, getClientIp, isRateLimiterUnavailableError } from "@/lib/rate-limiter";
import { logError, logInfo, logWarn, toErrorContext, withRequestContext } from "@/lib/logger";
import { UserRole } from "@/types";

const REFRESH_TTL_DAYS = 30;
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 15 * 60 * 1_000;

type ResolvedEnrollment = {
  organizationId: string;
  usedInviteId: string | null;
  invitedEmail: string | null;
};

type InviteUsageGuard = {
  active: boolean;
  expires_at: Date | null;
  max_uses: number | null;
  used_count: number;
  invited_email: string | null;
};

class InviteUsageError extends Error {
  constructor() {
    super("invalid_or_exhausted_invite");
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}

function readBooleanSetting(settings: unknown, key: string, fallback: boolean): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return fallback;
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : fallback;
}

function resolveAthleteStatus(requireAthleteApproval: boolean): "PENDING_APPROVAL" | "ACTIVE" {
  return requireAthleteApproval ? "PENDING_APPROVAL" : "ACTIVE";
}

function resolveSignupSource(usingInvite: boolean): "INVITE" | "SLUG" {
  return usingInvite ? "INVITE" : "SLUG";
}

function isInviteUsable(invite: InviteUsageGuard): boolean {
  const expired = invite.expires_at ? invite.expires_at.getTime() < Date.now() : false;
  const outOfUses = typeof invite.max_uses === "number" && invite.used_count >= invite.max_uses;
  return invite.active && !expired && !outOfUses;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function resolveEnrollmentTarget(input: {
  organizationSlug?: string;
  inviteToken?: string;
}): Promise<ResolvedEnrollment | null> {
  if (input.inviteToken) {
    const inviteRows = await prisma.$queryRaw<
      Array<InviteUsageGuard & { id: string; organization_id: string }>
    >`
      SELECT id, organization_id, active, expires_at, max_uses, used_count, invited_email
      FROM public.organization_invites
      WHERE token = ${input.inviteToken}
      LIMIT 1
    `;

    const invite = inviteRows[0];

    if (!invite) return null;

    if (!isInviteUsable(invite)) return null;

    return {
      organizationId: invite.organization_id,
      usedInviteId: invite.id,
      invitedEmail: invite.invited_email,
    };
  }

  if (input.organizationSlug) {
    const organization = await prisma.organization.findUnique({
      where: { slug: input.organizationSlug },
      select: { id: true },
    });

    if (!organization) return null;

    return {
      organizationId: organization.id,
      usedInviteId: null,
      invitedEmail: null,
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const authConfigError = getAuthConfigError();
  if (authConfigError) {
    logError("auth_register_athlete_config_error", withRequestContext(req, { authConfigError }));
    return apiError("INTERNAL_ERROR", authConfigError, 500);
  }

  const ip = getClientIp(req.headers);
  let allowed = false;
  let remaining = 0;
  let resetAt = Date.now() + RATE_WINDOW_MS;
  try {
    ({ allowed, remaining, resetAt } = await checkRateLimit(`auth:register-athlete:${ip}`, RATE_LIMIT, RATE_WINDOW_MS));
  } catch (error) {
    if (isRateLimiterUnavailableError(error)) {
      logError("auth_register_athlete_rate_limiter_unavailable", withRequestContext(req, toErrorContext(error)));
      return apiError("INTERNAL_ERROR", "Rate limiter indisponivel no momento.", 503);
    }
    logError("auth_register_athlete_rate_limiter_failed", withRequestContext(req, toErrorContext(error)));
    throw error;
  }

  if (!allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
    logWarn("auth_register_athlete_rate_limited", withRequestContext(req, { ip, retryAfterSec }));
    return new NextResponse(
      JSON.stringify({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Muitas tentativas. Tente novamente em ${retryAfterSec}s.`,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
        },
      },
    );
  }

  const demoEnabled = isDemoModeEnabled();
  if (demoEnabled) {
    logWarn("auth_register_athlete_demo_blocked", withRequestContext(req));
    return apiError(
      "FORBIDDEN",
      "Cadastro desativado no modo demonstracao. Use a conta demo para entrar.",
      403,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = registerAthleteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const { name, email, password, organizationSlug, inviteToken } = parsed.data;
  const normalizedEmail = normalizeEmail(email);

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, organization_id: true },
    });

    if (existingUser) {
      logWarn("auth_register_athlete_email_conflict", withRequestContext(req, { email }));
      // Give a clear message: each user belongs to exactly one org and cannot join another.
      return apiError(
        "EMAIL_ALREADY_EXISTS",
        "Este e-mail já está cadastrado em uma assessoria. Cada atleta só pode pertencer a uma assessoria por vez. Caso precise trocar, entre em contato com o suporte.",
        409,
      );
    }

    const enrollment = await resolveEnrollmentTarget({ organizationSlug, inviteToken });
    if (!enrollment) {
      logWarn(
        "auth_register_athlete_org_not_found",
        withRequestContext(req, { email, hasInviteToken: Boolean(inviteToken), organizationSlug: organizationSlug ?? null }),
      );
      return apiError(
        "ORG_NOT_FOUND",
        "Assessoria nao encontrada com os dados informados. Verifique slug ou convite.",
        404,
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: enrollment.organizationId },
      select: { id: true, settings: true },
    });

    if (!organization) {
      return apiError("ORG_NOT_FOUND", "Assessoria nao encontrada com os dados informados.", 404);
    }

    const allowAthleteSelfSignup = readBooleanSetting(organization.settings, "allowAthleteSelfSignup", false);
    const usingInvite = Boolean(enrollment.usedInviteId);
    const usingSlug = !usingInvite;

    if (usingSlug && !allowAthleteSelfSignup) {
      logWarn("auth_register_athlete_slug_blocked", withRequestContext(req, { email, organizationId: organization.id }));
      return apiError(
        "FORBIDDEN",
        "Esta assessoria nao permite auto cadastro no momento.",
        403,
      );
    }

    const requireAthleteApproval =
      usingInvite || readBooleanSetting(organization.settings, "requireAthleteApproval", false);
    const athleteStatus = resolveAthleteStatus(requireAthleteApproval);
    const signupSource = resolveSignupSource(usingInvite);

    if (enrollment.invitedEmail && normalizeEmail(enrollment.invitedEmail) !== normalizedEmail) {
      return apiError(
        "FORBIDDEN",
        "Este convite foi emitido para outro e-mail. Use o e-mail convidado ou solicite novo convite.",
        403,
      );
    }

    const password_hash = await hashPassword(password);

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          password_hash,
          role: UserRole.ATHLETE,
          account_status: requireAthleteApproval ? "PENDING_APPROVAL" : "ACTIVE",
          organization_id: organization.id,
        },
        select: { id: true, name: true, email: true, role: true, organization_id: true },
      });

      await tx.athleteProfile.upsert({
        where: { user_id: user.id },
        update: {
          organization_id: organization.id,
          athlete_status: athleteStatus,
          signup_source: signupSource,
          onboarding_completed_at: null,
        },
        create: {
          user_id: user.id,
          organization_id: organization.id,
          athlete_status: athleteStatus,
          signup_source: signupSource,
          onboarding_completed_at: null,
        },
      });

      if (enrollment.usedInviteId) {
        const inviteRows = await tx.$queryRaw<InviteUsageGuard[]>`
          SELECT active, expires_at, max_uses, used_count, invited_email
          FROM public.organization_invites
          WHERE id = ${enrollment.usedInviteId}
            AND organization_id = ${organization.id}
          LIMIT 1
          FOR UPDATE
        `;

        const invite = inviteRows[0];
        if (!invite || !isInviteUsable(invite)) {
          throw new InviteUsageError();
        }

        if (invite.invited_email && normalizeEmail(invite.invited_email) !== normalizedEmail) {
          throw new InviteUsageError();
        }

        await tx.$executeRaw`
          UPDATE public.organization_invites
          SET used_count = used_count + 1,
              accepted_user_id = ${user.id},
              accepted_at = NOW()
          WHERE id = ${enrollment.usedInviteId}
        `;
      }

      if (!requireAthleteApproval) {
        await ensureAthleteMemberNumber(tx, {
          organizationId: organization.id,
          userId: user.id,
        });
      }

      return user;
    });

    if (requireAthleteApproval) {
      logInfo(
        "auth_register_athlete_pending_approval",
        withRequestContext(req, {
          userId: createdUser.id,
          organizationId: createdUser.organization_id,
          signupSource,
        }),
      );
      return NextResponse.json(
        {
          user: {
            id: createdUser.id,
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
            athleteStatus,
          },
          requiresApproval: true,
        },
        {
          status: 202,
          headers: {
            "Cache-Control": "no-store",
            "X-RateLimit-Limit": String(RATE_LIMIT),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
          },
        },
      );
    }

    const accessToken = generateAccessToken(
      createdUser.id,
      createdUser.role as UserRole,
      createdUser.organization_id,
      "ACTIVE",
    );
    const refreshToken = generateRefreshToken();
    const token_hash = hashRefreshToken(refreshToken);
    const expires_at = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1_000);

    await prisma.refreshToken.create({
      data: { user_id: createdUser.id, organization_id: createdUser.organization_id, token_hash, expires_at },
    });

    const response = NextResponse.json(
      {
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          athleteStatus,
        },
        accessToken,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(RATE_LIMIT),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
        },
      },
    );

    setRefreshCookie(response, refreshToken);
    setAccessCookie(response, accessToken);
    logInfo(
      "auth_register_athlete_success",
      withRequestContext(req, {
        userId: createdUser.id,
        organizationId: createdUser.organization_id,
        signupSource,
      }),
    );
    return response;
  } catch (error) {
    if (error instanceof InviteUsageError) {
      return apiError(
        "ORG_NOT_FOUND",
        "Assessoria nao encontrada com os dados informados. Verifique slug ou convite.",
        404,
      );
    }

    if (hasPrismaCode(error, "P2002")) {
      logWarn("auth_register_athlete_unique_conflict", withRequestContext(req, { email }));
      return apiError(
        "EMAIL_ALREADY_EXISTS",
        "Este e-mail já está cadastrado. Cada atleta só pode pertencer a uma assessoria por vez.",
        409,
      );
    }

    logError("auth_register_athlete_unexpected_error", {
      ...withRequestContext(req, { email }),
      ...toErrorContext(error),
    });
    return apiError("INTERNAL_ERROR", "Erro interno ao criar conta de atleta.", 500);
  }
}
