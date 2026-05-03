"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Info, Loader2, Lock, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAthleteSchemaBase } from "@/lib/validations/auth";
import { UserRole } from "@/types";

const formSchema = registerAthleteSchemaBase
  .extend({
    confirmPassword: z.string({ required_error: "Confirme sua senha" }).min(1, "Confirme sua senha"),
    termsAccepted: z.boolean().refine((value) => value, {
      message: "Voce precisa aceitar os termos para continuar",
    }),
  })
  .superRefine(({ password, confirmPassword, inviteToken, organizationSlug }, ctx) => {
    if (!inviteToken?.trim() && !organizationSlug?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Abra o cadastro pelo link de convite enviado pelo grupo.",
        path: ["inviteToken"],
      });
    }

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

const PASSWORD_RULES = [
  { label: "Minimo de 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Ao menos uma letra maiuscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Ao menos um numero", test: (value: string) => /[0-9]/.test(value) },
  { label: "Ao menos um simbolo", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

const BENEFITS = [
  { title: "Amizade", description: "Conexoes que vao alem da corrida." },
  { title: "Superacao", description: "Desafie seus limites todos os dias." },
  { title: "Constancia", description: "Disciplina hoje, conquistas amanha." },
] as const;

export function RegisterAtletaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthSession } = useAuthToken();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      termsAccepted: false,
      organizationSlug: "",
      inviteToken: "",
    },
  });

  useEffect(() => {
    const token = searchParams.get("inviteToken") ?? searchParams.get("token");
    const slug = searchParams.get("organizationSlug") ?? searchParams.get("org") ?? searchParams.get("grupo");

    if (token) setValue("inviteToken", token, { shouldValidate: true });
    if (slug) setValue("organizationSlug", slug, { shouldValidate: true });
  }, [searchParams, setValue]);

  const passwordValue = watch("password") ?? "";
  const confirmPasswordValue = watch("confirmPassword") ?? "";
  const termsAccepted = Boolean(watch("termsAccepted"));
  const watchedInvite = watch("inviteToken")?.trim() ?? "";
  const watchedSlug = watch("organizationSlug")?.trim() ?? "";

  const passwordStatus = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ label: rule.label, valid: rule.test(passwordValue) })),
    [passwordValue],
  );
  const passwordScore = passwordStatus.filter((item) => item.valid).length;
  const passwordPercent = (passwordScore / PASSWORD_RULES.length) * 100;
  const passwordIsValid = passwordStatus.every((item) => item.valid);
  const passwordsMatch = Boolean(confirmPasswordValue) && passwordValue === confirmPasswordValue;
  const canCreateAccount = passwordIsValid && passwordsMatch && termsAccepted && Boolean(watchedInvite || watchedSlug);
  const strengthLabel =
    passwordScore <= 1 ? "Fraca" : passwordScore === 2 ? "Media" : passwordScore === 3 ? "Boa" : "Forte";
  const strengthColor =
    passwordScore <= 1
      ? "bg-red-400"
      : passwordScore === 2
        ? "bg-orange-400"
        : passwordScore === 3
          ? "bg-yellow-300"
          : "bg-emerald-400";

  const goToPasswordStep = async () => {
    const valid = await trigger(["name", "email", "inviteToken", "organizationSlug"]);
    if (valid) setCurrentStep(2);
  };

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
            ? (payload.error?.message ?? "Nao foi possivel criar sua conta de atleta.")
            : "Nao foi possivel criar sua conta de atleta.";
        setError(message);
        toast.error(message);
        return;
      }

      const isPending = payload.user.athleteStatus === "PENDING_APPROVAL";
      if (isPending || !payload.accessToken) {
        toast.success("Cadastro enviado. Sua conta aguarda aprovacao do grupo.");
        router.push("/aguardando-aprovacao");
        return;
      }

      setAuthSession({ token: payload.accessToken, role: (payload.user.role as UserRole) ?? null });
      toast.success("Conta de atleta criada com sucesso.");
      router.push("/dashboard");
    } catch {
      const message = "Erro de conexao. Tente novamente em instantes.";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <main className="min-h-screen bg-[#061426] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-[380px] overflow-hidden lg:min-h-screen">
          <Image
            src="/floripa-ponte.jpg"
            alt="Ponte Hercilio Luz em Florianopolis"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(3,13,27,0.45),rgba(3,13,27,0.78))]" />
          <div className="relative z-10 flex min-h-full w-full flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
            <Image
              src="/logo-ventu-suli.png"
              alt="Ventu Suli Floripa"
              width={220}
              height={180}
              priority
              className="h-auto w-[180px] object-contain drop-shadow-[0_18px_36px_rgba(0,0,0,0.45)] lg:w-[220px]"
            />

            <div className="max-w-[620px] py-10 lg:py-14">
              <h1 className="text-[40px] font-black leading-[0.98] tracking-normal text-white sm:text-[56px] lg:text-[68px]">
                Muito mais que
                <br />
                um grupo de corrida,
                <br />
                <span className="text-[#ff9f0a]">um grupo de amigos</span>
                <br />
                <span className="font-serif italic text-[#ff9f0a]">pela corrida.</span>
              </h1>
              <p className="mt-7 max-w-[460px] text-lg leading-relaxed text-[#d8e2f0]">
                Aqui, cada treino e uma oportunidade de evoluir, se superar e compartilhar boas historias.
              </p>
              <p className="mt-5 text-xl font-bold text-[#ff9f0a]">Vem correr com a gente.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="border-l border-[#ff9f0a]/60 pl-4">
                  <p className="text-sm font-bold uppercase tracking-[0.08em] text-white">{benefit.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#c8d5e6]">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="w-full max-w-[620px] rounded-[28px] border border-[rgba(91,140,190,0.35)] bg-[rgba(5,18,34,0.94)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10 lg:p-12"
          >
            <input type="hidden" {...register("inviteToken")} />
            <input type="hidden" {...register("organizationSlug")} />

            <div className="mb-8">
              <div className="mb-5 grid grid-cols-2 gap-3">
                {[1, 2].map((step) => {
                  const active = currentStep === step;
                  return (
                    <div
                      key={step}
                      className={`h-2 rounded-full transition ${
                        active ? "bg-[#ff9f0a]" : step < currentStep ? "bg-emerald-400" : "bg-white/12"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#ff9f0a]">
                {currentStep === 1 ? "1 Dados pessoais" : "2 Senha"}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-normal text-white sm:text-4xl">Criar sua conta</h2>
              <p className="mt-2 text-base text-[#b8c4d6]">Leva menos de 1 minuto</p>
            </div>

            {error ? (
              <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            {errors.inviteToken ? (
              <div className="mb-5 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {errors.inviteToken.message}
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold uppercase tracking-[0.08em] text-[#b8c4d6]">
                    Nome completo
                  </Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    autoComplete="name"
                    className="h-16 rounded-[14px] border-[#244766] bg-[rgba(4,18,32,0.85)] px-[18px] text-base text-white placeholder:text-[#9aa8bb] focus-visible:border-[#ff9f0a] focus-visible:ring-[#ff9f0a]/20"
                    {...register("name")}
                  />
                  {errors.name ? <p className="text-xs text-amber-300">{errors.name.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-bold uppercase tracking-[0.08em] text-[#b8c4d6]">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@email.com"
                    autoComplete="email"
                    className="h-16 rounded-[14px] border-[#244766] bg-[rgba(4,18,32,0.85)] px-[18px] text-base text-white placeholder:text-[#9aa8bb] focus-visible:border-[#ff9f0a] focus-visible:ring-[#ff9f0a]/20"
                    {...register("email")}
                  />
                  {errors.email ? <p className="text-xs text-amber-300">{errors.email.message}</p> : null}
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-[#0a84ff]/25 bg-[#0a84ff]/10 px-4 py-3 text-sm text-[#d6e8ff]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#62b2ff]" />
                  <span>Usaremos seu email para acessar sua conta e enviar informacoes importantes.</span>
                </div>

                <Button
                  type="button"
                  onClick={() => void goToPasswordStep()}
                  className="h-16 w-full rounded-[14px] bg-gradient-to-r from-[#ffb21a] to-[#ff7800] text-base font-black text-[#061426] shadow-[0_18px_34px_rgba(255,120,0,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Continuar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-bold uppercase tracking-[0.08em] text-[#b8c4d6]">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Crie sua senha"
                      autoComplete="new-password"
                      className="h-16 rounded-[14px] border-[#244766] bg-[rgba(4,18,32,0.85)] px-[18px] pr-12 text-base text-white placeholder:text-[#9aa8bb] focus-visible:border-[#ff9f0a] focus-visible:ring-[#ff9f0a]/20"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b8c4d6] transition hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password ? <p className="text-xs text-amber-300">{errors.password.message}</p> : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between text-xs text-[#b8c4d6]">
                    <span>Forca da senha</span>
                    <span className="font-bold text-white">{strengthLabel}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full transition-all ${strengthColor}`} style={{ width: `${passwordPercent}%` }} />
                  </div>
                  <ul className="mt-4 grid gap-2 text-sm text-[#b8c4d6] sm:grid-cols-2">
                    {passwordStatus.map((rule) => (
                      <li key={rule.label} className="flex items-center gap-2">
                        {rule.valid ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                        <span>{rule.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-sm font-bold uppercase tracking-[0.08em] text-[#b8c4d6]"
                  >
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repita sua senha"
                      autoComplete="new-password"
                      className="h-16 rounded-[14px] border-[#244766] bg-[rgba(4,18,32,0.85)] px-[18px] pr-12 text-base text-white placeholder:text-[#9aa8bb] focus-visible:border-[#ff9f0a] focus-visible:ring-[#ff9f0a]/20"
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b8c4d6] transition hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword ? (
                    <p className="text-xs text-amber-300">{errors.confirmPassword.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-3 text-sm leading-relaxed text-[#d6deeb]" htmlFor="termsAccepted">
                    <input
                      id="termsAccepted"
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent accent-[#ff9f0a]"
                      {...register("termsAccepted")}
                    />
                    <span>Concordo com os termos de uso e politica de privacidade.</span>
                  </label>
                  {errors.termsAccepted ? <p className="text-xs text-amber-300">{errors.termsAccepted.message}</p> : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="h-16 rounded-[14px] border-[#244766] bg-transparent text-white hover:bg-white/10"
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !canCreateAccount}
                    className="h-16 rounded-[14px] bg-gradient-to-r from-[#ffb21a] to-[#ff7800] text-base font-black text-[#061426] shadow-[0_18px_34px_rgba(255,120,0,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Criando conta...
                      </span>
                    ) : (
                      <>
                        Criar minha conta
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-[#b8c4d6] sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#ff9f0a]" />
                Seus dados estao seguros conosco.
              </p>
              <p>
                Ja possui conta?{" "}
                <Link href="/login" className="font-bold text-[#ff9f0a] hover:underline">
                  Entrar
                </Link>
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
