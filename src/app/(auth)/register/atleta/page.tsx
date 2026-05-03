import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterAtletaForm } from "@/components/auth/RegisterAtletaForm";

export const metadata: Metadata = {
  title: "Cadastro Ventu Suli Floripa",
  description: "Cadastre-se como atleta no grupo Ventu Suli Floripa",
};

export default function RegisterAtletaPage() {
  return (
    <Suspense fallback={null}>
      <RegisterAtletaForm />
    </Suspense>
  );
}
