"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

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

interface CreateOrganizationResponse {
  data: {
    organization: {
      id: string;
      name: string;
      slug: string;
      plan: OrgPlan;
      status: OrgStatus;
      createdAt: string;
    };
    adminInvite: {
      id: string;
      email: string;
      activationLink: string;
      expiresAt: string | null;
    };
  };
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

export default function SuperAdminPage() {
  const { accessToken, userRole } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastActivationLink, setLastActivationLink] = useState<string | null>(null);
  const [lastInviteEmail, setLastInviteEmail] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<SuperAdminOrganization[]>([]);
  const [form, setForm] = useState({
    orgName: "",
    orgSlug: "",
    adminEmail: "",
    inviteExpiresInDays: 14,
    plan: "FREE" as OrgPlan,
  });

  const sortedOrganizations = useMemo(
    () =>
      [...organizations].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [organizations],
  );

  const loadOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/super-admin/organizations", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store",
      });

      const payload = (await response.json()) as OrganizationsResponse | { error?: { message?: string } };
      if (!response.ok || !("data" in payload)) {
        setError(
          "error" in payload
            ? (payload.error?.message ?? "Falha ao carregar assessorias.")
            : "Falha ao carregar assessorias.",
        );
        return;
      }

      setOrganizations(payload.data);
    } catch {
      setError("Falha de conexao ao carregar assessorias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    if (userRole !== UserRole.SUPER_ADMIN) return;
    void loadOrganizations();
  }, [accessToken, userRole]);

  const createOrganization = async () => {
    if (!form.orgName.trim() || !form.adminEmail.trim()) {
      setError("Nome da assessoria e email do admin sao obrigatorios.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/super-admin/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          orgName: form.orgName.trim(),
          orgSlug: form.orgSlug.trim() || undefined,
          adminEmail: form.adminEmail.trim().toLowerCase(),
          inviteExpiresInDays: form.inviteExpiresInDays,
          plan: form.plan,
        }),
      });

      const payload = (await response.json()) as CreateOrganizationResponse | { error?: { message?: string } };
      if (!response.ok || !("data" in payload)) {
        setError(
          "error" in payload
            ? (payload.error?.message ?? "Falha ao criar assessoria.")
            : "Falha ao criar assessoria.",
        );
        return;
      }

      setLastActivationLink(payload.data.adminInvite.activationLink);
      setLastInviteEmail(payload.data.adminInvite.email);

      setForm({
        orgName: "",
        orgSlug: "",
        adminEmail: "",
        inviteExpiresInDays: 14,
        plan: "FREE",
      });
      await loadOrganizations();
    } catch {
      setError("Falha de conexao ao criar assessoria.");
    } finally {
      setSaving(false);
    }
  };

  const patchOrganization = async (organizationId: string, changes: { plan?: OrgPlan; status?: OrgStatus }) => {
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
        | { data: SuperAdminOrganization }
        | { error?: { message?: string } };

      if (!response.ok || !("data" in payload)) {
        setError(
          "error" in payload
            ? (payload.error?.message ?? "Falha ao atualizar assessoria.")
            : "Falha ao atualizar assessoria.",
        );
        return;
      }

      setOrganizations((current) =>
        current.map((item) => (item.id === organizationId ? { ...item, ...payload.data } : item)),
      );
    } catch {
      setError("Falha de conexao ao atualizar assessoria.");
    }
  };

  if (userRole && userRole !== UserRole.SUPER_ADMIN) {
    return (
      <main className="p-6 text-slate-200">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          Esta area e exclusiva para SUPER_ADMIN.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <header className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/90 p-6">
        <h1 className="text-2xl font-semibold text-white">Centro SUPER_ADMIN</h1>
        <p className="mt-2 text-sm text-slate-300">
          Cadastre assessorias, controle status operacional e defina planos comerciais.
        </p>
      </header>

      <section className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80 p-5">
        <h2 className="text-base font-semibold text-white">Nova assessoria</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={form.orgName}
            onChange={(e) => setForm((prev) => ({ ...prev, orgName: e.target.value }))}
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
            placeholder="Nome da assessoria"
          />
          <input
            value={form.orgSlug}
            onChange={(e) => setForm((prev) => ({ ...prev, orgSlug: e.target.value }))}
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
            placeholder="Slug (opcional)"
          />
          <input
            value={form.adminEmail}
            onChange={(e) => setForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
            placeholder="Email do admin"
          />
          <select
            value={form.plan}
            onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value as OrgPlan }))}
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
          >
            {PLAN_OPTIONS.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={90}
            value={form.inviteExpiresInDays}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                inviteExpiresInDays: Number(e.target.value || 14),
              }))
            }
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
            placeholder="Validade convite (dias)"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void createOrganization()}
            disabled={saving}
            className="rounded-lg bg-[#F5A623] px-4 py-2 text-sm font-semibold text-[#0A1628] transition hover:bg-[#e39a1f] disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar assessoria"}
          </button>
          <button
            type="button"
            onClick={() => void loadOrganizations()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
        {lastActivationLink ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            <p className="font-semibold">Convite gerado para {lastInviteEmail}</p>
            <p className="mt-1 break-all text-emerald-200/90">{lastActivationLink}</p>
          </div>
        ) : null}
      </section>

      {error ? (
        <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Assessorias cadastradas</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-100">
              <thead className="bg-[#0F2743] text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">Assessoria</th>
                  <th className="px-4 py-3 text-left">Slug</th>
                  <th className="px-4 py-3 text-left">Plano</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Usuarios</th>
                  <th className="px-4 py-3 text-left">Convites Admin</th>
                  <th className="px-4 py-3 text-left">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrganizations.map((organization) => (
                  <tr key={organization.id} className="border-t border-white/10">
                    <td className="px-4 py-3 font-medium">{organization.name}</td>
                    <td className="px-4 py-3 text-slate-300">{organization.slug}</td>
                    <td className="px-4 py-3">
                      <select
                        value={organization.plan}
                        onChange={(e) => {
                          void patchOrganization(organization.id, { plan: e.target.value as OrgPlan });
                        }}
                        className="rounded-md border border-white/15 bg-[#0F2743] px-2 py-1 text-xs text-white outline-none"
                      >
                        {PLAN_OPTIONS.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={organization.status}
                        onChange={(e) => {
                          void patchOrganization(organization.id, { status: e.target.value as OrgStatus });
                        }}
                        className="rounded-md border border-white/15 bg-[#0F2743] px-2 py-1 text-xs text-white outline-none"
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
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void patchOrganization(organization.id, { status: "ACTIVE" })}
                          className="rounded-md border border-emerald-400/40 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                        >
                          Ativar
                        </button>
                        <button
                          type="button"
                          onClick={() => void patchOrganization(organization.id, { status: "SUSPENDED" })}
                          className="rounded-md border border-amber-400/40 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10"
                        >
                          Suspender
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedOrganizations.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-300" colSpan={7}>
                      Nenhuma assessoria cadastrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
