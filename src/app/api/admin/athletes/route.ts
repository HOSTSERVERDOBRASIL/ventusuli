import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { ensureAthleteMemberNumber } from "@/lib/athletes/member-number";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";
import { createAthleteByAdminSchema } from "@/lib/validations/athletes";

type AthleteStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
type FinancialSituation = "EM_DIA" | "PENDENTE" | "SEM_HISTORICO";
type AdminAthleteSortBy = "createdAt" | "name" | "memberNumber" | "registrations";

type AthleteListUser = Prisma.UserGetPayload<{
  include: {
    athlete_profile: {
      select: {
        athlete_status: true;
        signup_source: true;
        member_number: true;
        member_sequence: true;
        member_since: true;
        city: true;
        state: true;
      };
    };
    registrations: {
      include: {
        event: {
          select: {
            name: true;
            event_date: true;
          };
        };
        payment: {
          select: {
            status: true;
            amount_cents: true;
            paid_at: true;
            created_at: true;
          };
        };
      };
    };
    financial_entries_subject: {
      select: {
        status: true;
        amount_cents: true;
        settled_at: true;
        created_at: true;
      };
    };
  };
}>;

const querySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["ALL", "PENDING_APPROVAL", "ACTIVE", "REJECTED", "BLOCKED"]).default("ALL"),
  sortBy: z.enum(["createdAt", "name", "memberNumber", "registrations"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  export: z.enum(["csv"]).optional(),
});

function canManageAthletes(role: UserRole): boolean {
  const value = String(role);
  return value === "ADMIN" || value === "MANAGER";
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

function generateTemporaryPassword(): string {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `Vs!${token}A9`;
}

function financialFromData(paymentsCount: number, pendingAmount: number): FinancialSituation {
  if (paymentsCount === 0) return "SEM_HISTORICO";
  if (pendingAmount > 0) return "PENDENTE";
  return "EM_DIA";
}

function resolveAthleteStatus(profileStatus: unknown, accountStatus: string): AthleteStatus {
  if (
    profileStatus === "PENDING_APPROVAL" ||
    profileStatus === "ACTIVE" ||
    profileStatus === "REJECTED" ||
    profileStatus === "BLOCKED"
  ) {
    return profileStatus;
  }

  if (accountStatus === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (accountStatus === "SUSPENDED") return "BLOCKED";
  return "ACTIVE";
}

function readBooleanSetting(settings: unknown, key: string, fallback: boolean): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return fallback;
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : fallback;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: ReturnType<typeof buildAthleteRow>[]): string {
  const headers = [
    "matricula",
    "nome",
    "email",
    "status",
    "origem",
    "convidado_por",
    "matricula_convidante",
    "cidade",
    "estado",
    "data_associacao",
    "inscricoes",
    "pendente_centavos",
    "pago_centavos",
  ];

  const lines = rows.map((row) =>
    [
      row.memberNumber,
      row.name,
      row.email,
      row.status,
      row.signupSource,
      row.invitedByName,
      row.invitedByMemberNumber,
      row.city,
      row.state,
      row.memberSince,
      row.registrationsCount,
      row.pendingAmountCents,
      row.paidAmountCents,
    ]
      .map(csvValue)
      .join(";"),
  );

  return [headers.join(";"), ...lines].join("\n");
}

function buildAthleteRow(
  user: AthleteListUser,
  now: Date,
  inviteByAcceptedUserId: Map<
    string,
    {
      creatorName: string | null;
      creatorEmail: string | null;
      creatorMemberNumber: string | null;
    }
  >,
) {
  const payments = user.registrations.flatMap((registration) =>
    registration.payment ? [registration.payment] : [],
  );
  const recurringEntries = user.financial_entries_subject;

  const pendingAmountCents =
    payments
      .filter((payment) => payment.status === "PENDING")
      .reduce((sum, payment) => sum + payment.amount_cents, 0) +
    recurringEntries
      .filter((entry) => entry.status === "OPEN")
      .reduce((sum, entry) => sum + entry.amount_cents, 0);

  const paidAmountCents =
    payments
      .filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + payment.amount_cents, 0) +
    recurringEntries
      .filter((entry) => entry.status === "PAID")
      .reduce((sum, entry) => sum + entry.amount_cents, 0);

  const nextRegistration =
    user.registrations
      .filter((registration) => new Date(registration.event.event_date) >= now)
      .sort(
        (a, b) => new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime(),
      )[0] ?? null;

  const lastPayment =
    [
      ...payments
        .filter((payment) => payment.status === "PAID")
        .map((payment) => ({
          paidAt: payment.paid_at,
          createdAt: payment.created_at,
        })),
      ...recurringEntries
        .filter((entry) => entry.status === "PAID")
        .map((entry) => ({
          paidAt: entry.settled_at,
          createdAt: entry.created_at,
        })),
    ].sort((a, b) => {
      const aDate = a.paidAt ? new Date(a.paidAt) : new Date(a.createdAt);
      const bDate = b.paidAt ? new Date(b.paidAt) : new Date(b.createdAt);
      return bDate.getTime() - aDate.getTime();
    })[0] ?? null;

  const athleteStatus = resolveAthleteStatus(
    user.athlete_profile?.athlete_status,
    user.account_status,
  );
  const inviteSource = inviteByAcceptedUserId.get(user.id) ?? null;

  return {
    id: user.id,
    memberNumber: user.athlete_profile?.member_number ?? null,
    memberSequence: user.athlete_profile?.member_sequence ?? null,
    memberSince: user.athlete_profile?.member_since
      ? new Date(user.athlete_profile.member_since).toISOString()
      : null,
    createdAt: user.created_at.toISOString(),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url ?? null,
    status: athleteStatus,
    approvalPending: athleteStatus === "PENDING_APPROVAL",
    signupSource: user.athlete_profile?.signup_source ?? null,
    invitedByName: inviteSource?.creatorName ?? null,
    invitedByEmail: inviteSource?.creatorEmail ?? null,
    invitedByMemberNumber: inviteSource?.creatorMemberNumber ?? null,
    registrationsCount: user.registrations.length,
    nextEventName: nextRegistration?.event.name ?? null,
    nextEventDate: nextRegistration
      ? new Date(nextRegistration.event.event_date).toISOString()
      : null,
    pendingAmountCents,
    paidAmountCents,
    financialSituation: financialFromData(
      payments.length + recurringEntries.length,
      pendingAmountCents,
    ),
    lastPaymentAt: lastPayment?.paidAt ? new Date(lastPayment.paidAt).toISOString() : null,
    city: user.athlete_profile?.city ?? null,
    state: user.athlete_profile?.state ?? null,
    internalNote: null,
  };
}

function sortAthleteRows(
  rows: ReturnType<typeof buildAthleteRow>[],
  sortBy: AdminAthleteSortBy,
  sortDir: "asc" | "desc",
): ReturnType<typeof buildAthleteRow>[] {
  const direction = sortDir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * direction;
    }

    if (sortBy === "memberNumber") {
      const aValue = a.memberNumber ?? "";
      const bValue = b.memberNumber ?? "";
      return (
        aValue.localeCompare(bValue, "pt-BR", { numeric: true, sensitivity: "base" }) * direction
      );
    }

    if (sortBy === "registrations") {
      return (a.registrationsCount - b.registrationsCount) * direction;
    }

    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
  });
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) {
    return apiError("FORBIDDEN", "Somente time administrativo pode gerenciar atletas.", 403);
  }

  const parsed = querySchema.safeParse({
    q: req.nextUrl.searchParams.get("q") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    sortBy: req.nextUrl.searchParams.get("sortBy") ?? undefined,
    sortDir: req.nextUrl.searchParams.get("sortDir") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
    export: req.nextUrl.searchParams.get("export") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Query invalida.", 400);
  }

  const { q, status, sortBy, sortDir, page, pageSize } = parsed.data;
  const now = new Date();

  const [users, organization] = await Promise.all([
    prisma.user.findMany({
      where: {
        organization_id: auth.organizationId,
        role: UserRole.ATHLETE,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                {
                  athlete_profile: { is: { member_number: { contains: q, mode: "insensitive" } } },
                },
              ],
            }
          : {}),
      },
      include: {
        athlete_profile: {
          select: {
            athlete_status: true,
            signup_source: true,
            member_number: true,
            member_sequence: true,
            member_since: true,
            city: true,
            state: true,
          },
        },
        registrations: {
          where: { organization_id: auth.organizationId },
          include: {
            event: {
              select: {
                name: true,
                event_date: true,
              },
            },
            payment: {
              select: {
                status: true,
                amount_cents: true,
                paid_at: true,
                created_at: true,
              },
            },
          },
        },
        financial_entries_subject: {
          where: {
            organization_id: auth.organizationId,
            entry_kind: "RECEIVABLE",
          },
          select: {
            status: true,
            amount_cents: true,
            settled_at: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.organization.findUnique({
      where: { id: auth.organizationId },
      select: { slug: true, settings: true },
    }),
  ]);

  const acceptedUserIds = users.map((user) => user.id);
  const acceptedInvites = acceptedUserIds.length
    ? await prisma.organizationInvite.findMany({
        where: {
          organization_id: auth.organizationId,
          accepted_user_id: { in: acceptedUserIds },
          created_by: { not: null },
        },
        select: {
          accepted_user_id: true,
          created_by: true,
        },
      })
    : [];

  const creatorIds = Array.from(
    new Set(
      acceptedInvites.map((invite) => invite.created_by).filter((id): id is string => Boolean(id)),
    ),
  );
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds }, organization_id: auth.organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          athlete_profile: { select: { member_number: true } },
        },
      })
    : [];
  const creatorById = new Map(creators.map((creator) => [creator.id, creator]));
  const inviteByAcceptedUserId = new Map(
    acceptedInvites
      .filter((invite) => invite.accepted_user_id && invite.created_by)
      .map((invite) => {
        const creator = creatorById.get(invite.created_by ?? "");
        return [
          invite.accepted_user_id ?? "",
          {
            creatorName: creator?.name ?? null,
            creatorEmail: creator?.email ?? null,
            creatorMemberNumber: creator?.athlete_profile?.member_number ?? null,
          },
        ] as const;
      }),
  );

  const rows = users.map((user) => buildAthleteRow(user, now, inviteByAcceptedUserId));

  const filteredRows = rows.filter((row) => (status === "ALL" ? true : row.status === status));
  const sortedRows = sortAthleteRows(filteredRows, sortBy, sortDir);

  if (parsed.data.export === "csv") {
    return new NextResponse(toCsv(sortedRows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="associados-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const data = sortedRows.slice(start, start + pageSize);

  return NextResponse.json({
    data,
    summary: {
      totalAthletes: rows.length,
      active: rows.filter((row) => row.status === "ACTIVE").length,
      pendingApproval: rows.filter((row) => row.status === "PENDING_APPROVAL").length,
      rejected: rows.filter((row) => row.status === "REJECTED").length,
      blocked: rows.filter((row) => row.status === "BLOCKED").length,
      totalPendingCents: rows.reduce((sum, row) => sum + row.pendingAmountCents, 0),
      totalPaidCents: rows.reduce((sum, row) => sum + row.paidAmountCents, 0),
      withMemberNumber: rows.filter((row) => Boolean(row.memberNumber)).length,
      missingMemberNumber: rows.filter((row) => !row.memberNumber).length,
      invitedSignups: rows.filter((row) => row.signupSource === "INVITE").length,
      slugSignups: rows.filter((row) => row.signupSource === "SLUG").length,
      adminSignups: rows.filter((row) => row.signupSource === "ADMIN").length,
    },
    organizationPolicy: {
      slug: organization?.slug ?? "",
      allowAthleteSelfSignup: readBooleanSetting(
        organization?.settings,
        "allowAthleteSelfSignup",
        false,
      ),
      requireAthleteApproval: readBooleanSetting(
        organization?.settings,
        "requireAthleteApproval",
        true,
      ),
    },
    meta: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageAthletes(auth.role)) {
    return apiError("FORBIDDEN", "Somente admin pode cadastrar atletas.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const parsed = createAthleteByAdminSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.errors[0]?.message ?? "Dados invalidos.", 400);
  }

  const data = parsed.data;

  const existingByEmail = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true, organization_id: true },
  });

  if (existingByEmail) {
    if (existingByEmail.organization_id === auth.organizationId) {
      return apiError(
        "EMAIL_ALREADY_EXISTS",
        "Ja existe atleta com esse email nesta assessoria.",
        409,
      );
    }

    return apiError(
      "VALIDATION_ERROR",
      "Este email ja esta vinculado a outra assessoria e nao pode ser reutilizado.",
      409,
    );
  }

  if (data.cpf) {
    const existingCpf = await prisma.athleteProfile.findFirst({
      where: { cpf: data.cpf },
      select: { user_id: true, organization_id: true },
    });

    if (existingCpf) {
      if (existingCpf.organization_id === auth.organizationId) {
        return apiError("VALIDATION_ERROR", "CPF ja cadastrado nesta assessoria.", 409);
      }
      return apiError("VALIDATION_ERROR", "CPF ja vinculado a outra assessoria.", 409);
    }
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organization_id: auth.organizationId,
          name: data.name,
          email: data.email,
          password_hash: passwordHash,
          role: "ATHLETE",
          account_status: "ACTIVE",
          email_verified: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organization_id: true,
        },
      });

      await tx.athleteProfile.upsert({
        where: { user_id: user.id },
        update: {
          organization_id: auth.organizationId,
          athlete_status: "ACTIVE",
          signup_source: "ADMIN",
          onboarding_completed_at: data.cpf ? new Date() : null,
          cpf: data.cpf ?? null,
          phone: data.phone ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          birth_date: data.birthDate ? new Date(data.birthDate) : null,
          gender: data.gender ?? null,
          emergency_contact: data.emergencyContact ? { contact: data.emergencyContact } : undefined,
        },
        create: {
          user_id: user.id,
          organization_id: auth.organizationId,
          athlete_status: "ACTIVE",
          signup_source: "ADMIN",
          onboarding_completed_at: data.cpf ? new Date() : null,
          cpf: data.cpf ?? null,
          phone: data.phone ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          birth_date: data.birthDate ? new Date(data.birthDate) : null,
          gender: data.gender ?? null,
          emergency_contact: data.emergencyContact ? { contact: data.emergencyContact } : undefined,
        },
      });

      await ensureAthleteMemberNumber(tx, {
        organizationId: auth.organizationId,
        userId: user.id,
      });

      return user;
    });

    return NextResponse.json(
      {
        data: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          organizationId: created.organization_id,
          mode: data.mode,
          temporaryPassword,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (hasPrismaCode(error, "P2002")) {
      return apiError("VALIDATION_ERROR", "Conflito de dados: email ou CPF ja cadastrado.", 409);
    }

    return apiError("INTERNAL_ERROR", "Nao foi possivel cadastrar atleta.", 500);
  }
}
