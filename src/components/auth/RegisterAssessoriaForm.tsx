"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { registerAdminSchema } from "@/lib/validations/auth";
import { UserRole } from "@/types";

const formSchema = registerAdminSchema
  .extend({
    confirmPassword: z.string({ required_error: "Confirme sua senha" }).min(1, "Confirme sua senha"),
    termsAccepted: z.boolean().refine((value) => value, {
      message: "Voce precisa aceitar os termos para continuar",
    }),
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

interface RegisterResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const PASSWORD_RULES = [
  { label: "Minimo de 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Ao menos uma letra maiuscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Ao menos um numero", test: (value: string) => /[0-9]/.test(value) },
  { label: "Ao menos uma letra minuscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Ao menos um simbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function RegisterAssessoriaForm() {
  const router = useRouter();
  const { setAuthSession } = useAuthToken();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { termsAccepted: false },
  });

  const passwordValue = watch("password") ?? "";
  const passwordStatus = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ label: rule.label, valid: rule.test(passwordValue) })),
    [passwordValue],
  );

  const passwordScore = passwordStatus.filter((item) => item.valid).length;
  const passwordPercent = (passwordScore / PASSWORD_RULES.length) * 100;
  const strengthLabel =
    passwordScore <= 2 ? "Fraca" : passwordScore === 3 ? "Media" : passwordScore === 4 ? "Boa" : "Forte";
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
      const response = await fetch("/api/auth/register-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          orgName: data.orgName,
        }),
      });

      const payload = (await response.json()) as RegisterResponse | { error?: { message?: string } };

      if (!response.ok || !("accessToken" in payload)) {
        const message =
          "error" in payload
            ? (payload.error?.message ?? "Nao foi possivel criar sua assessoria.")
            : "Nao foi possivel criar sua assessoria.";
        setError(message);
        toast.error(message);
        return;
      }

      setAuthSession({ token: payload.accessToken, role: (payload.user.role as UserRole) ?? null });
      toast.success("Assessoria criada com sucesso.");
      router.push("/dashboard");
    } catch {
      const message = "Erro de conexao. Tente novamente em instantes.";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <AuthCard title="Criar assessoria" description="Cadastre sua assessoria e acesse o painel administrativo.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error ? <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-100">Nome completo</Label>
          <Input id="name" placeholder="Seu nome" autoComplete="name" className="auth-readable-input border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("name")} />
          {errors.name ? <p className="text-xs text-amber-300">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="orgName" className="text-slate-100">Nome da assessoria</Label>
          <Input id="orgName" placeholder="Ex: Atlas Assessoria" autoComplete="organization" className="auth-readable-input border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("orgName")} />
          {errors.orgName ? <p className="text-xs text-amber-300">{errors.orgName.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-100">Email</Label>
          <Input id="email" type="email" placeholder="voce@assessoria.com" autoComplete="email" className="auth-readable-input border-white/15 bg-[#0F2743] text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("email")} />
          {errors.email ? <p className="text-xs text-amber-300">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-100">Senha</Label>
          <div className="relative">
            <Input id="password" type={showPassword ? "text" : "password"} placeholder="Crie sua senha" autoComplete="new-password" className="auth-readable-input border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("password")} />
            <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((prev) => !prev)} className="auth-readable-toggle absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-[#071225]">
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
            <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Repita sua senha" autoComplete="new-password" className="auth-readable-input border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]" {...register("confirmPassword")} />
            <button type="button" aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowConfirmPassword((prev) => !prev)} className="auth-readable-toggle absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-[#071225]">
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
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Criando assessoria...</span>
          ) : (
            "Criar assessoria"
          )}
        </Button>

        <p className="text-center text-sm text-slate-200">
          Ja possui conta? <Link href="/login" className="font-semibold text-[#F5A623] hover:underline">Entrar</Link>
        </p>
        <p className="text-center text-sm text-slate-300">
          E atleta? <Link href="/register/atleta" className="font-semibold text-[#F5A623] hover:underline">Cadastrar com assessoria</Link>
        </p>
      </form>
    </AuthCard>
  );
}
