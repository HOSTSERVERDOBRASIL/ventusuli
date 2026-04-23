"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { AuthCard } from "@/components/ui/auth-card";
import { Label } from "@/components/ui/label";
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
        message: "As senhas nao coincidem",
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
        toast.error(payload.error?.message ?? "Nao foi possivel redefinir a senha.");
        return;
      }

      toast.success(payload.message ?? "Senha redefinida com sucesso.");
      router.push("/login?reason=expired");
    } catch {
      toast.error("Erro de conexao. Tente novamente.");
    }
  };

  if (!token) {
    return (
      <AuthCard title="Redefinir senha" description="Token ausente ou invalido.">
        <div className="space-y-4">
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Link de recuperacao invalido.
          </div>
          <Button asChild className="h-10 w-full bg-[#F5A623] text-[#0A1628] hover:bg-[#e59a1f]">
            <Link href="/forgot-password">Solicitar novo link</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Redefinir senha" description="Defina uma nova senha para acessar sua conta.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <input type="hidden" {...register("token")} />

        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-100">
            Nova senha
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Nova senha"
              autoComplete="new-password"
              className="border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]"
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
          <Label htmlFor="confirmPassword" className="text-slate-100">
            Confirmar nova senha
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirme a nova senha"
              autoComplete="new-password"
              className="border-white/15 bg-[#0F2743] pr-11 text-white placeholder:text-slate-400 focus-visible:ring-[#F5A623]"
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
          className="h-11 w-full bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redefinindo...
            </span>
          ) : (
            "Redefinir senha"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
