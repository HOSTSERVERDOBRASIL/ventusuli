import { getAdminEvents } from "@/services/events-service";
import { getFinancialReport } from "@/services/financial-service";
import { AdminOverviewData } from "@/services/types";

export async function getAdminOverview(accessToken?: string | null): Promise<AdminOverviewData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const report = await getFinancialReport({
    startDate: monthStart.toISOString(),
    endDate: now.toISOString(),
    status: "ALL",
    accessToken,
  });

  const events = (await getAdminEvents(accessToken)).map((event) => ({
    id: event.id,
    name: event.name,
    status: event.status,
    event_date: event.event_date,
    city: event.city,
    state: event.state,
    image_url: event.image_url ?? null,
    registrations_count: event.registrations_count,
  }));

  const uniqueAthletes = new Set(report.data.map((row) => row.athlete_email));
  const pendentes = report.data.filter((row) => row.payment_status === "PENDING").length;

  return {
    report,
    events,
    metrics: {
      atletasAtivos: uniqueAthletes.size,
      receitaMes: report.totals.totalPago,
      inscricoesPendentes: pendentes,
      provasPublicadas: events.filter((event) => event.status === "PUBLISHED").length,
    },
  };
}
