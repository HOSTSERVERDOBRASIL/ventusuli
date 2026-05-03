"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, RefreshCw, Search } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { roleLabel } from "@/lib/role-labels";

interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
}

interface AdminInvite {
  id: string;
  organizationId: string;
  email: string;
  role: "ADMIN" | "FINANCE" | "COACH" | "ATHLETE" | "SUPER_ADMIN";
  active: boolean;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  token: string;
  activationLink: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
  };
}

interface InvitesResponse {
  data: AdminInvite[];
}

interface OrganizationsResponse {
  data: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInviteState(invite: AdminInvite): { label: string; tone: string } {
  if (invite.acceptedAt) {
    return { label: "Aceito", tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" };
  }

  if (!invite.active) {
    return { label: "Inativo", tone: "border-slate-500/40 bg-slate-600/10 text-slate-300" };
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return { label: "Expirado", tone: "border-amber-400/40 bg-amber-500/10 text-amber-200" };
  }

  return { label: "Ativo", tone: "border-sky-400/40 bg-sky-500/10 text-sky-200" };
}

export default function SuperAdminAdminInvitesPage() {
  const { accessToken } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [form, setForm] = useState({
    organizationId: "",
    email: "",
    role: "ADMIN" as "ADMIN" | "FINANCE" | "COACH",
    expiresInDays: 14,
  });

  const filteredInvites = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invites;
    return invites.filter((invite) => {
      return (
        invite.email.toLowerCase().includes(term) ||
        invite.organization.name.toLowerCase().includes(term) ||
        invite.organization.slug.toLowerCase().includes(term)
      );
    });
  }, [invites, search]);

  const loadOrganizations = useCallback(async () => {
    const response = await fetch("/api/super-admin/organizations", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: "no-store",
    });

    const payload = (await response.json()) as
      | OrganizationsResponse
      | { error?: { message?: string } };
    if (!response.ok || !("data" in payload)) {
      throw new Error(
        "error" in payload
          ? (payload.error?.message ?? "Falha ao carregar organizacoes.")
          : "Falha ao carregar organizacoes.",
      );
    }

    const options: OrganizationOption[] = payload.data.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    }));

    setOrganizations(options);
    setForm((current) =>
      !current.organizationId && options[0]
        ? { ...current, organizationId: options[0].id }
        : current,
    );
  }, [accessToken]);

  const loadInvites = useCallback(async () => {
    const response = await fetch("/api/super-admin/organization-invites", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: "no-store",
    });

    const payload = (await response.json()) as InvitesResponse | { error?: { message?: string } };
    if (!response.ok || !("data" in payload)) {
      throw new Error(
        "error" in payload
          ? (payload.error?.message ?? "Falha ao carregar convites.")
          : "Falha ao carregar convites.",
      );
    }

    setInvites(payload.data);
  }, [accessToken]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      await Promise.all([loadOrganizations(), loadInvites()]);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Falha ao carregar dados de convites.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadInvites, loadOrganizations]);

  useEffect(() => {
    if (!accessToken) return;
    void bootstrap();
  }, [accessToken, bootstrap]);

  const createInvite = async () => {
    if (!form.organizationId || !form.email.trim()) {
      setError("Selecione a organizacao e informe email valido.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/super-admin/organization-invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          organizationId: form.organizationId,
          email: form.email.trim().toLowerCase(),
          role: form.role,
          expiresInDays: form.expiresInDays,
        }),
      });

      const payload = (await response.json()) as {
        data?: AdminInvite;
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "Falha ao criar convite.");
        return;
      }

      setInvites((current) => [payload.data as AdminInvite, ...current]);
      setForm((current) => ({ ...current, email: "", expiresInDays: 14 }));
      setFeedback("Convite criado com sucesso.");
    } catch {
      setError("Falha de conexao ao criar convite.");
    } finally {
      setSaving(false);
    }
  };

  const patchInviteState = async (inviteId: string, active: boolean) => {
    setRowActionId(inviteId);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(`/api/super-admin/organization-invites/${inviteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ active }),
      });

      const payload = (await response.json()) as {
        data?: AdminInvite;
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "Falha ao atualizar estado do convite.");
        return;
      }

      setInvites((current) =>
        current.map((item) => (item.id === inviteId ? (payload.data as AdminInvite) : item)),
      );
      setFeedback(active ? "Convite reativado." : "Convite desativado.");
    } catch {
      setError("Falha de conexao ao atualizar estado do convite.");
    } finally {
      setRowActionId(null);
    }
  };

  const resendInvite = async (inviteId: string) => {
    setRowActionId(inviteId);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch(`/api/super-admin/organization-invites/${inviteId}/resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ expiresInDays: 14 }),
      });

      const payload = (await response.json()) as {
        data?: AdminInvite;
        error?: { message?: string };
      };
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "Falha ao reenviar convite.");
        return;
      }

      setInvites((current) =>
        current.map((item) => (item.id === inviteId ? (payload.data as AdminInvite) : item)),
      );
      setFeedback("Convite reenviado com novo link de ativacao.");
    } catch {
      setError("Falha de conexao ao reenviar convite.");
    } finally {
      setRowActionId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Link de ativacao copiado.");
    } catch {
      setError("Nao foi possivel copiar o link.");
    }
  };

  return (
    <main className="space-y-6 p-6">
      <header className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/90 p-6">
        <h1 className="text-2xl font-semibold text-white">Convites administrativos</h1>
        <p className="mt-2 text-sm text-slate-300">
          Crie e mantenha convites de administradores da assessoria com estado real.
        </p>
      </header>

      <section className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80 p-5">
        <h2 className="text-base font-semibold text-white">Novo convite</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={form.organizationId}
            onChange={(event) =>
              setForm((current) => ({ ...current, organizationId: event.target.value }))
            }
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name} ({organization.slug})
              </option>
            ))}
          </select>
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
            placeholder="admin@empresa.com"
          />
          <select
            value={form.role}
            onChange={(event) =>
              setForm((current) => ({ ...current, role: event.target.value as "ADMIN" | "FINANCE" | "COACH" }))
            }
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
          >
            <option value="ADMIN">Administrador</option>
            <option value="FINANCE">Financeiro</option>
            <option value="COACH">Treinador</option>
          </select>
          <input
            type="number"
            min={1}
            max={90}
            value={form.expiresInDays}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                expiresInDays: Number(event.target.value || 14),
              }))
            }
            className="rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
            placeholder="Validade em dias"
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void createInvite()}
            className="rounded-lg bg-[#F5A623] px-4 py-2 text-sm font-semibold text-[#0A1628] transition hover:bg-[#e39a1f] disabled:opacity-60"
          >
            {saving ? "Criando..." : "Criar convite"}
          </button>
          <button
            type="button"
            onClick={() => void bootstrap()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/5"
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
      {feedback ? (
        <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {feedback}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80 p-4">
        <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#0F2743] px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por email, organizacao ou slug"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Convites</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando convites...
          </div>
        ) : filteredInvites.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-300">
            Nenhum convite encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-100">
              <thead className="bg-[#0F2743] text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Organizacao</th>
                  <th className="px-4 py-3 text-left">Perfil</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Expira em</th>
                  <th className="px-4 py-3 text-left">Aceito em</th>
                  <th className="px-4 py-3 text-left">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.map((invite) => {
                  const state = getInviteState(invite);
                  const inProgress = rowActionId === invite.id;
                  return (
                    <tr key={invite.id} className="border-t border-white/10 align-top">
                      <td className="px-4 py-3 font-medium text-white">{invite.email}</td>
                      <td className="px-4 py-3 text-slate-300">
                        <p>{invite.organization.name}</p>
                        <p className="text-xs text-slate-400">{invite.organization.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{roleLabel(invite.role)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-xs ${state.tone}`}
                        >
                          {state.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(invite.expiresAt)}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(invite.acceptedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={inProgress}
                            onClick={() => void copyToClipboard(invite.activationLink)}
                            className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/5 disabled:opacity-60"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar link
                          </button>
                          {!invite.acceptedAt ? (
                            <button
                              type="button"
                              disabled={inProgress}
                              onClick={() => void resendInvite(invite.id)}
                              className="rounded-md border border-sky-400/40 px-2 py-1 text-xs text-sky-200 hover:bg-sky-500/10 disabled:opacity-60"
                            >
                              Reenviar
                            </button>
                          ) : null}
                          {!invite.acceptedAt ? (
                            <button
                              type="button"
                              disabled={inProgress}
                              onClick={() => void patchInviteState(invite.id, !invite.active)}
                              className="rounded-md border border-amber-400/40 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/10 disabled:opacity-60"
                            >
                              {invite.active ? "Desativar" : "Reativar"}
                            </button>
                          ) : null}
                        </div>
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
