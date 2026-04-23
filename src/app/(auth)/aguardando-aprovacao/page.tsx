import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Aguardando aprovacao",
  description: "Sua conta de atleta esta aguardando aprovacao da assessoria",
};

export default function AguardandoAprovacaoPage() {
  return (
    <AuthCard
      title="Cadastro recebido"
      description="Sua conta foi criada e esta aguardando aprovacao da assessoria."
    >
      <div className="space-y-4">
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Assim que o admin aprovar seu cadastro, voce podera acessar a plataforma normalmente.
        </div>
        <p className="text-sm text-slate-300">
          Se precisar acelerar a liberacao, entre em contato com a assessoria e informe o e-mail usado no cadastro.
        </p>
        <Button asChild className="h-10 w-full bg-[#F5A623] text-[#0A1628] hover:bg-[#e59a1f]">
          <Link href="/login">Voltar ao login</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
