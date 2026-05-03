import type {
  NormalizedEvent,
  NormalizedOrder,
  NormalizedRegistration,
} from "@/lib/integrations/external/types";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function firstString(payload: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function firstNumber(payload: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function requiredExternalId(payload: UnknownRecord): string {
  const id = firstString(payload, ["id", "externalId", "external_id", "eventId", "orderId"]);
  if (!id) throw new Error("Payload externo sem identificador.");
  return id;
}

export function mapTicketSportsEvent(raw: unknown): NormalizedEvent {
  const payload = asRecord(raw);
  return {
    externalId: requiredExternalId(payload),
    name: firstString(payload, ["name", "title", "nome", "eventName"]) ?? "Evento sem nome",
    date: firstString(payload, ["date", "eventDate", "event_date", "data"]),
    location: firstString(payload, ["location", "city", "local", "cidade"]),
    status: firstString(payload, ["status", "situacao"]),
    rawPayload: raw,
  };
}

export function mapTicketSportsRegistration(raw: unknown, fallbackEventId: string): NormalizedRegistration {
  const payload = asRecord(raw);
  const participant = asRecord(payload.participant ?? payload.athlete ?? payload.user);

  return {
    externalId: requiredExternalId(payload),
    eventExternalId:
      firstString(payload, ["eventId", "event_id", "externalEventId", "external_event_id"]) ??
      fallbackEventId,
    participantName:
      firstString(payload, ["participantName", "participant_name", "name", "nome"]) ??
      firstString(participant, ["name", "nome"]),
    participantEmail:
      firstString(payload, ["participantEmail", "participant_email", "email"]) ??
      firstString(participant, ["email"]),
    participantDocument:
      firstString(payload, ["participantDocument", "participant_document", "document", "cpf"]) ??
      firstString(participant, ["document", "cpf"]),
    category: firstString(payload, ["category", "categoria", "distance", "distancia"]),
    status: firstString(payload, ["status", "situacao"]),
    rawPayload: raw,
  };
}

export function mapTicketSportsOrder(raw: unknown): NormalizedOrder {
  const payload = asRecord(raw);
  const buyer = asRecord(payload.buyer ?? payload.customer ?? payload.comprador);

  return {
    externalId: requiredExternalId(payload),
    eventExternalId: firstString(payload, ["eventId", "event_id", "externalEventId"]),
    buyerName:
      firstString(payload, ["buyerName", "buyer_name", "customerName", "name"]) ??
      firstString(buyer, ["name", "nome"]),
    buyerEmail:
      firstString(payload, ["buyerEmail", "buyer_email", "customerEmail", "email"]) ??
      firstString(buyer, ["email"]),
    amount: firstNumber(payload, ["amount", "amountCents", "amount_cents", "total", "valor"]),
    paymentStatus: firstString(payload, ["paymentStatus", "payment_status", "payment", "pagamento"]),
    orderStatus: firstString(payload, ["orderStatus", "order_status", "status", "situacao"]),
    rawPayload: raw,
  };
}

export function unwrapTicketSportsList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of ["data", "items", "results", "events", "registrations", "orders"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}
