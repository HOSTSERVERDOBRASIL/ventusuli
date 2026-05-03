import { buildAuthHeaders } from "@/services/runtime";
import type { EventCockpitData } from "@/services/types";

interface EventCockpitResponse {
  data: EventCockpitData;
}

export async function getEventCockpit(
  eventId: string,
  accessToken?: string | null,
): Promise<EventCockpitData> {
  const response = await fetch(`/api/admin/cockpit/events/${eventId}`, {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? "Nao foi possivel carregar o cockpit da prova.");
  }

  const payload = (await response.json()) as EventCockpitResponse;
  return payload.data;
}
