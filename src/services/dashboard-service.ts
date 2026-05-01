import { buildAuthHeaders } from "@/services/runtime";
import { DashboardData, DashboardLoadInput } from "@/services/types";

export async function getDashboardData({
  accessToken,
  rankingPeriod,
}: DashboardLoadInput): Promise<{ data: DashboardData | null }> {
  const query = new URLSearchParams();
  if (rankingPeriod) query.set("period", rankingPeriod);
  const queryString = query.toString();

  const response = await fetch(`/api/dashboard/athlete${queryString ? `?${queryString}` : ""}`, {
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
