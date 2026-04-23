import { buildAuthHeaders } from "@/services/runtime";
import { DashboardData, DashboardLoadInput } from "@/services/types";

export async function getDashboardData({ accessToken }: DashboardLoadInput): Promise<{ data: DashboardData | null }> {
  const response = await fetch("/api/dashboard/athlete", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error("dashboard_unavailable");
  }

  const payload = (await response.json()) as DashboardData;
  return { data: payload };
}

