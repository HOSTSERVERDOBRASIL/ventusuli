"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { AuthShell } from "@/components/auth/AuthShell";
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
    <AuthShell
      title="Recupere seu acesso"
      description="Informe seu email para receber o link de redefinicao e retomar sua jornada."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-100" htmlFor="email">
            E-mail
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="voce@assessoria.com"
              autoComplete="email"
              className="h-14 rounded-xl border-white/12 bg-white/6 pl-12 text-white placeholder:text-slate-400 focus-visible:ring-[#f7b529]"
              {...register("email")}
            />
          </div>
          {errors.email ? <p className="text-xs text-amber-300">{errors.email.message}</p> : null}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-14 w-full rounded-xl bg-[#f7b529] text-base font-semibold text-[#091223] hover:bg-[#ffbf3e]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
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
          <Link href="/login" className="inline-flex items-center gap-2 font-semibold text-[#f7b529] hover:text-[#ffd27a]">
            <ArrowLeft className="h-4 w-4" />
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
