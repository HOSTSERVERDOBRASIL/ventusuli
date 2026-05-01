import { buildAuthHeaders } from "@/services/runtime";

export interface StravaConnectionStatus {
  connected: boolean;
  state: "disconnected" | "connecting" | "connected" | "expired";
  unavailable?: "strava_client_not_configured";
  message?: string;
  stravaAthleteId: string | null;
  scopes: string[];
  expiresAt: string | null;
  lastSyncAt: string | null;
  authorizeUrl?: string;
}

export interface StravaSyncResult {
  syncedCount: number;
  failedCount?: number;
  pagesFetched: number;
  lastSyncAt: string;
}

interface ApiResponse<T> {
  data: T;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return new Error(payload.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function getStravaStatus(
  accessToken?: string | null,
): Promise<StravaConnectionStatus> {
  const response = await fetch("/api/integrations/strava/sync", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel carregar o status do Strava.");
  }

  const payload = (await response.json()) as ApiResponse<StravaConnectionStatus>;

  if (!payload.data.connected) {
    const connectResponse = await fetch("/api/integrations/strava/connect", {
      method: "GET",
      cache: "no-store",
      headers: buildAuthHeaders(accessToken),
    });

    if (!connectResponse.ok) {
      return payload.data;
    }

    const connectPayload = (await connectResponse.json()) as ApiResponse<StravaConnectionStatus>;
    return connectPayload.data;
  }

  return payload.data;
}

export async function getStravaConnectUrl(accessToken?: string | null): Promise<string> {
  const response = await fetch("/api/integrations/strava/connect", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel iniciar a conexao com Strava.");
  }

  const payload = (await response.json()) as ApiResponse<StravaConnectionStatus>;
  if (!payload.data.authorizeUrl) {
    throw new Error(payload.data.message ?? "URL de autorizacao nao retornada pelo backend.");
  }

  return payload.data.authorizeUrl;
}

export async function syncStrava(accessToken?: string | null): Promise<StravaSyncResult> {
  const response = await fetch("/api/integrations/strava/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel sincronizar atividades do Strava.");
  }

  const payload = (await response.json()) as ApiResponse<StravaSyncResult>;
  return payload.data;
}

export async function disconnectStrava(accessToken?: string | null): Promise<void> {
  const response = await fetch("/api/integrations/strava/connect", {
    method: "DELETE",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel desconectar o Strava.");
  }
}
