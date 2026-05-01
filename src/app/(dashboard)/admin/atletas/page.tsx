"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Download, RefreshCw, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AthletesCrmTable } from "@/components/athletes/athletes-crm-table";
import { AthletesSummaryCards } from "@/components/athletes/athletes-summary-cards";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createAdminInvite,
  buildAdminAthletesExportUrl,
  getAdminAthletes,
  listAdminInvites,
  resendAdminInvite,
  updateAdminAthleteStatus,
} from "@/services/admin-athletes-service";
import {
  AdminAthleteInvite,
  AdminAthleteInviteSummary,
  AdminAthletePolicy,
  AthleteListRow,
  AthletesListSummary,
} from "@/services/types";

const EMPTY_SUMMARY: AthletesListSummary = {
  totalAthletes: 0,
  active: 0,
  pendingApproval: 0,
  rejected: 0,
  blocked: 0,
  totalPendingCents: 0,
  totalPaidCents: 0,
  withMemberNumber: 0,
  missingMemberNumber: 0,
  invitedSignups: 0,
  slugSignups: 0,
  adminSignups: 0,
};

const EMPTY_POLICY: AdminAthletePolicy = {
  slug: "",
  allowAthleteSelfSignup: false,
  requireAthleteApproval: true,
};

const EMPTY_INVITE_SUMMARY: AdminAthleteInviteSummary = {
  total: 0,
  available: 0,
  used: 0,
  expired: 0,
  athleteReferral: 0,
  adminGeneral: 0,
};

type AthleteStatusFilter = "ALL" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
type AthletesTab = "overview" | "pipeline" | "invites" | "reports";

export default function AdminAtletasPage() {
  const { accessToken } = useAuthToken();

  const [rows, setRows] = useState<AthleteListRow[]>([]);
  const [summary, setSummary] = useState<AthletesListSummary>(EMPTY_SUMMARY);
  const [policy, setPolicy] = useState<AdminAthletePolicy>(EMPTY_POLICY);
  const [invites, setInvites] = useState<AdminAthleteInvite[]>([]);
  const [inviteSummary, setInviteSummary] =
    useState<AdminAthleteInviteSummary>(EMPTY_INVITE_SUMMARY);
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);

  const [status, setStatus] = useState<AthleteStatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteReusable, setInviteReusable] = useState(false);
  const [inviteMaxUses, setInviteMaxUses] = useState("1");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AthletesTab>("overview");

  const statusCards = useMemo(
    () => [
      { key: "ALL" as const, label: "Todos", value: summary.totalAthletes },
      { key: "PENDING_APPROVAL" as const, label: "Pendentes", value: summary.pendingApproval },
      { key: "ACTIVE" as const, label: "Ativos", value: summary.active },
      { key: "REJECTED" as const, label: "Rejeitados", value: summary.rejected },
      { key: "BLOCKED" as const, label: "Bloqueados", value: summary.blocked },
    ],
    [summary],
  );

  const tabs = useMemo<ModuleTabItem<AthletesTab>[]>(
    () => [
      {
        key: "overview",
        label: "Painel",
        audience: "Gestao",
        description: "Resumo da base, politicas e situacao dos associados.",
        icon: Users,
        metricLabel: "Associados",
        metricValue: summary.totalAthletes,
        metricTone: "info",
      },
      {
        key: "pipeline",
        label: "Fila",
        audience: "Operacao",
        description: "Aprovacoes, bloqueios, busca e lista operacional.",
        icon: RefreshCw,
        metricLabel: "Pendentes",
        metricValue: summary.pendingApproval,
        metricTone: summary.pendingApproval > 0 ? "warning" : "positive",
      },
      {
        key: "invites",
        label: "Convites",
        audience: "Cadastro",
        description: "Links gerais, individuais e convites de associados.",
        icon: UserPlus,
        metricLabel: "Disponiveis",
        metricValue: inviteSummary.available,
        metricTone: inviteSummary.available > 0 ? "positive" : "neutral",
      },
      {
        key: "reports",
        label: "Relatorios",
        audience: "Diretoria",
        description: "Matriculas, origem de cadastro e exportacao CSV.",
        icon: Download,
        metricLabel: "Sem matricula",
        metricValue: summary.missingMemberNumber ?? 0,
        metricTone: (summary.missingMemberNumber ?? 0) > 0 ? "warning" : "positive",
      },
    ],
    [inviteSummary.available, summary],
  );

  const refreshAthletes = async () => {
    setLoadingAthletes(true);
    try {
      const payload = await getAdminAthletes({
        q: query || undefined,
        status,
        page: 1,
        pageSize: 50,
        accessToken,
      });

      setRows(payload.data);
      setSummary(payload.summary);
      setPolicy(payload.organizationPolicy);
    } catch (error) {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      toast.error(error instanceof Error ? error.message : "Falha ao carregar atletas.");
    } finally {
      setLoadingAthletes(false);
    }
  };

  const refreshInvites = async () => {
    setLoadingInvites(true);
    try {
      const payload = await listAdminInvites(accessToken);
      setInvites(payload.data);
      setInviteSummary(payload.summary);
      setPolicy(payload.policy);
    } catch (error) {
      setInvites([]);
      setInviteSummary(EMPTY_INVITE_SUMMARY);
      toast.error(error instanceof Error ? error.message : "Falha ao carregar convites.");
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    void refreshAthletes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, query, status]);

  useEffect(() => {
    void refreshInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const applyStatusAction = async (
    athleteId: string,
    action: "APPROVE" | "REJECT" | "BLOCK",
    successMessage: string,
  ) => {
    try {
      setStatusActionId(`${athleteId}:${action}`);
      await updateAdminAthleteStatus(athleteId, action, accessToken);
      toast.success(successMessage);
      await refreshAthletes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar status do atleta.");
    } finally {
      setStatusActionId(null);
    }
  };

  const exportAssociates = async () => {
    try {
      const response = await fetch(
        buildAdminAthletesExportUrl({
          q: query || undefined,
          status,
          accessToken,
        }),
        {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        },
      );

      if (!response.ok) throw new Error("Nao foi possivel exportar associados.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `associados-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Relatorio de associados exportado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar associados.");
    }
  };

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        title="Gestao de atletas associados"
        subtitle="Convide atletas associados, acompanhe pendentes e opere aprovacoes com controle por assessoria."
        actions={
          <div className="flex items-center gap-2">
            <ActionButton asChild>
              <Link href="/admin/atletas/novo">
                <UserPlus className="mr-2 h-4 w-4" />
                Novo atleta
              </Link>
            </ActionButton>
            <ActionButton asChild intent="secondary">
              <Link href="/admin/configuracoes">
                <Users className="mr-2 h-4 w-4" />
                Politicas da assessoria
              </Link>
            </ActionButton>
          </div>
        }
      />

      <SectionCard
        title="Modulo de associados"
        description="Separe gestao, fila operacional, convites e relatorios em abas."
      >
        <ModuleTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          columnsClassName="md:grid-cols-4"
        />
      </SectionCard>

      <SectionCard
        className={activeTab === "overview" ? undefined : "hidden"}
        title="Politica de cadastro"
        description="Controle de entrada por slug aberto ou convite"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Slug da assessoria</p>
            <p className="mt-2 text-sm font-semibold text-white">/{policy.slug || "assessoria"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Auto cadastro por slug</p>
            <div className="mt-2">
              <StatusBadge
                tone={policy.allowAthleteSelfSignup ? "positive" : "warning"}
                label={policy.allowAthleteSelfSignup ? "Permitido" : "Somente convite"}
              />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Aprovacao manual</p>
            <div className="mt-2">
              <StatusBadge
                tone={policy.requireAthleteApproval ? "warning" : "positive"}
                label={policy.requireAthleteApproval ? "Obrigatoria" : "Nao obrigatoria"}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <div className={activeTab === "overview" ? undefined : "hidden"}>
        {loadingAthletes ? <LoadingState lines={3} /> : <AthletesSummaryCards summary={summary} />}
      </div>

      <SectionCard
        className={activeTab === "reports" ? undefined : "hidden"}
        title="Relatorio de associados"
        description="Controle de matriculas e origem de entrada dos atletas"
      >
        <div className="mb-3 flex justify-end">
          <ActionButton intent="secondary" onClick={() => void exportAssociates()}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </ActionButton>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Com matricula</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {summary.withMemberNumber ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Sem matricula</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {summary.missingMemberNumber ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Por convite</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.invitedSignups ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Por slug</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.slugSignups ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0F2743] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">Cadastro admin</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.adminSignups ?? 0}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className={activeTab === "pipeline" ? undefined : "hidden"}
        title="Fila operacional"
        description="Listagens por status com acoes de aprovacao, rejeicao e bloqueio"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {statusCards.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatus(item.key)}
                className={
                  status === item.key
                    ? "rounded-xl border border-[#F5A623]/60 bg-[#13304f] p-3 text-left"
                    : "rounded-xl border border-white/10 bg-[#0F2743] p-3 text-left hover:border-white/20"
                }
              >
                <p className="text-xs uppercase tracking-wide text-slate-300">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou email"
              className="border-white/[0.1] bg-white/[0.05] text-white placeholder:text-white/30"
            />
            <ActionButton intent="secondary" onClick={() => void refreshAthletes()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </ActionButton>
          </div>

          {loadingAthletes ? (
            <LoadingState lines={4} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nenhum atleta associado encontrado"
              description="Ajuste filtros ou convide novos atletas associados."
            />
          ) : (
            <>
              <AthletesCrmTable rows={rows} basePath="/admin/atletas" />
              <div className="flex flex-wrap items-center gap-2">
                {status === "PENDING_APPROVAL"
                  ? rows.map((athlete) => (
                      <div
                        key={athlete.id}
                        className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs"
                      >
                        <p className="font-semibold text-white">{athlete.name}</p>
                        <div className="mt-2 flex gap-2">
                          <ActionButton
                            size="sm"
                            disabled={statusActionId === `${athlete.id}:APPROVE`}
                            onClick={() =>
                              void applyStatusAction(athlete.id, "APPROVE", "Atleta aprovado.")
                            }
                          >
                            {statusActionId === `${athlete.id}:APPROVE`
                              ? "Aprovando..."
                              : "Aprovar"}
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            intent="secondary"
                            disabled={statusActionId === `${athlete.id}:REJECT`}
                            onClick={() =>
                              void applyStatusAction(athlete.id, "REJECT", "Atleta rejeitado.")
                            }
                          >
                            {statusActionId === `${athlete.id}:REJECT`
                              ? "Rejeitando..."
                              : "Rejeitar"}
                          </ActionButton>
                        </div>
                      </div>
                    ))
                  : status === "ACTIVE"
                    ? rows.map((athlete) => (
                        <div
                          key={athlete.id}
                          className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs"
                        >
                          <p className="font-semibold text-white">{athlete.name}</p>
                          <div className="mt-2 flex gap-2">
                            <ActionButton
                              size="sm"
                              intent="secondary"
                              disabled={statusActionId === `${athlete.id}:BLOCK`}
                              onClick={() =>
                                void applyStatusAction(athlete.id, "BLOCK", "Atleta bloqueado.")
                              }
                            >
                              {statusActionId === `${athlete.id}:BLOCK`
                                ? "Bloqueando..."
                                : "Bloquear"}
                            </ActionButton>
                          </div>
                        </div>
                      ))
                    : null}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard
        className={activeTab === "invites" ? undefined : "hidden"}
        title="Convites para atletas"
        description="Controle convites gerais, individuais e convites gerados por associados"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Convites</p>
              <p className="mt-2 text-xl font-semibold text-white">{inviteSummary.total}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Disponiveis</p>
              <p className="mt-2 text-xl font-semibold text-white">{inviteSummary.available}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Usados</p>
              <p className="mt-2 text-xl font-semibold text-white">{inviteSummary.used}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Expirados</p>
              <p className="mt-2 text-xl font-semibold text-white">{inviteSummary.expired}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">De associados</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {inviteSummary.athleteReferral}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
              <p className="text-xs uppercase tracking-wide text-slate-300">Gerais</p>
              <p className="mt-2 text-xl font-semibold text-white">{inviteSummary.adminGeneral}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="invite-label">Rotulo</Label>
              <Input
                id="invite-label"
                value={inviteLabel}
                onChange={(event) => setInviteLabel(event.target.value)}
                placeholder="Ex: Turma iniciantes maio"
                className="border-white/15 bg-[#0F2743] text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-reusable">Tipo</Label>
              <Select
                id="invite-reusable"
                value={inviteReusable ? "REUSABLE" : "LIMITED"}
                onChange={(event) => setInviteReusable(event.target.value === "REUSABLE")}
                className="border-white/15 bg-[#0F2743] text-white"
              >
                <option value="LIMITED">Limitado por uso</option>
                <option value="REUSABLE">Reutilizavel</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-max-uses">Maximo de usos</Label>
              <Input
                id="invite-max-uses"
                type="number"
                min={1}
                value={inviteMaxUses}
                onChange={(event) => setInviteMaxUses(event.target.value)}
                disabled={inviteReusable}
                className="border-white/15 bg-[#0F2743] text-white disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-expires-at">Expira em</Label>
              <Input
                id="invite-expires-at"
                type="datetime-local"
                value={inviteExpiresAt}
                onChange={(event) => setInviteExpiresAt(event.target.value)}
                className="border-white/15 bg-[#0F2743] text-white"
              />
            </div>
          </div>

          <ActionButton
            disabled={creatingInvite}
            onClick={async () => {
              if (!inviteReusable) {
                const parsedMaxUses = Number(inviteMaxUses);
                if (
                  !Number.isFinite(parsedMaxUses) ||
                  !Number.isInteger(parsedMaxUses) ||
                  parsedMaxUses < 1
                ) {
                  toast.error("Informe um mÃ¡ximo de usos vÃ¡lido (inteiro maior ou igual a 1).");
                  return;
                }
              }

              if (inviteExpiresAt) {
                const expiryDate = new Date(inviteExpiresAt);
                if (Number.isNaN(expiryDate.getTime())) {
                  toast.error("Data de expiraÃ§Ã£o invÃ¡lida.");
                  return;
                }
                if (expiryDate.getTime() <= Date.now()) {
                  toast.error("A data de expiraÃ§Ã£o precisa ser futura.");
                  return;
                }
              }

              setCreatingInvite(true);
              try {
                await createAdminInvite(
                  {
                    label: inviteLabel || undefined,
                    reusable: inviteReusable,
                    maxUses: inviteReusable ? undefined : Number(inviteMaxUses),
                    expiresAt: inviteExpiresAt
                      ? new Date(inviteExpiresAt).toISOString()
                      : undefined,
                  },
                  accessToken,
                );
                toast.success("Convite criado com sucesso.");
                setInviteLabel("");
                setInviteReusable(false);
                setInviteMaxUses("1");
                setInviteExpiresAt("");
                await refreshInvites();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Falha ao criar convite.");
              } finally {
                setCreatingInvite(false);
              }
            }}
          >
            Criar convite
          </ActionButton>

          {loadingInvites ? (
            <LoadingState lines={3} />
          ) : invites.length === 0 ? (
            <EmptyState
              title="Nenhum convite criado"
              description="Crie links para convidar atletas da assessoria."
            />
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => (
                <div key={invite.id} className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {invite.label ?? "Convite sem rotulo"}
                      </p>
                      <p className="text-xs text-slate-300">Token: {invite.token}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {invite.inviteKind === "ATHLETE_REFERRAL"
                          ? "Convite de associado"
                          : "Convite geral"}
                        {invite.createdBy?.name ? ` por ${invite.createdBy.name}` : ""}
                      </p>
                      {invite.invitedEmail ? (
                        <p className="text-xs text-slate-400">
                          Para: {invite.invitedName ? `${invite.invitedName} - ` : ""}
                          {invite.invitedEmail}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={invite.active ? "positive" : "neutral"}
                        label={invite.active ? "Ativo" : "Inativo"}
                      />
                      {invite.expired ? <StatusBadge tone="danger" label="Expirado" /> : null}
                      {invite.acceptedUser ? <StatusBadge tone="positive" label="Usado" /> : null}
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
                    <p>
                      Usos: {invite.usedCount}/{invite.maxUses ?? "ilimitado"}
                    </p>
                    <p>Disponivel: {invite.availableUses ?? "ilimitado"}</p>
                    <p>
                      Expira:{" "}
                      {invite.expiresAt
                        ? new Date(invite.expiresAt).toLocaleString("pt-BR")
                        : "sem expiracao"}
                    </p>
                    <p>
                      Aceito por:{" "}
                      {invite.acceptedUser
                        ? `${invite.acceptedUser.name ?? invite.acceptedUser.email ?? "atleta"}${
                            invite.acceptedUser.memberNumber
                              ? ` (${invite.acceptedUser.memberNumber})`
                              : ""
                          }`
                        : "pendente"}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      size="sm"
                      intent="secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(invite.signupUrl);
                          toast.success("Link de convite copiado.");
                        } catch {
                          toast.error("Nao foi possivel copiar o link.");
                        }
                      }}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copiar link
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      onClick={async () => {
                        try {
                          await resendAdminInvite(invite.id, accessToken);
                          toast.success("Convite reenviado com novo token.");
                          await refreshInvites();
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Falha ao reenviar convite.",
                          );
                        }
                      }}
                    >
                      Reenviar convite
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
