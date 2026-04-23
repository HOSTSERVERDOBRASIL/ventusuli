import { buildAuthHeaders } from "@/services/runtime";
import { FinancialReport } from "@/services/types";

export interface FinancialFilters {
  startDate: string;
  endDate: string;
  status?: string;
  accessToken?: string | null;
}

export async function getFinancialReport({
  startDate,
  endDate,
  status,
  accessToken,
}: FinancialFilters): Promise<FinancialReport> {
  const query = new URLSearchParams({
    startDate,
    endDate,
  });

  if (status && status !== "ALL") query.set("status", status);

  const response = await fetch(`/api/reports/financial?${query.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error("financial_unavailable");
  }

  return (await response.json()) as FinancialReport;
}

