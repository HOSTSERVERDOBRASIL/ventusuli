"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  type LucideIcon,
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

function TrustItem({ icon: Icon, label }: { icon: LucideIcon; label: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold leading-tight text-[#dbeafe]">
      <Icon className="h-4 w-4 shrink-0 text-slate-300" />
      <span>{label}</span>
    </div>
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
        roles: payload.user.roles?.map((role) => role as UserRole),
        user: {
          id: payload.user.id,
          name: payload.user.name,
          email: payload.user.email,
          avatar_url: payload.user.avatar_url ?? null,
        },
        profile: payload.profile ?? null,
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

  return (
    <AuthShell
      fitViewport
      title={
        <>
          Bem-vindo de <span className="text-[#ffc229]">volta!</span>
        </>
      }
      description={
        <>
          Continue sua <span className="text-[#ffc229]">evolucao</span> no Ventu Suli.
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {error ? (
          <div
            className="rounded-[14px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-bold text-slate-50">
            E-mail
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              id="email"
              type="email"
              placeholder="mateus@ventusuli.com.br"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="h-11 rounded-xl border-transparent bg-[#edf4ff] pl-12 text-[15px] text-slate-950 placeholder:text-slate-500 shadow-none ring-offset-transparent focus-visible:border-[#ffc229] focus-visible:ring-[#ffc229]/20 sm:h-12"
              {...register("email")}
            />
          </div>
          {errors.email ? (
            <p id="email-error" className="text-xs text-amber-300">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-bold text-slate-50">
            Senha
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="h-11 rounded-xl border-transparent bg-[#edf4ff] pl-12 pr-12 text-[15px] text-slate-950 placeholder:text-slate-500 shadow-none ring-offset-transparent focus-visible:border-[#ffc229] focus-visible:ring-[#ffc229]/20 sm:h-12"
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-900"
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

        <div className="flex flex-col gap-2 text-[13px] font-semibold text-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              className="h-[18px] w-[18px] rounded border-white/15 bg-transparent accent-[#ffc229] focus:ring-[#ffc229]"
              {...register("rememberMe")}
            />
            <span>Manter conectado</span>
          </label>
          <Link
            href="/forgot-password"
            className="font-bold text-[#ffc229] transition hover:text-[#ffd872]"
          >
            Esqueci minha senha
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="h-12 w-full rounded-xl bg-[linear-gradient(180deg,#ffca3a,#f3ad12)] px-5 text-base font-extrabold text-[#07111f] shadow-[0_14px_30px_rgba(255,194,41,0.25)] hover:-translate-y-0.5 hover:bg-[#ffca3a] hover:shadow-[0_18px_38px_rgba(255,194,41,0.32)] disabled:opacity-55"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2 text-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando acesso...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2 text-center leading-5 sm:gap-3">
              <span>{isValid ? "Entrar e evoluir" : "Preencha para continuar"}</span>
              <ArrowRight className="h-5 w-5" />
            </span>
          )}
        </Button>

        <p className="flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold text-slate-100">
          Ainda nao tem conta?
          <Link
            href={registrationHref}
            className="inline-flex items-center gap-2 font-extrabold text-[#ffc229] transition hover:text-[#ffd872]"
          >
            Comecar agora
            <ArrowRight className="h-5 w-5" />
          </Link>
        </p>

        <div className="h-px bg-white/12" />

        <div className="grid gap-2 sm:grid-cols-3">
          <TrustItem
            icon={ShieldCheck}
            label={
              <>
                Seus dados
                <br />
                protegidos
              </>
            }
          />
          <TrustItem
            icon={BarChart3}
            label={
              <>
                100% focado na
                <br />
                sua evolucao
              </>
            }
          />
          <TrustItem
            icon={Heart}
            label={
              <>
                Feito para
                <br />
                atletas reais
              </>
            }
          />
        </div>

        <p className="text-center text-[12px] leading-5 text-slate-300">
          Ao continuar, voce concorda com nossos
          <br />
          <Link href="#" className="font-bold text-sky-300 transition hover:text-sky-200">
            Termos de Uso
          </Link>{" "}
          -{" "}
          <Link href="#" className="font-bold text-sky-300 transition hover:text-sky-200">
            Politica de Privacidade
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
