import type { Metadata } from "next";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";

export const metadata: Metadata = {
  title: "Confirmar identidade",
  description: "Valide seu segundo fator para acessar a plataforma Ventu Suli",
};

export default function MfaPage() {
  return <MfaChallengeForm />;
}
