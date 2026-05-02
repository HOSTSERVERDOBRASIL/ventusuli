import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ProfileSelectionClient } from "./profile-selection-client";

function ProfileSelectionFallback() {
  return (
    <AuthShell
      fitViewport
      title="Escolha seu perfil"
      description="Use o mesmo login para entrar no contexto certo de trabalho, prova ou atendimento."
    >
      <div className="flex min-h-48 items-center justify-center text-slate-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Preparando perfis...
      </div>
    </AuthShell>
  );
}

export default function SelectProfilePage() {
  return (
    <Suspense fallback={<ProfileSelectionFallback />}>
      <ProfileSelectionClient />
    </Suspense>
  );
}
