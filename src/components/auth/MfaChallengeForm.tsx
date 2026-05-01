"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRole } from "@/types";

interface MfaSetupResponse {
  mfa_token: string;
  secret: string;
  otp_auth_url: string;
  qr_code_data: string;
  manual_entry_key: string;
  masked_email: string;
  available_methods?: string[];
}

interface MfaVerifyResponse {
  access_token: string;
  refresh_token: string;
  recovery_codes?: string[];
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
    role: string;
    roles?: string[];
  };
  profile?: { hasCpf: boolean };
  organization?: {
    status?: string;
    setup_completed_at?: string | null;
  } | null;
}

function isMfaSetupResponse(payload: unknown): payload is MfaSetupResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "secret" in payload &&
      "qr_code_data" in payload &&
      "manual_entry_key" in payload,
  );
}

function isMfaVerifyResponse(payload: unknown): payload is MfaVerifyResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "access_token" in payload &&
      "user" in payload,
  );
}

function resolvePostLoginPath(
  role: string,
  hasCpf: boolean,
  nextParam: string | null,
  organizationStatus?: string,
  setupCompletedAt?: string | null,
): string {
  if (role === "COACH") return nextParam?.startsWith("/coach") ? nextParam : "/coach";
  if (role === "SUPER_ADMIN") return nextParam?.startsWith("/super-admin") ? nextParam : "/super-admin";
  if (role === "FINANCE") {
    return nextParam?.startsWith("/admin/financeiro") ? nextParam : "/admin/financeiro";
  }
  if (role === "ADMIN") {
    if (organizationStatus === "PENDING_SETUP" || !setupCompletedAt) return "/onboarding/assessoria";
    return nextParam?.startsWith("/admin") ? nextParam : "/admin";
  }
  if (!hasCpf) return "/onboarding/atleta";
  return nextParam && nextParam.startsWith("/") && !nextParam.startsWith("/admin") ? nextParam : "/";
}

export function MfaChallengeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useAuthToken();
  const mfaToken = searchParams.get("token") ?? "";
  const maskedEmail = searchParams.get("email") ?? "";
  const setupRequired = searchParams.get("setup") === "1";
  const availableMethods = useMemo(
    () => new Set((searchParams.get("methods") ?? "").split(",").filter(Boolean)),
    [searchParams],
  );
  const [method, setMethod] = useState<"TOTP" | "EMAIL_OTP" | "RECOVERY_CODE">("TOTP");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(setupRequired);
  const [debugEmailCode, setDebugEmailCode] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!mfaToken) {
      router.replace("/login");
      return;
    }

    if (!setupRequired) return;

    let cancelled = false;
    const loadSetup = async () => {
      setLoadingSetup(true);
      try {
        const response = await fetch("/api/auth/mfa/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mfa_token: mfaToken }),
        });

        const payload = (await response.json()) as unknown;
        if (!response.ok || !isMfaSetupResponse(payload)) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? ((payload as { error?: { message?: string } }).error?.message ??
                "Não foi possível carregar o setup MFA.")
              : "Não foi possível carregar o setup MFA.";
          if (!cancelled) {
            setError(message);
          }
          return;
        }

        if (!cancelled) {
          setSetupData(payload);
        }
      } catch {
        if (!cancelled) setError("Erro de conexão ao preparar o MFA.");
      } finally {
        if (!cancelled) setLoadingSetup(false);
      }
    };

    void loadSetup();
    return () => {
      cancelled = true;
    };
  }, [mfaToken, router, setupRequired]);

  const canUseEmail = availableMethods.has("EMAIL_OTP") && !setupRequired;
  const canUseRecovery = availableMethods.has("RECOVERY_CODE") && !setupRequired;

  const handleVerify = async (manualCode?: string) => {
    const value = (manualCode ?? code).trim();
    if (!mfaToken || (!value && method !== "RECOVERY_CODE")) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mfa_token: mfaToken,
          code: value,
          method,
        }),
      });

        const payload = (await response.json()) as unknown;
        if (!response.ok || !isMfaVerifyResponse(payload)) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? ((payload as { error?: { message?: string } }).error?.message ??
                "Não foi possível validar o código.")
              : "Não foi possível validar o código.";
          setError(message);
          toast.error(message);
          return;
        }

      setAuthSession({
        token: payload.access_token,
        role: (payload.user.role as UserRole) ?? null,
        roles: payload.user.roles?.map((role) => role as UserRole),
        user: {
          id: payload.user.id,
          name: payload.user.name,
          email: payload.user.email,
          avatar_url: payload.user.avatar_url ?? null,
        },
        profile: payload.profile ?? null,
      });

      if (payload.recovery_codes?.length) {
        setRecoveryCodes(payload.recovery_codes);
      }

      toast.success(setupRequired ? "MFA ativado com sucesso." : "Identidade confirmada.");
      const nextPath = searchParams.get("next");
      const hasCpf = payload.profile?.hasCpf ?? true;
      const destination = resolvePostLoginPath(
        payload.user.role,
        hasCpf,
        nextPath,
        payload.organization?.status,
        payload.organization?.setup_completed_at,
      );

      if (payload.recovery_codes?.length) {
        setTimeout(() => router.push(destination), 1800);
      } else {
        router.push(destination);
      }
    } catch {
      const message = "Erro de conexão. Tente novamente.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setDebugEmailCode(null);

    try {
      const response = await fetch("/api/auth/mfa/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_token: mfaToken }),
      });

      const payload = (await response.json()) as {
        message?: string;
        masked_email?: string;
        debug_code?: string;
        error?: { message?: string };
      };

      if (!response.ok) {
        const message = payload.error?.message ?? "Não foi possível reenviar o código.";
        setError(message);
        toast.error(message);
        return;
      }

      setMethod("EMAIL_OTP");
      setCode("");
      setDebugEmailCode(payload.debug_code ?? null);
      toast.success(payload.message ?? "Código enviado para o e-mail cadastrado.");
    } catch {
      const message = "Erro de conexão ao reenviar o código.";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <AuthShell
      title={setupRequired ? "Confirme sua identidade" : "Confirme sua identidade"}
      description={
        setupRequired
          ? "Ative o autenticador para proteger sua conta antes de concluir o acesso."
          : "Digite o código para continuar sua jornada com segurança."
      }
    >
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {setupRequired ? (
        <section className="mb-6 rounded-[1.6rem] border border-white/12 bg-white/5 p-5">
          {loadingSetup ? (
            <div className="flex min-h-40 items-center justify-center text-slate-300">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Preparando autenticador...
            </div>
          ) : setupData ? (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-2xl border border-white/10 bg-[#08101e] p-4">
                  <p className="text-sm font-semibold text-white">1. Escaneie o QR Code</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Use Google Authenticator, Authy ou Microsoft Authenticator.
                  </p>
                  <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
                    <QRCodeSVG value={setupData.qr_code_data} size={188} />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#08101e] p-4">
                  <p className="text-sm font-semibold text-white">2. Chave manual</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Caso prefira, copie a chave abaixo no seu app autenticador.
                  </p>
                  <div className="mt-4 rounded-2xl border border-dashed border-[#f7b529]/35 bg-[#f7b529]/8 px-4 py-3">
                    <p className="break-all font-mono text-sm tracking-[0.16em] text-[#ffd27a]">
                      {setupData.manual_entry_key}
                    </p>
                  </div>
                  <p className="mt-4 text-sm text-slate-400">
                    Conta protegida para <span className="text-white">{setupData.masked_email}</span>
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#f7b529]/20 bg-[#f7b529]/8 p-4 text-sm leading-6 text-slate-200">
                <p className="font-semibold text-white">Último passo</p>
                <p>Digite o código de 6 dígitos gerado pelo autenticador para concluir a ativação.</p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-5">
        {!setupRequired ? (
          <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Acesso em verificação</p>
            <p className="mt-1">
              {method === "EMAIL_OTP"
                ? `Insira o código enviado para ${maskedEmail || "seu e-mail cadastrado"}.`
                : "Digite o código do seu app autenticador para continuar."}
            </p>
          </div>
        ) : null}

        {!setupRequired ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setMethod("TOTP");
                setCode("");
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                method === "TOTP" ? "bg-[#f7b529] text-[#091223]" : "border border-white/12 bg-white/5 text-slate-300"
              }`}
            >
              App autenticador
            </button>
            {canUseEmail ? (
              <button
                type="button"
                onClick={() => {
                  setMethod("EMAIL_OTP");
                  setCode("");
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  method === "EMAIL_OTP"
                    ? "bg-[#f7b529] text-[#091223]"
                    : "border border-white/12 bg-white/5 text-slate-300"
                }`}
              >
                Código por e-mail
              </button>
            ) : null}
            {canUseRecovery ? (
              <button
                type="button"
                onClick={() => {
                  setMethod("RECOVERY_CODE");
                  setCode("");
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  method === "RECOVERY_CODE"
                    ? "bg-[#f7b529] text-[#091223]"
                    : "border border-white/12 bg-white/5 text-slate-300"
                }`}
              >
                Recovery code
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-100">
            {method === "RECOVERY_CODE" ? "Recovery code" : "Código de verificação"}
          </label>
          <Input
            type="text"
            value={code}
            onChange={(event) => {
              const nextValue =
                method === "RECOVERY_CODE"
                  ? event.target.value.toUpperCase()
                  : event.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(nextValue);
              if (method !== "RECOVERY_CODE" && nextValue.length === 6 && !submitting) {
                void handleVerify(nextValue);
              }
            }}
            autoFocus
            autoComplete={method === "RECOVERY_CODE" ? "off" : "one-time-code"}
            inputMode={method === "RECOVERY_CODE" ? "text" : "numeric"}
            maxLength={method === "RECOVERY_CODE" ? 16 : 6}
            placeholder={method === "RECOVERY_CODE" ? "ABCD-1234" : "000000"}
            className="h-16 rounded-2xl border-white/12 bg-[#08101e] text-center font-mono text-3xl font-bold text-white caret-[#f7b529] placeholder:text-slate-500 focus-visible:ring-[#f7b529]"
          />
        </div>

        {debugEmailCode ? (
          <div className="rounded-2xl border border-[#f7b529]/20 bg-[#f7b529]/8 px-4 py-3 text-sm text-slate-200">
            Ambiente de desenvolvimento. Código enviado:{" "}
            <span className="font-mono font-semibold text-white">{debugEmailCode}</span>
          </div>
        ) : null}

        {recoveryCodes ? (
          <div className="rounded-[1.6rem] border border-emerald-500/25 bg-emerald-500/10 p-5">
            <p className="text-base font-semibold text-white">Recovery codes gerados</p>
            <p className="mt-2 text-sm leading-6 text-emerald-50/90">
              Estes códigos aparecem uma única vez. Guarde-os em local seguro.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {recoveryCodes.map((recoveryCode) => (
                <div
                  key={recoveryCode}
                  className="rounded-xl border border-white/10 bg-[#08101e] px-3 py-2 font-mono text-sm text-white"
                >
                  {recoveryCode}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            disabled={submitting || (!code.trim() && method !== "RECOVERY_CODE")}
            onClick={() => void handleVerify()}
            className="h-14 rounded-xl bg-[#f7b529] text-base font-semibold text-[#091223] hover:bg-[#ffbf3e]"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Verificando...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                Verificar código
                <ArrowRight className="h-5 w-5" />
              </span>
            )}
          </Button>

          {canUseEmail ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleResend()}
              className="h-14 rounded-2xl border-white/12 bg-white/5 text-base text-white hover:bg-white/10"
            >
              <Mail className="mr-2 h-4 w-4" />
              Reenviar por e-mail
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="h-14 rounded-2xl border-white/12 bg-white/5 text-base text-white hover:bg-white/10"
            >
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-slate-400">
          <Link href="/login" className="inline-flex items-center gap-2 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          {canUseRecovery ? (
            <button
              type="button"
              onClick={() => {
                setMethod("RECOVERY_CODE");
                setCode("");
              }}
              className="inline-flex items-center gap-2 font-medium text-[#f7b529] hover:text-[#ffd27a]"
            >
              <KeyRound className="h-4 w-4" />
              Usar recovery code
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              MFA protegido
            </span>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
