import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Escolher Cadastro",
  description: "Escolha o tipo de cadastro no Ventu Suli",
};

export default function RegisterPage() {
  const publicAdminRegistrationEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_PUBLIC_ADMIN_REGISTRATION_ENABLED === "true";

  return (
    <AuthCard title="Como voce quer entrar?" description="Escolha o fluxo de cadastro correto para seu perfil.">
      <div className="space-y-4">
        {publicAdminRegistrationEnabled ? (
          <div className="rounded-xl border border-[#24486f] bg-[#0F2743] p-4">
            <p className="text-sm font-semibold text-white">Sou assessoria</p>
            <p className="mt-1 text-xs text-slate-300">Cria organizacao e usuario ADMIN para operar a plataforma.</p>
            <Button asChild className="mt-3 h-10 w-full bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]">
              <Link href="/register/assessoria">Cadastrar assessoria</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">Cadastro de assessoria controlado</p>
            <p className="mt-1 text-xs text-amber-200/90">
              O fluxo da assessoria e liberado somente por convite do SUPER_ADMIN.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-white/15 bg-[#0F2743] p-4">
          <p className="text-sm font-semibold text-white">Sou atleta</p>
          <p className="mt-1 text-xs text-slate-300">Entra em assessoria existente via slug ou token de convite.</p>
          <Button
            asChild
            variant="outline"
            className="mt-3 h-10 w-full border-white/25 bg-transparent text-white hover:bg-white/10"
          >
            <Link href="/register/atleta">Cadastrar atleta</Link>
          </Button>
        </div>

        <p className="text-center text-sm text-slate-200">
          Ja possui conta?{" "}
          <Link href="/login" className="font-semibold text-[#F5A623] hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
