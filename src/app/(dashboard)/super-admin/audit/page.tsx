"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { MetricCard } from "@/components/system/metric-card";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Button } from "@/components/ui/button";

interface AuditResponse {
  summary: {
    organizations: number;
    usersCreated30d: number;
    openPlatformInvoices: number;
    stravaFailures: number;
    activeSessions: number;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    accountStatus: string;
    lastLoginAt: string | null;
    createdAt: string | null;
    organization: { name: string; slug: string };
  }>;
  recentInvites: Array<{
    id: string;
    email: string;
    role: string;
    active: boolean;
    acceptedAt: string | null;
    expiresAt: string | null;
    createdAt: string | null;
    organization: { name: string; slug: string };
  }>;
  recentInvoices: Array<{
    id: string;
    status: string;
    amountCents: number;
    dueAt: string | null;
    paidAt: string | null;
    organization: { name: string; slug: string };
  }>;
  stravaLogs: Array<{
    id: string;
    status: string;
    trigger: string;
    objectType: string;
    aspectType: string;
    errorMessage: string | null;
    createdAt: string | null;
    organization: { name: string; slug: string } | null;
    user: { name: string; email: string } | null;
  }>;
  pointMovements: Array<{
    id: string;
    type: string;
    sourceType: string;
    points: number;
    balanceAfter: number;
    description: string;
    referenceCode: string;
    createdAt: string | null;
    organization: { name: string; slug: string };
    user: { name: string; email: string };
  }>;
  coverage: Array<{ area: string; status: string; detail: string }>;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: string): "positive" | "warning" | "danger" | "neutral" {
  if (["ACTIVE", "PAID", "PROCESSED", "Ativo"].includes(status)) return "positive";
  if (["OPEN", "RECEIVED", "Parcial", "Pendente"].includes(status)) return "warning";
  if (["FAILED", "SUSPENDED", "CANCELLED"].includes(status)) return "danger";
  return "neutral";
}

export default function SuperAdminAuditPage() {
  const { accessToken } = useAuthToken();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/super-admin/audit", {
        cache: "no-store",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const payload = (await response.json()) as AuditResponse | { error?: { message?: string } };
      if (!response.ok || !("summary" in payload)) {
        throw new Error(
          "error" in payload ? (payload.error?.message ?? "Falha ao carregar auditoria.") : "Falha ao carregar auditoria.",
        );
      }
      setData(payload);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar auditoria.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void load();
  }, [accessToken, load]);

  const userColumns = useMemo<DataTableColumn<AuditResponse["recentUsers"][number]>[]>(
    () => [
      { key: "user", header: "Usuario", cell: (row) => <span className="font-medium text-white">{row.name}</span> },
      { key: "role", header: "Perfil", cell: (row) => row.role },
      { key: "org", header: "Assessoria", cell: (row) => row.organization.name },
      {
        key: "status",
        header: "Status",
        cell: (row) => <StatusBadge tone={statusTone(row.accountStatus)} label={row.accountStatus} />,
      },
      { key: "created", header: "Criado em", cell: (row) => formatDate(row.createdAt) },
      { key: "login", header: "Ultimo login", cell: (row) => formatDate(row.lastLoginAt) },
    ],
    [],
  );

  const invoiceColumns = useMemo<DataTableColumn<AuditResponse["recentInvoices"][number]>[]>(
    () => [
      { key: "org", header: "Assessoria", cell: (row) => row.organization.name },
      { key: "amount", header: "Valor", cell: (row) => BRL.format(row.amountCents / 100) },
      {
        key: "status",
        header: "Status",
        cell: (row) => <StatusBadge tone={statusTone(row.status)} label={row.status} />,
      },
      { key: "due", header: "Vencimento", cell: (row) => formatDate(row.dueAt) },
      { key: "paid", header: "Pago em", cell: (row) => formatDate(row.paidAt) },
    ],
    [],
  );

  const pointColumns = useMemo<DataTableColumn<AuditResponse["pointMovements"][number]>[]>(
    () => [
      { key: "athlete", header: "Atleta", cell: (row) => row.user.name },
      { key: "source", header: "Origem", cell: (row) => row.sourceType },
      { key: "points", header: "Pontos", cell: (row) => `${row.points} pts` },
      { key: "balance", header: "Saldo apos", cell: (row) => `${row.balanceAfter} pts` },
      { key: "ref", header: "Referencia", cell: (row) => row.referenceCode },
      { key: "date", header: "Data", cell: (row) => formatDate(row.createdAt) },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria da Plataforma"
        subtitle="Visao consolidada dos rastros operacionais disponiveis no sistema."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      {loading ? (
        <LoadingState lines={6} />
      ) : error ? (
        <EmptyState title="Auditoria indisponivel" description={error} />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Assessorias recentes" value={data.summary.organizations} />
            <MetricCard label="Usuarios 30 dias" value={data.summary.usersCreated30d} />
            <MetricCard label="Faturas abertas" value={data.summary.openPlatformInvoices} />
            <MetricCard label="Falhas Strava" value={data.summary.stravaFailures} tone="highlight" />
            <MetricCard label="Sessoes ativas" value={data.summary.activeSessions} />
          </div>

          <SectionCard title="Cobertura de auditoria" description="O que ja fica rastreado e o que ainda precisa de tabela dedicada">
            <div className="grid gap-3 md:grid-cols-2">
              {data.coverage.map((item) => (
                <div key={item.area} className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{item.area}</p>
                    <StatusBadge tone={statusTone(item.status)} label={item.status} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Usuarios recentes" description="Criacoes de conta e ultimo login por assessoria">
            <DataTable columns={userColumns} data={data.recentUsers} getRowKey={(row) => row.id} />
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Faturas da plataforma" description="Trilha financeira entre plataforma e assessorias">
              <DataTable columns={invoiceColumns} data={data.recentInvoices} getRowKey={(row) => row.id} />
            </SectionCard>

            <SectionCard title="Movimentos de pontos" description="Lancamentos recentes do ledger multi-assessoria">
              <DataTable columns={pointColumns} data={data.pointMovements} getRowKey={(row) => row.id} />
            </SectionCard>
          </div>

          <SectionCard title="Convites e integracoes" description="Sinais de acesso administrativo e sincronizacoes externas">
            <div className="grid gap-3 xl:grid-cols-2">
              <div className="space-y-2">
                {data.recentInvites.map((invite) => (
                  <div key={invite.id} className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{invite.email}</p>
                      <StatusBadge tone={invite.acceptedAt ? "positive" : invite.active ? "warning" : "neutral"} label={invite.acceptedAt ? "Aceito" : invite.active ? "Ativo" : "Inativo"} />
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {invite.organization.name} - {invite.role} - criado em {formatDate(invite.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {data.stravaLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-white/10 bg-[#0f233d] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{log.objectType} / {log.aspectType}</p>
                      <StatusBadge tone={statusTone(log.status)} label={log.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      {log.organization?.name ?? "Sem assessoria"} - {formatDate(log.createdAt)}
                    </p>
                    {log.errorMessage ? <p className="mt-1 text-xs text-red-200">{log.errorMessage}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
