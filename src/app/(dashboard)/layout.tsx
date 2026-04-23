import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const accessToken = cookies().get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const sessionPayload = accessToken ? verifyAccessToken(accessToken) : null;

  if (!sessionPayload) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
