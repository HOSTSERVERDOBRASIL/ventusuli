import { buildAuthHeaders } from "@/services/runtime";
import {
  AdminAthleteInvite,
  AdminAthletePolicy,
  AdminAthletesListResponse,
  CreateAthleteByAdminResponse,
} from "@/services/types";

export interface AdminAthletesFilters {
  q?: string;
  status?: "ALL" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
  page?: number;
  pageSize?: number;
  accessToken?: string | null;
}

export interface CreateAdminInviteInput {
  label?: string;
  reusable: boolean;
  maxUses?: number;
  expiresAt?: string;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return new Error(payload.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function getAdminAthletes(filters: AdminAthletesFilters): Promise<AdminAthletesListResponse> {
  const query = new URLSearchParams();

  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  query.set("page", String(filters.page ?? 1));
  query.set("pageSize", String(filters.pageSize ?? 20));

  const response = await fetch(`/api/admin/athletes?${query.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(filters.accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel carregar atletas.");
  }

  return (await response.json()) as AdminAthletesListResponse;
}

export async function updateAdminAthleteStatus(
  athleteId: string,
  action: "APPROVE" | "REJECT" | "BLOCK",
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/admin/athletes/${athleteId}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel atualizar status do atleta.");
  }
}

export async function createAthleteByAdmin(
  input: {
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
  },
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

export async function listAdminInvites(accessToken?: string | null): Promise<{
  data: AdminAthleteInvite[];
  policy: AdminAthletePolicy;
}> {
  const response = await fetch("/api/admin/invites", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel carregar convites.");
  }

  return (await response.json()) as { data: AdminAthleteInvite[]; policy: AdminAthletePolicy };
}

export async function createAdminInvite(
  input: CreateAdminInviteInput,
  accessToken?: string | null,
): Promise<AdminAthleteInvite> {
  const response = await fetch("/api/admin/invites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel criar convite.");
  }

  const payload = (await response.json()) as { data: AdminAthleteInvite };
  return payload.data;
}

export async function resendAdminInvite(inviteId: string, accessToken?: string | null): Promise<AdminAthleteInvite> {
  const response = await fetch(`/api/admin/invites/${inviteId}/resend`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel reenviar convite.");
  }

  const payload = (await response.json()) as { data: AdminAthleteInvite };
  return payload.data;
}

