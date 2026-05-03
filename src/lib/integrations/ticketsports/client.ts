import { ExternalIntegrationError } from "@/lib/integrations/external/types";

type QueryValue = string | number | boolean | null | undefined;

function buildPath(path: string, params?: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== null && typeof value !== "undefined") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export class TicketSportsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async get(path: string, params?: Record<string, QueryValue>): Promise<unknown> {
    const url = new URL(buildPath(path, params), this.baseUrl).toString();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ExternalIntegrationError(
        "TICKETSPORTS_API_ERROR",
        "Erro ao consultar a API da TicketSports.",
        response.status,
        { status: response.status, payload },
      );
    }
    return payload;
  }

  getEvents() {
    return this.get(process.env.TICKETSPORTS_EVENTS_PATH ?? "/events");
  }

  getRegistrations(eventId: string) {
    const template = process.env.TICKETSPORTS_REGISTRATIONS_PATH ?? "/events/:eventId/registrations";
    return this.get(template.replace(":eventId", encodeURIComponent(eventId)));
  }

  getOrders(eventId?: string) {
    return this.get(process.env.TICKETSPORTS_ORDERS_PATH ?? "/orders", eventId ? { eventId } : undefined);
  }

  getOrderById(orderId: string) {
    const template = process.env.TICKETSPORTS_ORDER_DETAIL_PATH ?? "/orders/:orderId";
    return this.get(template.replace(":orderId", encodeURIComponent(orderId)));
  }
}
