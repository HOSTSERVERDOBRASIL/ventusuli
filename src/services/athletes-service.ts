import { buildAuthHeaders } from "@/services/runtime";
import { AthleteDetail, AthletesListResponse, CreateAthleteByAdminResponse } from "@/services/types";

export interface AthletesListFilters {
  q?: string;
  status?: "ALL" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
  financial?: "ALL" | "EM_DIA" | "PENDENTE" | "SEM_HISTORICO";
  sortBy?: "name" | "registrations" | "nextEvent" | "pending" | "paid" | "lastPayment";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  accessToken?: string | null;
}

export interface UpdateAthleteInput {
  name?: string;
  email?: string;
  cpf?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface CreateAthleteByAdminInput {
  mode: "QUICK" | "FULL";
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  city?: string;
  state?: string;
  birthDate?: string;
  gender?: string;
  emergencyContact?: string;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return new Error(payload.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function getAthletesList(filters: AthletesListFilters): Promise<AthletesListResponse> {
  const query = new URLSearchParams();

  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  if (filters.financial) query.set("financial", filters.financial);
  if (filters.sortBy) query.set("sortBy", filters.sortBy);
  if (filters.sortDir) query.set("sortDir", filters.sortDir);
  query.set("page", String(filters.page ?? 1));
  query.set("pageSize", String(filters.pageSize ?? 10));

  const response = await fetch(`/api/athletes?${query.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(filters.accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel carregar atletas.");
  }

  return (await response.json()) as AthletesListResponse;
}

export async function getAthleteDetail(athleteId: string, accessToken?: string | null): Promise<AthleteDetail> {
  const response = await fetch(`/api/athletes/${athleteId}`, {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel carregar detalhe do atleta.");
  }

  const payload = (await response.json()) as { data: AthleteDetail };
  return payload.data;
}

export async function updateAthlete(
  athleteId: string,
  input: UpdateAthleteInput,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/athletes/${athleteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel atualizar atleta.");
  }
}

export async function saveAthleteInternalNote(
  athleteId: string,
  note: string,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/athletes/${athleteId}/note`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ note }),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel salvar observacao interna.");
  }
}

export async function enrollAthleteInEvent(
  athleteId: string,
  payload: { eventId: string; distanceId: string },
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/athletes/${athleteId}/registrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel inscrever atleta.");
  }
}

export async function createAthleteCharge(
  athleteId: string,
  registrationId: string,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/athletes/${athleteId}/charge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ registrationId }),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel gerar cobranca.");
  }
}

export async function approveAthlete(
  athleteId: string,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/athletes/${athleteId}/approve`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Não foi possível aprovar atleta.");
  }
}

export async function rejectAthlete(
  athleteId: string,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/athletes/${athleteId}/reject`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel rejeitar atleta.");
  }
}

export async function blockAthlete(
  athleteId: string,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/athletes/${athleteId}/block`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel bloquear atleta.");
  }
}

export async function createAthleteByAdmin(
  input: CreateAthleteByAdminInput,
  accessToken?: string | null,
): Promise<CreateAthleteByAdminResponse> {
  const response = await fetch("/api/admin/athletes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel cadastrar atleta.");
  }

  return (await response.json()) as CreateAthleteByAdminResponse;
}
