"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Shield, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/ui/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { UserRole } from "@/types";

interface LoginResponse {
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

type LoginErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type PlatformOrTenantAdminRole = "SUPER_ADMIN" | "ADMIN";

function resolvePostLoginPath(
  role: string,
  hasCpf: boolean,
  nextParam: string | null,
  organizationStatus?: string,
  setupCompletedAt?: string | null,
): string {
  const isPlatformOrTenantAdmin = (
    ["SUPER_ADMIN", "ADMIN"] as PlatformOrTenantAdminRole[]
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
    if (nextParam && nextParam.startsWith("/admin")) return nextParam;
    return "/admin";
  }

  if (!hasCpf) return "/onboarding/atleta";
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("/admin")) return nextParam;
  return "/";
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
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    reValidateMode: "onChange",
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

      const payload = (await response.json()) as LoginResponse | LoginErrorResponse;

      if (!response.ok || !("accessToken" in payload)) {
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

  return (
    <AuthCard title="Entrar" description="Acesse sua conta para continuar no Ventu Suli.">
      {demoUiEnabled ? (
        <section className="mb-5 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Modo demonstracao</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void quickDemoLogin("admin")}
              className="cursor-pointer rounded-xl border border-[#F5A623]/30 bg-[#0F2743] p-3 text-left transition hover:border-[#F5A623]/60"
            >
              <Shield className="mb-2 h-4 w-4 text-[#F5A623]" />
              <p className="text-sm font-semibold text-white">Assessoria</p>
              <p className="text-xs text-slate-300">Gestao completa</p>
            </button>
            <button
              type="button"
              onClick={() => void quickDemoLogin("athlete")}
              className="cursor-pointer rounded-xl border border-white/10 bg-[#0F2743] p-3 text-left transition hover:border-white/60"
            >
              <User className="mb-2 h-4 w-4 text-slate-200" />
              <p className="text-sm font-semibold text-white">Atleta</p>
              <p className="text-xs text-slate-300">Visao do corredor</p>
            </button>
          </div>
          <div className="relative py-1 text-center">
            <span className="relative z-10 bg-[#102D4B] px-3 text-xs text-slate-300">
              ou entre com suas credenciais
            </span>
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
          </div>
        </section>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-100">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="voce@assessoria.com"
            autoComplete="email"
            className="border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]"
            {...register("email")}
          />
          {errors.email ? <p className="text-xs text-amber-300">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-100">
            Senha
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              className="border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]"
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-amber-300">{errors.password.message}</p>
          ) : null}
        </div>

        <p className="text-right text-sm text-slate-300">
          <Link href="/forgot-password" className="hover:text-[#F5A623] hover:underline">
            Esqueci minha senha
          </Link>
        </p>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Entrando...
            </span>
          ) : (
            "Entrar"
          )}
        </Button>

        {publicAdminRegistrationEnabled ? (
          <p className="text-center text-sm text-slate-200">
            Ainda nao tem conta?{" "}
            <Link
              href="/register/assessoria"
              className="font-semibold text-[#F5A623] hover:underline"
            >
              Cadastrar assessoria
            </Link>
          </p>
        ) : (
          <p className="text-center text-sm text-slate-300">
            Cadastro de assessoria apenas por convite comercial.
          </p>
        )}

        <p className="text-center text-sm text-slate-300">
          Sou atleta e tenho convite:{" "}
          <Link href="/register/atleta" className="font-semibold text-[#F5A623] hover:underline">
            Cadastrar atleta
          </Link>
        </p>

        <p className="text-center text-sm text-slate-300">
          Recebi convite de admin:{" "}
          <Link href="/activate-admin" className="font-semibold text-[#F5A623] hover:underline">
            Ativar conta
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
