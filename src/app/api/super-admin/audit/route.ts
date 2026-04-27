import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext, isSuperAdminRole } from "@/lib/request-auth";

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!isSuperAdminRole(auth.role)) return apiError("FORBIDDEN", "Acesso restrito ao SUPER_ADMIN.", 403);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    organizations,
    recentUsers,
    recentInvites,
    recentInvoices,
    stravaLogs,
    pointMovements,
    activeRefreshTokens,
  ] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { created_at: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        created_at: true,
        _count: { select: { users: true, payments: true, reward_redemptions: true } },
      },
    }),
    prisma.user.findMany({
      where: { created_at: { gte: thirtyDaysAgo } },
      orderBy: { created_at: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        account_status: true,
        last_login_at: true,
        created_at: true,
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.adminActivationInvite.findMany({
      orderBy: { created_at: "desc" },
      take: 12,
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        expires_at: true,
        accepted_at: true,
        created_at: true,
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.platformBillingInvoice.findMany({
      orderBy: [{ due_at: "desc" }, { created_at: "desc" }],
      take: 12,
      select: {
        id: true,
        status: true,
        amount_cents: true,
        due_at: true,
        paid_at: true,
        created_at: true,
        created_by: true,
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.stravaSyncLog.findMany({
      orderBy: { created_at: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        trigger: true,
        object_type: true,
        aspect_type: true,
        error_message: true,
        created_at: true,
        processed_at: true,
        organization: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.athletePointLedger.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        type: true,
        sourceType: true,
        points: true,
        balanceAfter: true,
        description: true,
        referenceCode: true,
        createdBy: true,
        createdAt: true,
        organization: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.refreshToken.count({
      where: {
        revoked: false,
        expires_at: { gt: now },
      },
    }),
  ]);

  const summary = {
    organizations: organizations.length,
    usersCreated30d: recentUsers.length,
    openPlatformInvoices: recentInvoices.filter((item) => item.status === "OPEN").length,
    stravaFailures: stravaLogs.filter((item) => item.status === "FAILED").length,
    activeSessions: activeRefreshTokens,
  };

  return NextResponse.json({
    summary,
    organizations: organizations.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      status: item.status,
      plan: item.plan,
      createdAt: iso(item.created_at),
      usersCount: item._count.users,
      paymentsCount: item._count.payments,
      redemptionsCount: item._count.reward_redemptions,
    })),
    recentUsers: recentUsers.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      accountStatus: item.account_status,
      lastLoginAt: iso(item.last_login_at),
      createdAt: iso(item.created_at),
      organization: item.organization,
    })),
    recentInvites: recentInvites.map((item) => ({
      id: item.id,
      email: item.email,
      role: item.role,
      active: item.active,
      acceptedAt: iso(item.accepted_at),
      expiresAt: iso(item.expires_at),
      createdAt: iso(item.created_at),
      organization: item.organization,
    })),
    recentInvoices: recentInvoices.map((item) => ({
      id: item.id,
      status: item.status,
      amountCents: item.amount_cents,
      dueAt: iso(item.due_at),
      paidAt: iso(item.paid_at),
      createdAt: iso(item.created_at),
      createdBy: item.created_by,
      organization: item.organization,
    })),
    stravaLogs: stravaLogs.map((item) => ({
      id: item.id,
      status: item.status,
      trigger: item.trigger,
      objectType: item.object_type,
      aspectType: item.aspect_type,
      errorMessage: item.error_message,
      createdAt: iso(item.created_at),
      processedAt: iso(item.processed_at),
      organization: item.organization,
      user: item.user,
    })),
    pointMovements: pointMovements.map((item) => ({
      id: item.id,
      type: item.type,
      sourceType: item.sourceType,
      points: item.points,
      balanceAfter: item.balanceAfter,
      description: item.description,
      referenceCode: item.referenceCode,
      createdBy: item.createdBy,
      createdAt: iso(item.createdAt),
      organization: item.organization,
      user: item.user,
    })),
    coverage: [
      {
        area: "Financeiro",
        status: "Parcial",
        detail: "Pagamentos guardam historico operacional no payload e lancamentos manuais mantem criador e datas.",
      },
      {
        area: "Pontos",
        status: "Ativo",
        detail: "Ledger registra origem, referencia, usuario, saldo apos movimento e responsavel.",
      },
      {
        area: "Integracoes",
        status: "Ativo",
        detail: "Sincronizacoes Strava possuem log de processamento, erro e idempotencia.",
      },
      {
        area: "Auditoria dedicada",
        status: "Pendente",
        detail: "Ainda falta uma tabela unica de AuditLog para registrar toda mutacao administrativa.",
      },
    ],
  });
}
