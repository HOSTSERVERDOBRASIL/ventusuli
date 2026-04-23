import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterAtletaForm } from "@/components/auth/RegisterAtletaForm";

export const metadata: Metadata = {
  title: "Cadastro de Atleta",
  description: "Cadastre-se como atleta em uma assessoria Ventu Suli",
};

export default function RegisterAtletaPage() {
  return (
    <Suspense fallback={null}>
      <RegisterAtletaForm />
    </Suspense>
  );
}
