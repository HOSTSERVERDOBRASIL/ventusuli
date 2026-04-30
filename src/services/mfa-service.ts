import { buildAuthHeaders } from "@/services/runtime";

export interface MfaStatus {
  enabled: boolean;
  requiredByRole: boolean;
  emailOtpEnabled: boolean;
  recoveryCodesRemaining: number;
  lastVerifiedAt: string | null;
  updatedAt: string | null;
}

export interface MfaSetupPayload {
  mfa_token: string;
  secret: string;
  otp_auth_url: string;
  qr_code_data: string;
  manual_entry_key: string;
  masked_email: string;
  available_methods?: string[];
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

export async function getMfaStatus(accessToken?: string | null): Promise<MfaStatus> {
  const response = await fetch("/api/auth/mfa/status", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel carregar o status MFA.");
  }

  const payload = (await response.json()) as ApiResponse<MfaStatus>;
  return payload.data;
}

export async function startMfaSetup(accessToken?: string | null): Promise<MfaSetupPayload> {
  const response = await fetch("/api/auth/mfa/setup", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel iniciar a ativacao MFA.");
  }

  return (await response.json()) as MfaSetupPayload;
}

export async function disableMfa(
  input: { password: string; code: string },
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch("/api/auth/mfa/disable", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response, "Nao foi possivel desativar MFA.");
  }
}
