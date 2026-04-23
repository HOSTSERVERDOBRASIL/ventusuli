import { buildAuthHeaders } from "@/services/runtime";

// ─── Organization Settings ────────────────────────────────────────────────────

export interface OrganizationSettings {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  supportEmail: string;
  primaryColor: string;
  allowAthleteSelfSignup: boolean;
  requireAthleteApproval: boolean;
  createdAt: string;
}

interface OrganizationResponse {
  data: OrganizationSettings;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  supportEmail?: string;
  primaryColor?: string;
  logoUrl?: string | null;
  allowAthleteSelfSignup?: boolean;
  requireAthleteApproval?: boolean;
}

export async function getOrganizationSettings(accessToken?: string | null): Promise<OrganizationSettings> {
  const response = await fetch("/api/organization", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Não foi possível carregar configurações da organização.");
  }

  const payload = (await response.json()) as OrganizationResponse;
  return payload.data;
}

export async function updateOrganizationSettings(
  input: UpdateOrganizationInput,
  accessToken?: string | null,
): Promise<OrganizationSettings> {
  const response = await fetch("/api/organization", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Não foi possível salvar configurações da organização.");
  }

  const payload = (await response.json()) as { data: OrganizationSettings };
  return payload.data;
}

// ─── Invite Management ────────────────────────────────────────────────────────

export interface OrgInvite {
  id: string;
  token: string;
  label: string | null;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
}

interface InviteListResponse {
  data: OrgInvite[];
}

interface InviteResponse {
  data: OrgInvite;
}

export interface CreateInviteInput {
  label?: string;
  max_uses?: number | null;
  expires_at?: string | null;
}

export async function listInvites(accessToken?: string | null): Promise<OrgInvite[]> {
  const response = await fetch("/api/invites", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Não foi possível carregar convites.");
  }

  const payload = (await response.json()) as InviteListResponse;
  return payload.data;
}

export async function createInvite(
  input: CreateInviteInput,
  accessToken?: string | null,
): Promise<OrgInvite> {
  const response = await fetch("/api/invites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Não foi possível criar convite.");
  }

  const payload = (await response.json()) as InviteResponse;
  return payload.data;
}

export async function toggleInvite(
  inviteId: string,
  active: boolean,
  accessToken?: string | null,
): Promise<OrgInvite> {
  const response = await fetch(`/api/invites/${inviteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Não foi possível atualizar convite.");
  }

  const payload = (await response.json()) as InviteResponse;
  return payload.data;
}

export async function deleteInvite(inviteId: string, accessToken?: string | null): Promise<void> {
  const response = await fetch(`/api/invites/${inviteId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Não foi possível excluir convite.");
  }
}
