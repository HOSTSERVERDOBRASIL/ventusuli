import type { Metadata } from "next";
import Link from "next/link";
import { RegisterAssessoriaForm } from "@/components/auth/RegisterAssessoriaForm";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cadastro de Assessoria",
  description: "Crie sua assessoria no Ventu Suli",
};

export default function RegisterAssessoriaPage() {
  const publicAdminRegistrationEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_PUBLIC_ADMIN_REGISTRATION_ENABLED === "true";

  if (!publicAdminRegistrationEnabled) {
    return (
      <AuthCard
        title="Cadastro de assessoria indisponivel"
        description="Neste ambiente o acesso e controlado pelo time comercial."
      >
        <div className="space-y-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Solicite convite com o SUPER_ADMIN para ativar sua assessoria.
          </div>
          <Button asChild className="h-10 w-full bg-[#F5A623] text-[#0A1628] hover:bg-[#e59a1f]">
            <Link href="/login">Voltar ao login</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return <RegisterAssessoriaForm />;
}
