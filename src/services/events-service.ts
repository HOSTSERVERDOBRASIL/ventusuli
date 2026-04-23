import { buildAuthHeaders } from "@/services/runtime";
import { EventUpsertPayload, ServiceEvent, ServiceEventDistance } from "@/services/types";

interface ApiEventDistanceInput {
  id: string;
  label: string;
  distance_km: number | string;
  price_cents: number;
  max_slots?: number | null;
  registered_count?: number;
}

interface ApiEventInput {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  event_date: string;
  registration_deadline?: string | null;
  status: string;
  description?: string | null;
  image_url?: string | null;
  distances: ApiEventDistanceInput[];
  registrations_count?: number;
}

interface EventApiResponse {
  data: ApiEventInput;
}

interface EventsApiResponse {
  data: ApiEventInput[];
}

export interface ServiceEventRegistration {
  registration_id: string;
  athlete_name: string;
  athlete_email: string;
  distance_label: string;
  registration_status: string;
  payment_status: string;
  amount_cents: number;
  registered_at: string;
}

interface EventRegistrationsApiResponse {
  data: ServiceEventRegistration[];
}

function normalizeDistance(distance: ApiEventDistanceInput): ServiceEventDistance {
  return {
    id: distance.id,
    label: distance.label,
    distance_km:
      typeof distance.distance_km === "string"
        ? Number(distance.distance_km)
        : distance.distance_km,
    price_cents: distance.price_cents,
    max_slots: distance.max_slots ?? null,
    registered_count: distance.registered_count ?? 0,
  };
}

function mapApiEvent(event: ApiEventInput): ServiceEvent {
  return {
    id: event.id,
    name: event.name,
    city: event.city ?? "",
    state: event.state ?? "",
    event_date: event.event_date,
    registration_deadline: event.registration_deadline ?? null,
    description: event.description ?? null,
    image_url: event.image_url ?? null,
    status: event.status as ServiceEvent["status"],
    distances: event.distances.map(normalizeDistance),
    registrations_count: event.registrations_count ?? 0,
  };
}

async function fetchEvents(accessToken?: string | null): Promise<ServiceEvent[]> {
  const response = await fetch("/api/events?limit=100", {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) throw new Error("events_unavailable");

  const payload = (await response.json()) as EventsApiResponse;
  return payload.data.map(mapApiEvent);
}

async function fetchEventById(
  id: string,
  accessToken?: string | null,
): Promise<ServiceEvent | null> {
  const response = await fetch(`/api/events/${id}`, {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as EventApiResponse;
  return mapApiEvent(payload.data);
}

export async function getAthleteEvents(accessToken?: string | null): Promise<ServiceEvent[]> {
  return fetchEvents(accessToken);
}

export async function getAdminEvents(accessToken?: string | null): Promise<ServiceEvent[]> {
  return fetchEvents(accessToken);
}

export async function getEventById(
  id: string,
  accessToken?: string | null,
): Promise<ServiceEvent | null> {
  return fetchEventById(id, accessToken);
}

export async function createAdminEvent(
  payload: EventUpsertPayload,
  status: ServiceEvent["status"],
  accessToken?: string | null,
): Promise<ServiceEvent> {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ ...payload, status }),
  });

  if (!response.ok) {
    const errPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errPayload.error?.message ?? "Não foi possível salvar a prova.");
  }

  const result = (await response.json()) as EventApiResponse;
  return mapApiEvent(result.data);
}

export async function updateAdminEvent(
  id: string,
  payload: EventUpsertPayload,
  status: ServiceEvent["status"],
  accessToken?: string | null,
): Promise<ServiceEvent> {
  const response = await fetch(`/api/events/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ ...payload, status }),
  });

  if (!response.ok) {
    const errPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errPayload.error?.message ?? "Não foi possível atualizar a prova.");
  }

  const result = (await response.json()) as EventApiResponse;
  return mapApiEvent(result.data);
}

export async function publishAdminEvent(
  id: string,
  accessToken?: string | null,
): Promise<ServiceEvent> {
  const response = await fetch(`/api/events/${id}/publish`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errPayload.error?.message ?? "Não foi possível publicar a prova.");
  }

  const result = (await response.json()) as EventApiResponse;
  return mapApiEvent(result.data);
}

export async function cancelAdminEvent(
  id: string,
  accessToken?: string | null,
): Promise<ServiceEvent> {
  const response = await fetch(`/api/events/${id}`, {
    method: "DELETE",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errPayload.error?.message ?? "Não foi possível cancelar a prova.");
  }

  const result = (await response.json()) as EventApiResponse;
  return mapApiEvent(result.data);
}

export async function duplicateAdminEvent(
  id: string,
  accessToken?: string | null,
): Promise<ServiceEvent> {
  const response = await fetch(`/api/events/${id}/duplicate`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errPayload.error?.message ?? "Não foi possível duplicar a prova.");
  }

  const result = (await response.json()) as EventApiResponse;
  return mapApiEvent(result.data);
}

export async function getEventRegistrations(
  eventId: string,
  accessToken?: string | null,
): Promise<ServiceEventRegistration[]> {
  const response = await fetch(`/api/events/${eventId}/registrations`, {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errPayload.error?.message ?? "Não foi possível carregar inscritos.");
  }

  const payload = (await response.json()) as EventRegistrationsApiResponse;
  return payload.data;
}
