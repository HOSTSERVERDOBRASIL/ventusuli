import type { AthleteIdentity, ServiceEvent, ServiceEventDistance } from "@/services/types";

export interface RaceLogisticsItem {
  label: string;
  value: string;
  status: "ready" | "attention";
}

export interface RacePeloton {
  id: string;
  name: string;
  distanceLabel: string;
  paceRange: string;
  meetingTime: string;
  leader: string;
  routeNote: string;
  capacityLabel: string;
}

function subtractMinutes(dateIso: string, minutes: number): string {
  const date = new Date(dateIso);
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

function formatMeetingTime(value: string): string {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paceForDistance(distanceKm: number, level?: AthleteIdentity["sportLevel"] | null): string {
  if (level === "ELITE") return "4:00 - 4:50 min/km";
  if (level === "ADVANCED") return "4:50 - 5:40 min/km";
  if (distanceKm <= 5) return "7:30 - 8:40 min/km";
  if (distanceKm <= 10) return "6:30 - 7:30 min/km";
  if (distanceKm <= 21.1) return "6:00 - 7:10 min/km";
  return "6:20 - 7:40 min/km";
}

function pelotonName(distance: ServiceEventDistance, level?: AthleteIdentity["sportLevel"] | null): string {
  if (level === "ELITE" || level === "ADVANCED") return `${distance.label} Performance`;
  if (distance.distance_km <= 5) return `${distance.label} Estreia`;
  if (distance.distance_km <= 10) return `${distance.label} Evolucao`;
  return `${distance.label} Controle`;
}

export function buildRaceLogistics(event: ServiceEvent): RaceLogisticsItem[] {
  return [
    {
      label: "Ponto de encontro",
      value: event.address || `${event.city}/${event.state}`,
      status: event.address ? "ready" : "attention",
    },
    {
      label: "Chegada sugerida",
      value: formatMeetingTime(subtractMinutes(event.event_date, 60)),
      status: "ready",
    },
    {
      label: "Aquecimento",
      value: formatMeetingTime(subtractMinutes(event.event_date, 25)),
      status: "ready",
    },
    {
      label: "Retirada de kit",
      value: event.external_url ? "Consultar link oficial" : "Confirmar com a assessoria",
      status: event.external_url ? "ready" : "attention",
    },
  ];
}

export function buildRacePelotons(
  event: ServiceEvent,
  athlete?: AthleteIdentity | null,
): RacePeloton[] {
  return event.distances.map((distance) => {
    const remaining =
      distance.max_slots != null
        ? Math.max(distance.max_slots - distance.registered_count, 0)
        : null;

    return {
      id: `${event.id}-${distance.id}`,
      name: pelotonName(distance, athlete?.sportLevel),
      distanceLabel: distance.label,
      paceRange: paceForDistance(distance.distance_km, athlete?.sportLevel),
      meetingTime: formatMeetingTime(subtractMinutes(event.event_date, 45)),
      leader: "Lider da assessoria",
      routeNote:
        distance.distance_km <= 10
          ? "Grupo ideal para largada controlada e progressao."
          : "Grupo com estrategia de ritmo, hidratacao e controle de energia.",
      capacityLabel:
        remaining == null ? "vagas abertas" : remaining > 0 ? `${remaining} vaga(s)` : "lotado",
    };
  });
}

export function buildRaceSafetyChecklist(
  athlete: AthleteIdentity | null,
  event: ServiceEvent,
): RaceLogisticsItem[] {
  return [
    {
      label: "Contato de emergencia",
      value: athlete?.emergencyContact
        ? `${athlete.emergencyContact.name} | ${athlete.emergencyContact.phone}`
        : "Cadastrar no perfil",
      status: athlete?.emergencyContact ? "ready" : "attention",
    },
    {
      label: "Documento",
      value: athlete?.cpf ? "CPF cadastrado" : "CPF pendente",
      status: athlete?.cpf ? "ready" : "attention",
    },
    {
      label: "Local da prova",
      value: event.address || `${event.city}/${event.state}`,
      status: event.address ? "ready" : "attention",
    },
  ];
}
