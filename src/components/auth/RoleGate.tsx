"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { UserRole } from "@/types";

export function RoleGate({
  allowedRoles,
  redirectTo,
  children,
}: {
  allowedRoles: UserRole[];
  redirectTo: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrated, userRoles } = useAuthToken();

  const canAccess = userRoles.some((role) => allowedRoles.includes(role));

  useEffect(() => {
    if (!hydrated) return;
    if (!canAccess) router.replace(redirectTo);
  }, [canAccess, hydrated, redirectTo, router]);

  if (!hydrated || !canAccess) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-300">Validando permissao...</p>
      </div>
    );
  }

  return <>{children}</>;
}
