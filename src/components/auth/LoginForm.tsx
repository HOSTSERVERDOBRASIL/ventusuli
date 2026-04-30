"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
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
      className="flex h-[4.65rem] items-center justify-center rounded-lg border border-white/14 bg-white/[0.045] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/30 hover:bg-white/[0.08]"
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
  const registrationHref = publicAdminRegistrationEnabled
    ? "/register/assessoria"
    : "/register/atleta";

  const {
    register,
    handleSubmit,
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {error ? (
          <div
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-slate-100">
            E-mail
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="h-12 rounded-lg border-white/18 bg-white/[0.055] pl-12 text-base text-white placeholder:text-slate-400 focus-visible:ring-[#f7b529] sm:h-[3.25rem]"
              {...register("email")}
            />
          </div>
          {errors.email ? (
            <p id="email-error" className="text-xs text-amber-300">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-slate-100">
            Senha
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="h-12 rounded-lg border-white/18 bg-white/[0.055] pl-12 pr-12 text-base text-white placeholder:text-slate-300 focus-visible:ring-[#f7b529] sm:h-[3.25rem]"
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
            <p id="password-error" className="text-xs text-amber-300">
              {errors.password.message}
            </p>
          ) : null}
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
          className="h-[3.25rem] w-full rounded-lg bg-[#f7b529] px-5 text-base font-semibold text-[#06101f] shadow-[0_14px_34px_rgba(247,181,41,0.28)] hover:bg-[#ffbf3e] disabled:opacity-55 sm:h-14"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2 text-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando acesso...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2 text-center leading-5 sm:gap-3">
              <span>{isValid ? "Acessar minha evolução" : "Preencha para continuar"}</span>
              <ArrowRight className="h-5 w-5" />
            </span>
          )}
        </Button>

        <div className="relative hidden py-1 text-center">
          <span className="relative z-10 bg-[#050d1b] px-4 text-sm text-slate-200">
            ou continue com
          </span>
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/12" />
        </div>

        <div className="hidden grid-cols-3 gap-3">
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

        <p className="flex flex-wrap items-center justify-center gap-2 text-base text-slate-100">
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
