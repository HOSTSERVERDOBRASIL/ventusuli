import { buildAuthHeaders } from "@/services/runtime";
import type {
  AthleteRaceParticipationStatus,
  RacePlanAthleteAction,
  ServiceRacePlan,
} from "@/services/types";

interface RacePlansResponse {
  data: ServiceRacePlan[];
}

interface RacePlanResponse {
  data: ServiceRacePlan;
}

interface AdminRacePlanByEventResponse {
  data: (ServiceRacePlan & {
    participations: Array<{
      id: string;
      status: string;
      athleteName: string;
      athleteEmail: string;
      distanceLabel: string | null;
      distanceKm: number | null;
      registrationId: string | null;
      registrationStatus: string | null;
      paymentStatus: string | null;
      amountCents: number | null;
      externalRegistrationUrl: string | null;
      externalRegistrationCode: string | null;
      note: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }) | null;
}

interface RaceParticipationResponse {
  data: NonNullable<ServiceRacePlan["myParticipation"]>;
}

export async function getAthleteRacePlans(
  accessToken?: string | null,
): Promise<ServiceRacePlan[]> {
  const response = await fetch("/api/race-plans", {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) throw new Error("race_plans_unavailable");

  const payload = (await response.json()) as RacePlansResponse;
  return payload.data;
}

export async function openAdminRacePlan(
  input: {
    eventId: string;
    athleteAction?: RacePlanAthleteAction;
    instructions?: string;
  },
  accessToken?: string | null,
): Promise<ServiceRacePlan> {
  const response = await fetch("/api/admin/race-plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({
      eventId: input.eventId,
      status: "OPEN_TO_ATHLETES",
      athleteAction: input.athleteAction ?? "INTEREST",
      instructions: input.instructions,
    }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(errorPayload?.error?.message ?? "Nao foi possivel abrir a prova aos atletas.");
  }

  const payload = (await response.json()) as RacePlanResponse;
  return payload.data;
}

export async function getAdminRacePlanByEvent(
  eventId: string,
  accessToken?: string | null,
): Promise<AdminRacePlanByEventResponse["data"]> {
  const response = await fetch(`/api/admin/race-plans/by-event/${eventId}`, {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(errorPayload?.error?.message ?? "Nao foi possivel carregar a lista da produtora.");
  }

  const payload = (await response.json()) as AdminRacePlanByEventResponse;
  return payload.data;
}

export async function joinRacePlan(
  racePlanId: string,
  input: {
    status?: AthleteRaceParticipationStatus;
    distanceId?: string;
    externalRegistrationUrl?: string;
    externalRegistrationCode?: string;
    note?: string;
  } = {},
  accessToken?: string | null,
): Promise<NonNullable<ServiceRacePlan["myParticipation"]>> {
  const response = await fetch(`/api/race-plans/${racePlanId}/participations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(errorPayload?.error?.message ?? "Nao foi possivel registrar participacao.");
  }

  const payload = (await response.json()) as RaceParticipationResponse;
  return payload.data;
}
