"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2, Mail, LockKeyhole, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { UserRole } from "@/types";

interface LoginSuccessResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  profile?: { hasCpf: boolean };
  organization?: {
    status?: string;
    setup_completed_at?: string | null;
  } | null;
}

interface LoginMfaResponse {
  mfa_required: true;
  mfa_token: string;
  mfa_setup_required?: boolean;
  available_methods?: string[];
  masked_email?: string;
}

type LoginErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type PlatformOrTenantAdminRole = "SUPER_ADMIN" | "ADMIN" | "FINANCE";

function resolvePostLoginPath(
  role: string,
  hasCpf: boolean,
  nextParam: string | null,
  organizationStatus?: string,
  setupCompletedAt?: string | null,
): string {
  const isPlatformOrTenantAdmin = (
    ["SUPER_ADMIN", "ADMIN", "FINANCE"] as PlatformOrTenantAdminRole[]
  ).includes(role as PlatformOrTenantAdminRole);

  if (role === "COACH") {
    if (nextParam && nextParam.startsWith("/coach")) return nextParam;
    return "/coach";
  }

  if (isPlatformOrTenantAdmin) {
    if (role === "SUPER_ADMIN") {
      if (nextParam && nextParam.startsWith("/super-admin")) return nextParam;
      return "/super-admin";
    }

    if (role === "ADMIN" && (organizationStatus === "PENDING_SETUP" || !setupCompletedAt)) {
      return "/onboarding/assessoria";
    }
    if (role === "FINANCE") {
      if (nextParam && nextParam.startsWith("/admin/financeiro")) return nextParam;
      return "/admin/financeiro";
    }
    if (nextParam && nextParam.startsWith("/admin")) return nextParam;
    return "/admin";
  }

  if (!hasCpf) return "/onboarding/atleta";
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("/admin")) return nextParam;
  return "/";
}

function SocialButton({
  label,
  brand,
  onClick,
}: {
  label: string;
  brand: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-16 items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-4 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/8"
      aria-label={`Entrar com ${label}`}
      title={label}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl font-bold text-[#0b1324]">
        {brand}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useAuthToken();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const reason = searchParams.get("reason");

  useEffect(() => {
    if (reason === "expired") {
      toast.info("Sua sessao expirou. Faca login novamente.");
    }

    if (reason === "inactive") {
      toast.info("Sua conta nao esta ativa para acesso.");
    }
  }, [reason]);

  const publicAdminRegistrationEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_PUBLIC_ADMIN_REGISTRATION_ENABLED === "true";

  const demoUiEnabled =
    process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const fillDemoCredentials = (profile: "admin" | "athlete") => {
    if (profile === "admin") {
      setValue("email", "admin@ventu.demo", { shouldValidate: true });
      setValue("password", "Demo@1234", { shouldValidate: true });
      return;
    }

    setValue("email", "atleta@ventu.demo", { shouldValidate: true });
    setValue("password", "Atleta@1234", { shouldValidate: true });
  };

  const onSubmit = async (data: LoginInput) => {
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as LoginSuccessResponse | LoginMfaResponse | LoginErrorResponse;

      if (!response.ok) {
        const message =
          "error" in payload
            ? (payload.error?.message ?? "Nao foi possivel autenticar. Tente novamente.")
            : "Nao foi possivel autenticar. Tente novamente.";

        if (
          response.status === 403 &&
          (message.toLowerCase().includes("aguardando aprovacao") ||
            message.toLowerCase().includes("aguardando"))
        ) {
          router.push("/aguardando-aprovacao");
          return;
        }

        setError(message);
        toast.error(message);
        return;
      }

      if ("mfa_required" in payload && payload.mfa_required) {
        const nextPath = searchParams.get("next");
        const url = new URL("/mfa", window.location.origin);
        url.searchParams.set("token", payload.mfa_token);
        if (payload.mfa_setup_required) url.searchParams.set("setup", "1");
        if (payload.masked_email) url.searchParams.set("email", payload.masked_email);
        if (payload.available_methods?.length) {
          url.searchParams.set("methods", payload.available_methods.join(","));
        }
        if (nextPath) url.searchParams.set("next", nextPath);
        router.push(url.pathname + url.search);
        return;
      }

      if (!("accessToken" in payload)) {
        const message = "Nao foi possivel autenticar. Tente novamente.";
        setError(message);
        toast.error(message);
        return;
      }

      setAuthSession({
        token: payload.accessToken,
        role: (payload.user.role as UserRole) ?? null,
      });

      toast.success("Login realizado com sucesso.");
      const nextPath = searchParams.get("next");
      const hasCpf = payload.profile?.hasCpf ?? true;
      const destination = resolvePostLoginPath(
        payload.user.role,
        hasCpf,
        nextPath,
        payload.organization?.status,
        payload.organization?.setup_completed_at,
      );
      router.push(destination);
    } catch {
      const message = "Erro de conexao. Tente novamente em instantes.";
      setError(message);
      toast.error(message);
    }
  };

  const quickDemoLogin = async (profile: "admin" | "athlete") => {
    fillDemoCredentials(profile);
    await handleSubmit(onSubmit)();
  };

  const notifySocialLogin = (provider: string) => {
    toast.info(`Login com ${provider} preparado para integracao OAuth.`);
  };

  return (
    <AuthShell
      title={
        <>
          Bem-vindo(a) de <span className="text-[#f7b529]">volta!</span>
        </>
      }
      description={
        <>
          Faca login para continuar <span className="text-[#f7b529]">sua jornada.</span>
        </>
      }
    >
      {demoUiEnabled ? (
        <section className="mb-4 hidden rounded-[1.6rem] border border-[#f7b529]/20 bg-[#f7b529]/8 p-4 sm:block">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[#f7b529]" />
            <div>
              <p className="text-sm font-semibold text-white">Modo demonstracao</p>
              <p className="text-sm text-slate-300">Perfis prontos para apresentar a experiencia.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void quickDemoLogin("admin")}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-[#f7b529]/50 hover:bg-white/10"
            >
              <p className="text-sm font-semibold text-white">Assessoria</p>
              <p className="mt-1 text-sm text-slate-300">Gestao, financeiro e operacao.</p>
            </button>
            <button
              type="button"
              onClick={() => void quickDemoLogin("athlete")}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/30 hover:bg-white/10"
            >
              <p className="text-sm font-semibold text-white">Atleta</p>
              <p className="mt-1 text-sm text-slate-300">Painel de jornada, progresso e comunidade.</p>
            </button>
          </div>
        </section>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 xl:space-y-5">
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            E-mail
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              className="h-14 rounded-2xl border-white/12 bg-white/6 pl-12 text-base text-white placeholder:text-slate-400 focus-visible:ring-[#f7b529] sm:h-16"
              {...register("email")}
            />
          </div>
          {errors.email ? <p className="text-xs text-amber-300">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
            Senha
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              className="h-14 rounded-2xl border-white/12 bg-white/6 pl-12 pr-12 text-base text-white placeholder:text-slate-400 focus-visible:ring-[#f7b529] sm:h-16"
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-white"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-amber-300">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/15 bg-transparent text-[#f7b529] focus:ring-[#f7b529]"
              {...register("rememberMe")}
            />
            <span>Lembrar-me</span>
          </label>
          <Link href="/forgot-password" className="font-medium text-[#f7b529] transition hover:text-[#ffd27a]">
            Esqueci minha senha
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="h-auto min-h-12 w-full rounded-2xl bg-[#f7b529] px-4 py-3 text-sm font-bold text-[#0a1220] shadow-[0_18px_45px_rgba(247,181,41,0.3)] hover:bg-[#ffbf3e] sm:min-h-14 sm:px-5 sm:py-3.5 sm:text-base xl:min-h-16 xl:py-4 xl:text-lg"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2 text-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando acesso...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2 text-center leading-5 sm:gap-3">
              <span>ACESSAR MINHA EVOLUCAO</span>
              <ArrowRight className="h-5 w-5" />
            </span>
          )}
        </Button>

        <div className="relative hidden py-1 text-center sm:block">
          <span className="relative z-10 bg-[#091223] px-3 text-xs text-slate-400 sm:px-4 sm:text-sm">ou continue com</span>
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        </div>

        <div className="hidden gap-4 sm:grid sm:grid-cols-3 max-[860px]:hidden">
          <SocialButton label="Google" brand="G" onClick={() => notifySocialLogin("Google")} />
          <SocialButton label="Apple" brand="A" onClick={() => notifySocialLogin("Apple")} />
          <SocialButton label="Facebook" brand="f" onClick={() => notifySocialLogin("Facebook")} />
        </div>

        {publicAdminRegistrationEnabled ? (
          <p className="text-center text-base text-slate-300">
            Ainda nao tem conta?{" "}
            <Link href="/register/assessoria" className="font-semibold text-[#f7b529] hover:text-[#ffd27a]">
              Comecar agora
            </Link>
          </p>
        ) : (
          <div className="space-y-1.5 pt-1 text-center text-xs text-slate-400 sm:space-y-2 sm:pt-2 sm:text-sm max-[860px]:hidden">
            <p className="hidden sm:block">Cadastro de assessoria por convite comercial.</p>
            <p>
              Ainda nao tem conta?{" "}
              <Link href="/register/atleta" className="font-semibold text-[#f7b529] hover:text-[#ffd27a]">
                Comecar agora
              </Link>
            </p>
            <p className="sm:hidden">
              Tenho convite de atleta:{" "}
              <Link href="/register/atleta" className="font-semibold text-[#f7b529] hover:text-[#ffd27a]">
                Cadastrar atleta
              </Link>
            </p>
            <p className="hidden sm:block">
              Sou atleta e tenho convite:{" "}
              <Link href="/register/atleta" className="font-semibold text-[#f7b529] hover:text-[#ffd27a]">
                Cadastrar atleta
              </Link>
            </p>
            <p>
              Recebi convite de admin:{" "}
              <Link href="/activate-admin" className="font-semibold text-[#f7b529] hover:text-[#ffd27a]">
                Ativar conta
              </Link>
            </p>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
