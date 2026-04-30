"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { SectionCard } from "@/components/system/section-card";
import { disableMfa, getMfaStatus, startMfaSetup, type MfaStatus } from "@/services/mfa-service";

function inputClass() {
  return "w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-3 py-2 text-sm text-white placeholder:text-[#4a7fa8] focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]";
}

function formatDate(value: string | null): string {
  if (!value) return "Ainda nao verificado";
  return new Date(value).toLocaleString("pt-BR");
}

export function MfaSecurityPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, refreshSession } = useAuthToken();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    try {
      setStatus(await getMfaStatus(accessToken));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o status MFA.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleStartSetup = async () => {
    setStarting(true);
    try {
      const setup = await startMfaSetup(accessToken);
      const url = new URL("/mfa", window.location.origin);
      url.searchParams.set("token", setup.mfa_token);
      url.searchParams.set("setup", "1");
      url.searchParams.set("next", pathname || "/configuracoes/conta");
      router.push(`${url.pathname}${url.search}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel iniciar a ativacao MFA.");
      setStarting(false);
    }
  };

  const handleDisable = async () => {
    if (!password.trim() || !code.trim()) {
      toast.error("Informe sua senha atual e o codigo MFA.");
      return;
    }

    setDisabling(true);
    try {
      await disableMfa({ password, code }, accessToken);
      setPassword("");
      setCode("");
      setShowDisableForm(false);
      await refreshSession();
      await loadStatus();
      toast.success("MFA desativado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel desativar MFA.");
    } finally {
      setDisabling(false);
    }
  };

  return (
    <SectionCard
      title="Seguranca da conta"
      description="Ative ou desative a verificacao em duas etapas da sua conta."
    >
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#24486f] bg-[#0f233d] p-4 text-sm text-[#8eb0dc]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando seguranca...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2f5d8f] bg-[#12355d]">
                  {status?.enabled ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <ShieldOff className="h-5 w-5 text-amber-300" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    MFA {status?.enabled ? "ativo" : "inativo"}
                  </p>
                  <p className="mt-1 text-xs text-[#8eb0dc]">
                    {status?.enabled
                      ? `Ultima verificacao: ${formatDate(status.lastVerifiedAt)}`
                      : "Proteja o login usando um app autenticador."}
                  </p>
                  {status?.enabled ? (
                    <p className="mt-1 text-xs text-[#8eb0dc]">
                      Recovery codes restantes: {status.recoveryCodesRemaining}
                    </p>
                  ) : null}
                </div>
              </div>

              {status?.enabled ? (
                <ActionButton
                  intent="secondary"
                  size="sm"
                  onClick={() => setShowDisableForm((value) => !value)}
                >
                  <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                  Desativar MFA
                </ActionButton>
              ) : (
                <ActionButton size="sm" onClick={() => void handleStartSetup()} disabled={starting}>
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  {starting ? "Iniciando..." : "Ativar MFA"}
                </ActionButton>
              )}
            </div>

            {status?.requiredByRole ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p>
                  MFA e obrigatorio para o seu perfil. Se desativar, o sistema vai solicitar nova
                  ativacao no proximo login.
                </p>
              </div>
            ) : null}
          </div>

          {showDisableForm && status?.enabled ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-white">Confirmar desativacao</p>
              <p className="mt-1 text-xs text-red-100/80">
                Informe sua senha atual e um codigo do autenticador ou recovery code.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  className={inputClass()}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Senha atual"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <input
                  className={inputClass()}
                  type="text"
                  inputMode="text"
                  placeholder="Codigo MFA"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton
                  intent="danger"
                  onClick={() => void handleDisable()}
                  disabled={disabling}
                >
                  {disabling ? "Desativando..." : "Confirmar desativacao"}
                </ActionButton>
                <ActionButton
                  intent="secondary"
                  onClick={() => setShowDisableForm(false)}
                  disabled={disabling}
                >
                  Cancelar
                </ActionButton>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
