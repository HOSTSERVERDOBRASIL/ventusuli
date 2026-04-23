import { DEMO_ADMIN_COLLECTIVE_GROUPS } from "@/mocks";
import { getAdminEvents } from "@/services/events-service";
import { isDemoModeEnabled } from "@/services/runtime";
import { AdminCollectiveGroup, CollectiveRegistrationSimulationResult } from "@/services/types";

export async function getCollectiveGroups(): Promise<AdminCollectiveGroup[]> {
  if (isDemoModeEnabled()) {
    return DEMO_ADMIN_COLLECTIVE_GROUPS;
  }
  return [];
}

export async function simulateCollectiveRegistration(
  groupId: string,
  eventId: string,
  accessToken?: string | null,
): Promise<CollectiveRegistrationSimulationResult> {
  if (!isDemoModeEnabled()) {
    throw new Error("Inscricao coletiva simulada disponivel apenas em modo demo.");
  }

  const group = DEMO_ADMIN_COLLECTIVE_GROUPS.find((item) => item.id === groupId);
  if (!group) {
    throw new Error("Grupo coletivo nao encontrado.");
  }
  if (group.status !== "READY") {
    throw new Error("Grupo ainda nao esta liberado para inscricao coletiva.");
  }

  const events = await getAdminEvents(accessToken);
  const event = events.find((item) => item.id === eventId);
  if (!event) {
    throw new Error("Prova selecionada nao encontrada.");
  }

  const cheapestDistancePrice = event.distances.reduce((min, distance) => {
    return Math.min(min, distance.price_cents);
  }, event.distances[0]?.price_cents ?? 0);

  return {
    groupId: group.id,
    groupName: group.name,
    eventId: event.id,
    eventName: event.name,
    registrationsCreated: group.athletesCount,
    pendingAmountCents: group.athletesCount * cheapestDistancePrice,
  };
}
