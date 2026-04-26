import { buildAuthHeaders } from "@/services/runtime";
export const ACCEPTED_IMAGE_FILE_INPUT_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
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

async function parseApiError(response: Response, fallback: string): Promise<Error> {
  try {
    const text = await response.text();
    if (!text) return new Error(fallback);
    const payload = JSON.parse(text) as { error?: { message?: string } };
    return new Error(payload.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

async function parseJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  try {
    const text = await response.text();
    if (!text) throw new Error(fallback);
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallback);
  }
}

export async function getOrganizationSettings(
  accessToken?: string | null,
): Promise<OrganizationSettings> {
  const response = await fetch("/api/organization", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseApiError(response, "Nao foi possivel carregar configuracoes da organizacao.");
  }

  const payload = await parseJsonResponse<OrganizationResponse>(
    response,
    "Resposta invalida ao carregar configuracoes da organizacao.",
  );
  if (!payload.data)
    throw new Error("Resposta sem dados ao carregar configuracoes da organizacao.");
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
    throw await parseApiError(response, "Nao foi possivel salvar configuracoes da organizacao.");
  }

  const payload = await parseJsonResponse<{ data: OrganizationSettings }>(
    response,
    "Resposta invalida ao salvar configuracoes da organizacao.",
  );
  if (!payload.data) throw new Error("Resposta sem dados ao salvar configuracoes da organizacao.");
  return payload.data;
}

export interface OrgInvite {
  id: string;
  token: string;
  label: string | null;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  invite_kind?: string;
  invited_email?: string | null;
  invited_name?: string | null;
  created_by?: string | null;
  accepted_user_id?: string | null;
  accepted_at?: string | null;
  created_at: string;
  signupUrl?: string;
}

interface InviteListResponse {
  data: OrgInvite[];
}

interface InviteResponse {
  data: OrgInvite;
}

export interface CreateInviteInput {
  label?: string;
  invitedEmail?: string;
  invitedName?: string;
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
    throw await parseApiError(response, "Nao foi possivel carregar convites.");
  }

  const payload = await parseJsonResponse<InviteListResponse>(
    response,
    "Resposta invalida ao carregar convites.",
  );
  if (!Array.isArray(payload.data)) throw new Error("Resposta sem lista de convites.");
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
    throw await parseApiError(response, "Nao foi possivel criar convite.");
  }

  const payload = await parseJsonResponse<InviteResponse>(
    response,
    "Convite criado, mas a resposta do servidor veio invalida. Recarregue a lista.",
  );
  if (!payload.data) {
    throw new Error(
      "Convite criado, mas a resposta do servidor veio sem dados. Recarregue a lista.",
    );
  }

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
    throw await parseApiError(response, "Nao foi possivel atualizar convite.");
  }

  const payload = await parseJsonResponse<InviteResponse>(
    response,
    "Resposta invalida ao atualizar convite.",
  );
  if (!payload.data) throw new Error("Resposta sem dados ao atualizar convite.");
  return payload.data;
}

export async function deleteInvite(inviteId: string, accessToken?: string | null): Promise<void> {
  const response = await fetch(`/api/invites/${inviteId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseApiError(response, "Nao foi possivel excluir convite.");
  }

  // DELETE pode responder sem corpo. Nao chame response.json() aqui,
  // pois isso gera: Unexpected end of JSON input.
}
