import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Solicite um link para redefinir sua senha",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
