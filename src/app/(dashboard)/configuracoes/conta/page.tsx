"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Link2, PlugZap, RefreshCcw, Unplug, UserCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { MfaSecurityPanel } from "@/components/auth/MfaSecurityPanel";
import { ActionButton } from "@/components/system/action-button";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { createInvite, OrgInvite } from "@/services/organization-service";
import {
  disconnectStrava,
  getStravaConnectUrl,
  getStravaStatus,
  StravaConnectionStatus,
  syncStrava,
} from "@/services/strava-service";
import { UserRole } from "@/types";

export default function ConfiguracoesContaPage() {
  const { accessToken, userRole } = useAuthToken();
  const [stravaStatus, setStravaStatus] = useState<StravaConnectionStatus | null>(null);
  const [stravaError, setStravaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [lastInvite, setLastInvite] = useState<OrgInvite | null>(null);

  const isAthlete = userRole === UserRole.ATHLETE;

  const loadStatus = async () => {
    if (!isAthlete) {
      setStravaStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setStravaError(null);
    try {
      const status = await getStravaStatus(accessToken);
      setStravaStatus(status);
    } catch (error) {
      setStravaStatus(null);
      setStravaError(
        error instanceof Error ? error.message : "Nao foi possivel carregar o status do Strava.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isAthlete]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const stravaParam = params.get("strava");
    if (!stravaParam) return;

    if (stravaParam === "connected") {
      const synced = Number(params.get("synced") ?? "0");
      toast.success(`Strava conectado com sucesso. ${synced} atividade(s) sincronizada(s).`);
    } else if (stravaParam === "connect_failed") {
      toast.error("Nao foi possivel conectar com Strava.");
    } else if (stravaParam === "oauth_error") {
      toast.error("Conexao Strava cancelada ou negada.");
    } else if (
      stravaParam === "state_mismatch" ||
      stravaParam === "state_invalid" ||
      stravaParam === "invalid_callback"
    ) {
      toast.error("Falha de seguranca no callback do Strava. Tente conectar novamente.");
    }

    params.delete("strava");
    params.delete("synced");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const handleConnectStrava = async () => {
    setConnecting(true);
    try {
      const authorizeUrl = await getStravaConnectUrl(accessToken);
      window.location.assign(authorizeUrl);
    } catch (connectError) {
      toast.error(
        connectError instanceof Error
          ? connectError.message
          : "Falha ao iniciar conexao com Strava.",
      );
      setConnecting(false);
    }
  };

  const handleSyncStrava = async () => {
    setSyncing(true);
    try {
      const result = await syncStrava(accessToken);
      toast.success(`${result.syncedCount} atividade(s) sincronizada(s) do Strava.`);
      await loadStatus();
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : "Falha ao sincronizar Strava.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectStrava = async () => {
    if (!confirm("Deseja desconectar o Strava desta conta?")) return;
    setDisconnecting(true);
    try {
      await disconnectStrava(accessToken);
      toast.success("Strava desconectado com sucesso.");
      await loadStatus();
    } catch (disconnectError) {
      toast.error(
        disconnectError instanceof Error ? disconnectError.message : "Falha ao desconectar Strava.",
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const inviteUrl = lastInvite
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register/atleta?inviteToken=${lastInvite.token}`
    : "";
  const stravaUnavailable =
    stravaStatus?.integrationConfigured === false ||
    stravaStatus?.unavailableReason === "strava_client_not_configured";

  const handleCreateInvite = async () => {
    if (!isAthlete) return;

    setCreatingInvite(true);
    try {
      const invite = await createInvite(
        {
          label: "Indicacao de atleta",
          max_uses: 1,
        },
        accessToken,
      );
      setLastInvite(invite);
      toast.success("Convite gerado. O novo atleta ficara aguardando aprovacao.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o convite.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link de convite copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o link.");
    }
  };

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        title="Configuracoes da conta"
        subtitle="Preferencias e integracoes pessoais do seu usuario."
      />

      <SectionCard title="Conta pessoal" description="Dados da sua conta e identidade do usuario.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
          <div className="inline-flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2f5d8f] bg-[#12355d]">
              <UserCircle2 className="h-5 w-5 text-[#8eb0dc]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Edicao de perfil</p>
              <p className="text-xs text-[#8eb0dc]">
                Dados pessoais, CPF, foto e contato de emergencia ficam em /perfil.
              </p>
            </div>
          </div>
          <ActionButton asChild size="sm">
            <Link href="/perfil">Abrir meu perfil</Link>
          </ActionButton>
        </div>
      </SectionCard>

      <MfaSecurityPanel />

      {isAthlete ? (
        <SectionCard
          title="Indicar atleta"
          description="Gere um convite para outro atleta entrar na sua assessoria."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
              <div className="inline-flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2f5d8f] bg-[#12355d]">
                  <UserPlus className="h-5 w-5 text-[#8eb0dc]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Convite com aprovacao</p>
                  <p className="text-xs text-[#8eb0dc]">
                    Quem usar seu link entra na fila para revisao dos administradores.
                  </p>
                </div>
              </div>
              <ActionButton onClick={() => void handleCreateInvite()} disabled={creatingInvite} size="sm">
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                {creatingInvite ? "Gerando..." : "Gerar convite"}
              </ActionButton>
            </div>

            {lastInvite ? (
              <div className="rounded-xl border border-[#24486f] bg-[#0a1d36] p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-[#8eb0dc]">
                  Link gerado
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0f233d] px-3 py-2 font-mono text-xs text-white">
                    <span className="block truncate">{inviteUrl}</span>
                  </div>
                  <ActionButton intent="secondary" onClick={() => void handleCopyInvite()} size="sm">
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copiar
                  </ActionButton>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Integracao Strava"
        description="Conecte sua conta para usar atividades reais no dashboard e evolucao."
      >
        {!isAthlete ? (
          <p className="text-sm text-[#8eb0dc]">
            Esta integracao pessoal esta disponivel apenas para usuarios atleta.
          </p>
        ) : loading ? (
          <LoadingState lines={2} />
        ) : (
          <div className="space-y-4">
            {stravaError ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {stravaError}
              </div>
            ) : null}
            <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
              <p className="text-xs uppercase tracking-wide text-[#8eb0dc]">Status da conexao</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {stravaStatus?.connected ? "Conectado" : "Nao conectado"}
              </p>
              {stravaStatus?.connected ? (
                <div className="mt-2 space-y-1 text-xs text-[#8eb0dc]">
                  <p>
                    ID atleta Strava:{" "}
                    <span className="font-mono text-white">{stravaStatus.stravaAthleteId}</span>
                  </p>
                  <p>
                    Scopes:{" "}
                    {stravaStatus.scopes.length ? stravaStatus.scopes.join(", ") : "Nao informado"}
                  </p>
                  <p>
                    Ultimo sync:{" "}
                    {stravaStatus.lastSyncAt
                      ? new Date(stravaStatus.lastSyncAt).toLocaleString("pt-BR")
                      : "Ainda nao sincronizado"}
                  </p>
                </div>
              ) : stravaUnavailable ? (
                <p className="mt-2 text-xs text-amber-200">
                  Strava ainda nao esta configurado no servidor. Configure STRAVA_CLIENT_ID e
                  STRAVA_CLIENT_SECRET para liberar a conexao individual de cada atleta.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton intent="secondary" onClick={() => void loadStatus()} disabled={loading}>
                <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Atualizar status
              </ActionButton>
              {stravaStatus?.connected ? (
                <>
                  <ActionButton
                    intent="secondary"
                    onClick={() => void handleSyncStrava()}
                    disabled={syncing}
                  >
                    <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Sincronizando..." : "Sincronizar agora"}
                  </ActionButton>
                  <ActionButton
                    intent="danger"
                    onClick={() => void handleDisconnectStrava()}
                    disabled={disconnecting}
                  >
                    <Unplug className="mr-1.5 h-3.5 w-3.5" />
                    {disconnecting ? "Desconectando..." : "Desconectar"}
                  </ActionButton>
                </>
              ) : (
                <ActionButton
                  onClick={() => void handleConnectStrava()}
                  disabled={connecting || stravaUnavailable}
                >
                  <PlugZap className="mr-1.5 h-3.5 w-3.5" />
                  {stravaUnavailable
                    ? "Strava indisponivel"
                    : connecting
                      ? "Redirecionando..."
                      : "Conectar com Strava"}
                </ActionButton>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
