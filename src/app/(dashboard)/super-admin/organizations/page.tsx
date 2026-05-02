"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";

type OrgPlan = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
type OrgStatus = "PENDING_SETUP" | "ACTIVE" | "SUSPENDED" | "TRIAL" | "CANCELLED";

interface SuperAdminOrganization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  status: OrgStatus;
  createdAt: string;
  usersCount: number;
  adminInvitesCount: number;
}

interface OrganizationsResponse {
  data: SuperAdminOrganization[];
}

const PLAN_OPTIONS: OrgPlan[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
const STATUS_OPTIONS: OrgStatus[] = ["PENDING_SETUP", "ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"];

function formatOrgStatus(status: OrgStatus): string {
  if (status === "PENDING_SETUP") return "Pendente setup";
  if (status === "ACTIVE") return "Ativa";
  if (status === "SUSPENDED") return "Suspensa";
  if (status === "TRIAL") return "Trial";
  return "Cancelada";
}

function formatPlan(plan: OrgPlan): string {
  if (plan === "FREE") return "Free";
  if (plan === "STARTER") return "Starter";
  if (plan === "PRO") return "Pro";
  return "Enterprise";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuperAdminOrganizationsPage() {
  const { accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((organization) => {
      return (
        organization.name.toLowerCase().includes(term) ||
        organization.slug.toLowerCase().includes(term) ||
        organization.status.toLowerCase().includes(term) ||
        organization.plan.toLowerCase().includes(term)
      );
    });
  }, [organizations, search]);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/super-admin/organizations", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store",
      });

      const payload = (await response.json()) as
        | OrganizationsResponse
        | { error?: { message?: string } };
      if (!response.ok || !("data" in payload)) {
        setError(
          "error" in payload
            ? (payload.error?.message ?? "Falha ao carregar organizacoes.")
            : "Falha ao carregar organizacoes.",
        );
        return;
      }

      setOrganizations(payload.data);
    } catch {
      setError("Falha de conexao ao carregar organizacoes.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void loadOrganizations();
  }, [accessToken, loadOrganizations]);

  const patchOrganization = async (
    organizationId: string,
    changes: { status?: OrgStatus; plan?: OrgPlan },
  ) => {
    setSavingId(organizationId);
    setError(null);
    try {
      const response = await fetch(`/api/super-admin/organizations/${organizationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(changes),
      });

      const payload = (await response.json()) as
        | {
            data: Pick<
              SuperAdminOrganization,
              "id" | "name" | "slug" | "status" | "plan" | "createdAt"
            >;
          }
        | { error?: { message?: string } };

      if (!response.ok || !("data" in payload)) {
        setError(
          "error" in payload
            ? (payload.error?.message ?? "Falha ao atualizar organizacao.")
            : "Falha ao atualizar organizacao.",
        );
        return;
      }

      setOrganizations((current) =>
        current.map((item) =>
          item.id === organizationId
            ? {
                ...item,
                name: payload.data.name,
                slug: payload.data.slug,
                status: payload.data.status,
                plan: payload.data.plan,
                createdAt: payload.data.createdAt,
              }
            : item,
        ),
      );
    } catch {
      setError("Falha de conexao ao atualizar organizacao.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="space-y-6 p-6">
      <header className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/90 p-6">
        <h1 className="text-2xl font-semibold text-white">Organizacoes da plataforma</h1>
        <p className="mt-2 text-sm text-slate-300">
          Controle de status, plano e saude basica dos tenants ativos no SaaS.
        </p>
      </header>

      <section className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, slug, status ou plano"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadOrganizations()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Tenants cadastrados</h2>
          <p className="text-xs text-slate-400">Visao minima para operacao de plataforma</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando organizacoes...
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-300">
            Nenhuma organizacao encontrada para o filtro informado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-100">
              <thead className="bg-[#0F2743] text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">Organizacao</th>
                  <th className="px-4 py-3 text-left">Slug</th>
                  <th className="px-4 py-3 text-left">Plano</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Usuarios</th>
                  <th className="px-4 py-3 text-left">Convites admin</th>
                  <th className="px-4 py-3 text-left">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrganizations.map((organization) => {
                  const isSaving = savingId === organization.id;
                  return (
                    <tr key={organization.id} className="border-t border-white/10">
                      <td className="px-4 py-3 font-medium text-white">{organization.name}</td>
                      <td className="px-4 py-3 text-slate-300">{organization.slug}</td>
                      <td className="px-4 py-3">
                        <select
                          value={organization.plan}
                          disabled={isSaving}
                          onChange={(event) => {
                            void patchOrganization(organization.id, {
                              plan: event.target.value as OrgPlan,
                            });
                          }}
                          className="rounded-md border border-white/15 bg-[#0F2743] px-2 py-1 text-xs text-white outline-none disabled:opacity-60"
                        >
                          {PLAN_OPTIONS.map((plan) => (
                            <option key={plan} value={plan}>
                              {formatPlan(plan)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={organization.status}
                          disabled={isSaving}
                          onChange={(event) => {
                            void patchOrganization(organization.id, {
                              status: event.target.value as OrgStatus,
                            });
                          }}
                          className="rounded-md border border-white/15 bg-[#0F2743] px-2 py-1 text-xs text-white outline-none disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {formatOrgStatus(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{organization.usersCount}</td>
                      <td className="px-4 py-3 text-slate-300">{organization.adminInvitesCount}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatDate(organization.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
