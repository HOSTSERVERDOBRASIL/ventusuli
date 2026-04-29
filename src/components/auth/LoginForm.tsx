"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
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
    roles?: string[];
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
type DemoProfile = "admin" | "coach" | "athlete";

const demoProfiles: Array<{
  id: DemoProfile;
  label: string;
  role: string;
  email: string;
  password: string;
  description: string;
}> = [
  {
    id: "admin",
    label: "Gestão",
    role: "Admin",
    email: "admin@ventu.demo",
    password: "Demo@1234",
    description: "Operação, financeiro, pontos e eventos.",
  },
  {
    id: "coach",
    label: "Coach",
    role: "Treinador",
    email: "coach@ventu.demo",
    password: "Demo@1234",
    description: "Treinos, atletas, IA e feedbacks.",
  },
  {
    id: "athlete",
    label: "Atleta",
    role: "Atleta",
    email: "atleta@ventu.demo",
    password: "Atleta@1234",
    description: "Evolução, inscrições, treinos e comunidade.",
  },
];

const accessInsightByProfile = {
  admin: {
    title: "Painel de gestão detectado",
    description:
      "Depois do login, a plataforma leva você para operação, financeiro e visão da assessoria.",
    destination: "Admin",
    guard: "MFA e permissões",
  },
  coach: {
    title: "Área do treinador pronta",
    description:
      "O acesso prioriza atletas, planos de treino, recomendações e acompanhamento de carga.",
    destination: "Coach",
    guard: "Treinos e feedbacks",
  },
  athlete: {
    title: "Jornada do atleta preparada",
    description: "Você entra direto em evolução, treinos, provas, recompensas e comunidade.",
    destination: "Atleta",
    guard: "Perfil e convite",
  },
  finance: {
    title: "Fluxo financeiro reconhecido",
    description: "A entrada leva para cobranças, recorrências, lançamentos e conciliação.",
    destination: "Financeiro",
    guard: "Acesso restrito",
  },
  generic: {
    title: "Entrada inteligente",
    description: "O sistema identifica seu papel após autenticar e envia para o painel correto.",
    destination: "Automático",
    guard: "Sessão segura",
  },
};

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

function resolveAccessInsight(email: string, selectedProfile: DemoProfile) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return accessInsightByProfile[selectedProfile];
  if (normalized.includes("coach") || normalized.includes("trein"))
    return accessInsightByProfile.coach;
  if (normalized.includes("finance")) return accessInsightByProfile.finance;
  if (normalized.includes("atleta") || normalized.includes("athlete")) {
    return accessInsightByProfile.athlete;
  }
  if (normalized.includes("admin") || normalized.includes("gestao"))
    return accessInsightByProfile.admin;
  return accessInsightByProfile.generic;
}

function SocialButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[4.65rem] items-center justify-center rounded-lg border border-white/12 bg-white/[0.045] px-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/30 hover:bg-white/[0.08]"
      aria-label={`Entrar com ${label}`}
      title={label}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-9 w-9">
      <path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3C33.65 32.66 29.22 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.39-3.92Z"
      />
      <path
        fill="#FF3D00"
        d="m6.31 14.69 6.57 4.82C14.66 15.11 18.96 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 16.32 4 9.66 8.34 6.31 14.69Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.17 0 9.86-1.98 13.41-5.19l-6.19-5.24C29.21 35.09 26.71 36 24 36c-5.2 0-9.62-3.32-11.28-7.95L6.2 33.08C9.51 39.56 16.23 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.61 20.08H42V20H24v8h11.3a12.04 12.04 0 0 1-4.08 5.57l6.19 5.24C36.97 39.2 44 34 44 24c0-1.34-.14-2.65-.39-3.92Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9 text-white">
      <path
        fill="currentColor"
        d="M16.37 1.43c0 1.12-.41 2.15-1.18 2.96-.79.84-2.05 1.48-3.17 1.39-.14-1.08.45-2.23 1.16-2.97.79-.85 2.18-1.46 3.19-1.38ZM20.02 17.5c-.57 1.31-.84 1.9-1.58 3.06-1.03 1.58-2.48 3.55-4.27 3.57-1.6.01-2.01-1.04-4.18-1.03-2.17.01-2.62 1.05-4.22 1.03-1.8-.02-3.17-1.79-4.2-3.37C-1.3 16.35-1.6 11.18.17 8.43c1.26-1.95 3.24-3.1 5.11-3.1 1.9 0 3.09 1.04 4.66 1.04 1.53 0 2.46-1.04 4.67-1.04 1.67 0 3.44.91 4.69 2.5-4.12 2.26-3.45 8.14.72 9.67Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-9 w-9">
      <circle cx="24" cy="24" r="20" fill="#1877F2" />
      <path
        fill="#fff"
        d="M29.16 25.33 30 20.02h-5.05v-3.45c0-1.45.7-2.87 2.96-2.87h2.3V9.18S28.12 8.82 26.13 8.82c-4.15 0-6.86 2.54-6.86 7.14v4.06h-4.62v5.31h4.62v12.85h5.68V25.33h4.21Z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useAuthToken();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<DemoProfile>("admin");
  const reason = searchParams.get("reason");

  useEffect(() => {
    if (reason === "expired") {
      toast.info("Sua sessão expirou. Faça login novamente.");
    }

    if (reason === "inactive") {
      toast.info("Sua conta não está ativa para acesso.");
    }
  }, [reason]);

  const publicAdminRegistrationEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_PUBLIC_ADMIN_REGISTRATION_ENABLED === "true";
  const demoUiEnabled =
    process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const registrationHref = publicAdminRegistrationEnabled
    ? "/register/assessoria"
    : "/register/atleta";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  const emailValue = watch("email") ?? "";
  const passwordValue = watch("password") ?? "";
  const rememberMe = watch("rememberMe") ?? true;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim());
  const accessInsight = useMemo(
    () => resolveAccessInsight(emailValue, selectedProfile),
    [emailValue, selectedProfile],
  );
  const readinessItems = [
    { label: "E-mail válido", active: emailLooksValid },
    { label: "Senha 8+", active: passwordValue.length >= 8 },
    { label: rememberMe ? "Sessão lembrada" : "Sessão única", active: true },
  ];

  const fillDemoCredentials = (profileId: DemoProfile) => {
    const profile = demoProfiles.find((item) => item.id === profileId);
    if (!profile) return;

    setSelectedProfile(profileId);
    setValue("email", profile.email, { shouldDirty: true, shouldValidate: true });
    setValue("password", profile.password, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: LoginInput) => {
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as
        | LoginSuccessResponse
        | LoginMfaResponse
        | LoginErrorResponse;

      if (!response.ok) {
        const message =
          "error" in payload
            ? (payload.error?.message ?? "Não foi possível autenticar. Tente novamente.")
            : "Não foi possível autenticar. Tente novamente.";

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
        const message = "Não foi possível autenticar. Tente novamente.";
        setError(message);
        toast.error(message);
        return;
      }

      setAuthSession({
        token: payload.accessToken,
        role: (payload.user.role as UserRole) ?? null,
        roles: payload.user.roles?.map((role) => role as UserRole),
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
      const message = "Erro de conexão. Tente novamente em instantes.";
      setError(message);
      toast.error(message);
    }
  };

  const notifySocialLogin = (provider: string) => {
    toast.info(`Login com ${provider} preparado para integração OAuth.`);
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
          Faça login para continuar <span className="text-[#f7b529]">sua jornada.</span>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <section className="rounded-xl border border-white/12 bg-white/[0.045] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f7b529] text-[#071225]">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{accessInsight.title}</p>
              <p className="mt-1 text-sm leading-5 text-slate-300">{accessInsight.description}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/10 bg-[#071225]/64 px-3 py-2">
              <p className="text-[0.68rem] font-bold uppercase text-slate-400">Destino</p>
              <p className="mt-1 text-sm font-semibold text-white">{accessInsight.destination}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#071225]/64 px-3 py-2">
              <p className="text-[0.68rem] font-bold uppercase text-slate-400">Proteção</p>
              <p className="mt-1 text-sm font-semibold text-white">{accessInsight.guard}</p>
            </div>
          </div>
        </section>

        {demoUiEnabled ? (
          <section className="rounded-xl border border-[#f7b529]/22 bg-[#f7b529]/8 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f7b529]" />
                <p className="text-sm font-semibold text-white">Acesso rápido de demonstração</p>
              </div>
              <span className="rounded-full bg-[#f7b529]/14 px-2.5 py-1 text-[0.68rem] font-bold uppercase text-[#ffd27a]">
                Demo
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {demoProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => fillDemoCredentials(profile.id)}
                  className={`rounded-lg border px-3 py-3 text-left transition ${
                    selectedProfile === profile.id
                      ? "border-[#f7b529]/60 bg-[#f7b529]/12"
                      : "border-white/10 bg-white/[0.035] hover:border-white/24"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <ClipboardList className="h-4 w-4 text-[#f7b529]" />
                    {profile.label}
                  </span>
                  <span className="mt-1 block text-[0.72rem] leading-4 text-slate-300">
                    {profile.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-bold uppercase text-slate-100">
            E-mail
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              className="h-16 rounded-lg border-white/18 bg-white/[0.055] pl-12 text-base text-white placeholder:text-slate-400 focus-visible:ring-[#f7b529]"
              {...register("email")}
            />
          </div>
          {errors.email ? <p className="text-xs text-amber-300">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-bold uppercase text-slate-100">
            Senha
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-16 rounded-lg border-white/18 bg-white/[0.055] pl-12 pr-12 text-base text-white placeholder:text-slate-300 focus-visible:ring-[#f7b529]"
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

        <div className="grid gap-2 sm:grid-cols-3">
          {readinessItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                item.active
                  ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.035] text-slate-400"
              }`}
            >
              {item.active ? <CheckCircle2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              {item.label}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-100 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-white/15 bg-transparent accent-[#f7b529] focus:ring-[#f7b529]"
              {...register("rememberMe")}
            />
            <span>Lembrar-me</span>
          </label>
          <Link
            href="/forgot-password"
            className="font-medium text-[#f7b529] transition hover:text-[#ffd27a]"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="h-16 w-full rounded-lg bg-[#f7b529] px-5 text-base font-black text-[#06101f] shadow-[0_16px_42px_rgba(247,181,41,0.34)] hover:bg-[#ffbf3e] disabled:opacity-55"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2 text-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando acesso...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2 text-center leading-5 sm:gap-3">
              <span>{isValid ? "ACESSAR MINHA EVOLUÇÃO" : "PREENCHA PARA CONTINUAR"}</span>
              <ArrowRight className="h-5 w-5" />
            </span>
          )}
        </Button>

        <div className="relative hidden py-2 text-center sm:block">
          <span className="relative z-10 bg-[#050d1b] px-4 text-sm text-slate-200">
            ou continue com
          </span>
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        </div>

        <div className="hidden gap-3 sm:grid sm:grid-cols-3">
          <SocialButton label="Google" onClick={() => notifySocialLogin("Google")}>
            <GoogleIcon />
          </SocialButton>
          <SocialButton label="Apple" onClick={() => notifySocialLogin("Apple")}>
            <AppleIcon />
          </SocialButton>
          <SocialButton label="Facebook" onClick={() => notifySocialLogin("Facebook")}>
            <FacebookIcon />
          </SocialButton>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex items-start gap-3 text-sm text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p>
              A sessão usa token seguro, respeita permissões por papel e aciona MFA quando a conta
              exige verificação adicional.
            </p>
          </div>
        </div>

        <p className="flex flex-wrap items-center justify-center gap-2 pt-1 text-base text-slate-100 sm:text-lg">
          Ainda não tem conta?
          <Link
            href={registrationHref}
            className="inline-flex items-center gap-2 font-medium text-[#f7b529] transition hover:text-[#ffd27a]"
          >
            Começar agora
            <ArrowRight className="h-5 w-5" />
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
