import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivateAdminForm } from "@/components/auth/ActivateAdminForm";

export const metadata: Metadata = {
  title: "Ativar conta administrativa",
  description: "Ative sua conta de admin via convite comercial",
};

export default function ActivateAdminPage() {
  return (
    <Suspense fallback={null}>
      <ActivateAdminForm />
    </Suspense>
  );
}
