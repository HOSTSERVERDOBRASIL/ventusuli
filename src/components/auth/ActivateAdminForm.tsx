"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateAdminSchema } from "@/lib/validations/auth";
import { UserRole } from "@/types";

const formSchema = activateAdminSchema
  .extend({
    confirmPassword: z.string({ required_error: "Confirme sua senha" }).min(1, "Confirme sua senha"),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As senhas nao coincidem",
        path: ["confirmPassword"],
      });
    }
  });

type FormInput = z.infer<typeof formSchema>;

interface InviteLookupPayload {
  data?: {
    email: string;
    organization: {
      id: string;
      name: string;
      slug: string;
      plan: string;
    };
    expiresAt: string | null;
  };
  error?: { message?: string };
}

interface ActivateResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  organization?: {
    status?: string;
    setup_completed_at?: string | null;
  };
}

const PASSWORD_RULES = [
  { label: "Minimo de 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Ao menos uma letra maiuscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Ao menos um numero", test: (value: string) => /[0-9]/.test(value) },
] as const;

export function ActivateAdminForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useAuthToken();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string>("");
  const token = searchParams.get("token")?.trim() ?? "";

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { token: token ?? "" },
  });

  const passwordValue = watch("password") ?? "";
  const passwordStatus = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ label: rule.label, valid: rule.test(passwordValue) })),
    [passwordValue],
  );

  useEffect(() => {
    setValue("token", token, { shouldValidate: true });
  }, [setValue, token]);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setLoadingInvite(false);
        setInviteError("Token de convite ausente.");
        return;
      }

      setLoadingInvite(true);
      setInviteError(null);
      try {
        const response = await fetch(`/api/auth/admin-invite/${encodeURIComponent(token)}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as InviteLookupPayload;

        if (!response.ok || !payload.data) {
          setInviteError(payload.error?.message ?? "Convite invalido ou expirado.");
          return;
        }

        setInviteEmail(payload.data.email);
        setOrganizationName(payload.data.organization.name);
      } catch {
        setInviteError("Nao foi possivel validar o convite agora.");
      } finally {
        setLoadingInvite(false);
      }
    };

    void run();
  }, [token]);

  const onSubmit = async (data: FormInput) => {
    try {
      const response = await fetch("/api/auth/accept-admin-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.token,
          name: data.name,
          password: data.password,
        }),
      });

      const payload = (await response.json()) as ActivateResponse | { error?: { message?: string } };
      if (!response.ok || !("accessToken" in payload)) {
        toast.error(
          "error" in payload
            ? (payload.error?.message ?? "Nao foi possivel ativar a conta agora.")
            : "Nao foi possivel ativar a conta agora.",
        );
        return;
      }

      setAuthSession({
        token: payload.accessToken,
        role: (payload.user.role as UserRole) ?? null,
      });
      toast.success("Conta ativada com sucesso.");
      const organizationStatus = payload.organization?.status ?? "";
      const setupCompletedAt = payload.organization?.setup_completed_at ?? null;
      if (organizationStatus === "PENDING_SETUP" || !setupCompletedAt) {
        router.push("/onboarding/assessoria");
        return;
      }

      router.push("/admin");
    } catch {
      toast.error("Erro de conexao. Tente novamente.");
    }
  };

  if (loadingInvite) {
    return (
      <AuthCard title="Ativar conta de admin" description="Validando convite comercial.">
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#F5A623]" />
        </div>
      </AuthCard>
    );
  }

  if (inviteError) {
    return (
      <AuthCard title="Ativar conta de admin" description="Convite indisponivel.">
        <div className="space-y-4">
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {inviteError}
          </div>
          <p className="text-sm text-slate-200">
            Solicite um novo convite ao time comercial ou ao SUPER_ADMIN da plataforma.
          </p>
          <Button asChild className="h-10 w-full bg-[#F5A623] text-[#0A1628] hover:bg-[#e59a1f]">
            <Link href="/login">Voltar para login</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Ativar conta de admin"
      description={`Ative sua conta administrativa para ${organizationName}.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-md border border-white/10 bg-[#102D4B] px-3 py-2 text-sm text-slate-200">
          Convite para: <span className="font-semibold text-white">{inviteEmail}</span>
        </div>

        <input type="hidden" {...register("token")} />

        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-100">
            Nome completo
          </Label>
          <Input
            id="name"
            placeholder="Seu nome"
            autoComplete="name"
            className="auth-readable-input border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]"
            {...register("name")}
          />
          {errors.name ? <p className="text-xs text-amber-300">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-100">
            Senha
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Crie sua senha"
              autoComplete="new-password"
              className="auth-readable-input border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="auth-readable-toggle absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-[#071225]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-xs text-amber-300">{errors.password.message}</p> : null}
        </div>

        <ul className="space-y-1.5 rounded-md border border-white/10 bg-[#102D4B] p-3 text-xs text-slate-300">
          {passwordStatus.map((rule) => (
            <li key={rule.label} className="flex items-center gap-2">
              {rule.valid ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>{rule.label}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-100">
            Confirmar senha
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Repita sua senha"
              autoComplete="new-password"
              className="auth-readable-input border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
              className="auth-readable-toggle absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-[#071225]"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword ? (
            <p className="text-xs text-amber-300">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ativando conta...
            </span>
          ) : (
            "Ativar conta"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
