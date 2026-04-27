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
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/ui/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAthleteSchemaBase } from "@/lib/validations/auth";
import { UserRole } from "@/types";

const formSchema = registerAthleteSchemaBase
  .extend({
    confirmPassword: z.string({ required_error: "Confirme sua senha" }).min(1, "Confirme sua senha"),
    termsAccepted: z.boolean().refine((value) => value, {
      message: "VocÃª precisa aceitar os termos para continuar",
    }),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As senhas nÃ£o coincidem",
        path: ["confirmPassword"],
      });
    }
  });

type FormInput = z.infer<typeof formSchema>;

interface RegisterResponse {
  accessToken?: string;
  requiresApproval?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    athleteStatus?: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
  };
}

interface OrganizationBySlugResponse {
  data: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    requireAthleteApproval: boolean;
    allowAthleteSelfSignup: boolean;
  };
}

const PASSWORD_RULES = [
  { label: "MÃ­nimo de 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Ao menos uma letra maiÃºscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Ao menos um nÃºmero", test: (value: string) => /[0-9]/.test(value) },
  { label: "Ao menos uma letra minÃºscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Ao menos um sÃ­mbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function RegisterAtletaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useAuthToken();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [organizationPreview, setOrganizationPreview] = useState<OrganizationBySlugResponse["data"] | null>(null);
  const [validatingSlug, setValidatingSlug] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { termsAccepted: false, organizationSlug: "", inviteToken: "" },
  });

  useEffect(() => {
    const token = searchParams.get("inviteToken") ?? searchParams.get("token");
    if (token) setValue("inviteToken", token, { shouldValidate: true });
  }, [searchParams, setValue]);

  const passwordValue = watch("password") ?? "";
  const watchedSlug = watch("organizationSlug") ?? "";
  const watchedInvite = watch("inviteToken") ?? "";
  const passwordStatus = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ label: rule.label, valid: rule.test(passwordValue) })),
    [passwordValue],
  );

  useEffect(() => {
    if (watchedInvite.trim()) {
      setOrganizationPreview(null);
      return;
    }

    if (!watchedSlug.trim()) {
      setOrganizationPreview(null);
    }
  }, [watchedInvite, watchedSlug]);

  const passwordScore = passwordStatus.filter((item) => item.valid).length;
  const passwordPercent = (passwordScore / PASSWORD_RULES.length) * 100;
  const strengthLabel =
    passwordScore <= 2 ? "Fraca" : passwordScore === 3 ? "MÃ©dia" : passwordScore === 4 ? "Boa" : "Forte";
  const strengthColor =
    passwordScore <= 2
      ? "bg-red-400"
      : passwordScore === 3
        ? "bg-orange-400"
        : passwordScore === 4
          ? "bg-yellow-300"
          : "bg-emerald-400";

  const onSubmit = async (data: FormInput) => {
    setError(null);

    try {
      const response = await fetch("/api/auth/register-athlete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          organizationSlug: data.organizationSlug?.trim() || undefined,
          inviteToken: data.inviteToken?.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as RegisterResponse | { error?: { message?: string } };

      if (!response.ok || !("user" in payload)) {
        const message =
          "error" in payload
            ? (payload.error?.message ?? "NÃ£o foi possÃ­vel criar sua conta de atleta.")
            : "NÃ£o foi possÃ­vel criar sua conta de atleta.";
        setError(message);
        toast.error(message);
        return;
      }

      const isPending = payload.user.athleteStatus === "PENDING_APPROVAL";
      if (isPending || !payload.accessToken) {
        toast.success("Cadastro enviado. Sua conta aguarda aprovacao da assessoria.");
        router.push("/aguardando-aprovacao");
        return;
      }

      setAuthSession({ token: payload.accessToken, role: (payload.user.role as UserRole) ?? null });
      toast.success("Conta de atleta criada com sucesso.");
      router.push("/dashboard");
    } catch {
      const message = "Erro de conexÃ£o. Tente novamente em instantes.";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <AuthCard title="Criar conta de atleta" description="Entre em uma assessoria usando slug ou token de convite.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error ? <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-100">Nome completo</Label>
          <Input id="name" placeholder="Seu nome" autoComplete="name" className="border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("name")} />
          {errors.name ? <p className="text-xs text-amber-300">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationSlug" className="text-slate-100">Slug da assessoria</Label>
          <div className="flex gap-2">
            <Input id="organizationSlug" placeholder="Ex: assessoria-ventu-demo" autoComplete="off" className="border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("organizationSlug")} />
            <Button
              type="button"
              variant="outline"
              className="border-white/20 bg-[#0F2743] text-white hover:bg-[#14375C]"
              disabled={!watchedSlug.trim() || Boolean(watchedInvite.trim()) || validatingSlug}
              onClick={async () => {
                const slug = watchedSlug.trim().toLowerCase();
                if (!slug) return;
                setValidatingSlug(true);
                try {
                  const response = await fetch(`/api/organizations/by-slug/${encodeURIComponent(slug)}`, {
                    method: "GET",
                    cache: "no-store",
                  });
                  const payload = (await response.json()) as OrganizationBySlugResponse | { error?: { message?: string } };

                  if (!response.ok || !("data" in payload)) {
                    const message = "error" in payload ? payload.error?.message ?? "Slug nÃ£o encontrado." : "Slug nÃ£o encontrado.";
                    setOrganizationPreview(null);
                    toast.error(message);
                    return;
                  }

                  setOrganizationPreview(payload.data);
                  toast.success(`Assessoria encontrada: ${payload.data.name}`);
                } catch {
                  setOrganizationPreview(null);
                  toast.error("NÃ£o foi possÃ­vel validar o slug.");
                } finally {
                  setValidatingSlug(false);
                }
              }}
            >
              {validatingSlug ? "Validando..." : "Validar"}
            </Button>
          </div>
          {watchedInvite.trim() ? (
            <p className="text-xs text-slate-300">Convite preenchido: ele tem prioridade sobre o slug manual.</p>
          ) : null}
          {!watchedInvite.trim() && organizationPreview ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <p className="font-semibold">{organizationPreview.name}</p>
              <p>Slug: {organizationPreview.slug}</p>
              <p>
                AprovaÃ§Ã£o de atleta: {organizationPreview.requireAthleteApproval ? "necessÃ¡ria" : "nÃ£o exigida"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-[#102D4B] px-3 text-xs text-slate-300">ou use token de convite</span>
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inviteToken" className="text-slate-100">Token de convite</Label>
          <Input id="inviteToken" placeholder="Cole o token enviado pela assessoria" autoComplete="off" className="border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("inviteToken")} />
          {watchedInvite.trim() && !watchedSlug.trim() ? (
            <p className="text-xs text-emerald-300">Token de convite detectado â€” assessoria serÃ¡ identificada automaticamente.</p>
          ) : null}
          {errors.organizationSlug ? <p className="text-xs text-amber-300">{errors.organizationSlug.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-100">Email</Label>
          <Input id="email" type="email" placeholder="voce@email.com" autoComplete="email" className="border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("email")} />
          {errors.email ? <p className="text-xs text-amber-300">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-100">Senha</Label>
          <div className="relative">
            <Input id="password" type={showPassword ? "text" : "password"} placeholder="Crie sua senha" autoComplete="new-password" className="border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("password")} />
            <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-white">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-xs text-amber-300">{errors.password.message}</p> : null}
        </div>

        <div className="space-y-3 rounded-md border border-white/10 bg-[#102D4B] p-3">
          <div className="flex items-center justify-between text-xs text-slate-200">
            <span>Forca da senha</span>
            <span className="font-semibold text-white">{strengthLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full transition-all ${strengthColor}`} style={{ width: `${passwordPercent}%` }} />
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {passwordStatus.map((rule) => (
              <li key={rule.label} className="flex items-center gap-2">
                {rule.valid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <XCircle className="h-3.5 w-3.5 text-slate-500" />}
                <span>{rule.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-slate-100">Confirmar senha</Label>
          <div className="relative">
            <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Repita sua senha" autoComplete="new-password" className="border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("confirmPassword")} />
            <button type="button" aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-white">
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword ? <p className="text-xs text-amber-300">{errors.confirmPassword.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 text-sm text-slate-200" htmlFor="termsAccepted">
            <input id="termsAccepted" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent accent-[#F5A623]" {...register("termsAccepted")} />
            <span>Concordo com os termos de uso e politica de privacidade da plataforma.</span>
          </label>
          {errors.termsAccepted ? <p className="text-xs text-amber-300">{errors.termsAccepted.message}</p> : null}
        </div>

        <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]">
          {isSubmitting ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Criando conta...</span>
          ) : (
            "Criar conta de atleta"
          )}
        </Button>

        <p className="text-center text-sm text-slate-200">
          Ja possui conta? <Link href="/login" className="font-semibold text-[#F5A623] hover:underline">Entrar</Link>
        </p>
        <p className="text-center text-sm text-slate-300">
          Admin da assessoria? <Link href="/register/assessoria" className="font-semibold text-[#F5A623] hover:underline">Cadastrar assessoria</Link>
        </p>
      </form>
    </AuthCard>
  );
}
