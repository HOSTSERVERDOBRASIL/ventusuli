"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = resetPasswordSchema
  .extend({
    confirmPassword: z.string({ required_error: "Confirme sua senha" }).min(1, "Confirme sua senha"),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As senhas não coincidem",
        path: ["confirmPassword"],
      });
    }
  });

type FormInput = z.infer<typeof formSchema>;

interface ResetResponse {
  message?: string;
  error?: { message?: string };
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { token },
  });

  const onSubmit = async (data: FormInput) => {
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.token,
          password: data.password,
        }),
      });

      const payload = (await response.json()) as ResetResponse;
      if (!response.ok) {
        toast.error(payload.error?.message ?? "Não foi possível redefinir a senha.");
        return;
      }

      toast.success(payload.message ?? "Senha redefinida com sucesso.");
      router.push("/login?reason=expired");
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="Redefinir senha"
        description="O link de recuperação precisa de um token válido para continuar."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Link de recuperação inválido.
          </div>
          <Button asChild className="h-14 w-full rounded-xl bg-[#f7b529] font-semibold text-[#091223] hover:bg-[#ffbf3e]">
            <Link href="/forgot-password">Solicitar novo link</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Defina sua nova senha"
      description="Crie uma nova credencial forte para voltar ao Ventu Suli com segurança."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register("token")} />

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-slate-100"
          >
            Nova senha
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Nova senha"
              autoComplete="new-password"
              className="h-14 rounded-xl border-white/12 bg-white/6 pl-12 pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#f7b529]"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-white"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-xs text-amber-300">{errors.password.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-slate-100"
          >
            Confirmar nova senha
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirme a nova senha"
              autoComplete="new-password"
              className="h-14 rounded-xl border-white/12 bg-white/6 pl-12 pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#f7b529]"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-white"
              aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
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
          className="h-14 w-full rounded-xl bg-[#f7b529] text-base font-semibold text-[#091223] hover:bg-[#ffbf3e]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Redefinindo...
            </span>
          ) : (
            "Redefinir senha"
          )}
        </Button>

        <p className="text-center text-sm text-slate-300">
          <Link href="/login" className="inline-flex items-center gap-2 font-semibold text-[#f7b529] hover:text-[#ffd27a]">
            <ArrowLeft className="h-4 w-4" />
            Voltar para login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
