"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AuthCard } from "@/components/ui/auth-card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FormInput = z.infer<typeof forgotPasswordSchema>;

interface ForgotResponse {
  message?: string;
  debug?: {
    resetLink?: string;
    expiresAt?: string;
  };
  error?: { message?: string };
}

export function ForgotPasswordForm() {
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [debugLink, setDebugLink] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: FormInput) => {
    setResultMessage(null);
    setDebugLink(null);

    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = (await response.json()) as ForgotResponse;
      if (!response.ok) {
        const message = payload.error?.message ?? "Nao foi possivel processar a solicitacao.";
        toast.error(message);
        return;
      }

      const message = payload.message ?? "Se o email existir, enviamos o link de recuperacao.";
      setResultMessage(message);
      if (payload.debug?.resetLink) setDebugLink(payload.debug.resetLink);
      toast.success(message);
    } catch {
      toast.error("Erro de conexao. Tente novamente.");
    }
  };

  return (
    <AuthCard title="Esqueci minha senha" description="Informe seu email para recuperar o acesso.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando...
            </span>
          ) : (
            "Enviar link"
          )}
        </Button>

        {resultMessage ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {resultMessage}
          </div>
        ) : null}

        {debugLink ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Ambiente de desenvolvimento: link direto de reset
            <br />
            <a href={debugLink} className="break-all underline">
              {debugLink}
            </a>
          </div>
        ) : null}

        <p className="text-center text-sm text-slate-200">
          Lembrou a senha?{" "}
          <Link href="/login" className="font-semibold text-[#F5A623] hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
