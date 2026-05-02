import { buildAuthHeaders } from "@/services/runtime";
import {
  AthleteEmergencyContact,
  AthleteIdentity,
  PaymentStatus,
  RegistrationStatus,
} from "@/services/types";

export interface ServiceRegistration {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventAddress?: string | null;
  eventLatitude?: number | null;
  eventLongitude?: number | null;
  checkInRadiusM?: number;
  proximityRadiusM?: number;
  distanceId?: string;
  distanceLabel: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amountCents: number;
  attendanceStatus?: "PENDING" | "PRESENT" | "ABSENT";
  checkInAt?: string | null;
  checkInDistanceM?: number | null;
  checkOutAt?: string | null;
  checkOutDistanceM?: number | null;
}

interface CreateRegistrationInput {
  eventId: string;
  distanceId: string;
}

interface RegistrationApiResponse {
  data: ServiceRegistration;
}

interface RegistrationListApiResponse {
  data: ServiceRegistration[];
}

interface RegistrationCheckInApiResponse {
  data: {
    registrationId: string;
    action: "CHECK_IN" | "CHECK_OUT";
    distanceMeters: number;
    checkInRadiusM: number;
    proximityRadiusM: number;
    checkInAt: string | null;
    checkOutAt: string | null;
    attendanceStatus: "PENDING" | "PRESENT" | "ABSENT";
  };
}

export function getInitialRegistrations(): ServiceRegistration[] {
  return [];
}

export async function getRegistrations(
  accessToken?: string | null,
): Promise<ServiceRegistration[]> {
  const response = await fetch("/api/registrations", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error("registrations_unavailable");
  }

  const payload = (await response.json()) as RegistrationListApiResponse;
  return payload.data;
}

export async function getAthleteIdentity(accessToken?: string | null): Promise<AthleteIdentity> {
  const response = await fetch("/api/me", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(errorPayload?.error?.message ?? "profile_unavailable");
  }

  const payload = (await response.json()) as {
    data?: {
      name?: string;
      email?: string;
      avatar_url?: string | null;
      account_status?: "ACTIVE" | "PENDING_INVITE" | "PENDING_APPROVAL" | "SUSPENDED";
      athlete_profile?: {
        athlete_status?: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED" | null;
        signup_source?: "SLUG" | "INVITE" | "ADMIN" | null;
        onboarding_completed_at?: string | null;
        member_number?: string | null;
        member_since?: string | null;
        cpf?: string | null;
        phone?: string | null;
        city?: string | null;
        state?: string | null;
        birth_date?: string | null;
        gender?: string | null;
        sport_level?: AthleteIdentity["sportLevel"];
        sport_goal?: string | null;
        next_competition_date?: string | null;
        emergency_contact?: AthleteEmergencyContact | null;
      };
    };
  };

  if (!payload.data?.name || !payload.data?.email) {
    throw new Error("profile_invalid_response");
  }

  const p = payload.data.athlete_profile;

  return {
    name: payload.data.name,
    email: payload.data.email,
    avatarUrl: payload.data.avatar_url ?? null,
    memberNumber: p?.member_number ?? null,
    memberSince: p?.member_since ?? null,
    accountStatus: payload.data.account_status ?? null,
    athleteStatus: p?.athlete_status ?? null,
    signupSource: p?.signup_source ?? null,
    onboardingCompletedAt: p?.onboarding_completed_at ?? null,
    cpf: p?.cpf ?? null,
    phone: p?.phone ?? null,
    city: p?.city ?? null,
    state: p?.state ?? null,
    birthDate: p?.birth_date ?? null,
    gender: p?.gender ?? null,
    sportLevel: p?.sport_level ?? null,
    sportGoal: p?.sport_goal ?? null,
    nextCompetitionDate: p?.next_competition_date ?? null,
    emergencyContact: p?.emergency_contact ?? null,
  };
}

export interface UpdateProfileInput {
  cpf?: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  sport_level?: AthleteIdentity["sportLevel"] | null;
  sport_goal?: string | null;
  next_competition_date?: string | null;
  emergency_contact?: { name: string; phone: string; relation?: string } | null;
  avatar_url?: string | null;
}

export async function updateAthleteProfile(
  input: UpdateProfileInput,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch("/api/me/profile", {
    method: "PATCH",
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
    throw new Error(errorPayload?.error?.message ?? "Não foi possível atualizar o perfil.");
  }
}

export async function createRegistrationDraft(
  input: CreateRegistrationInput,
  accessToken?: string | null,
): Promise<ServiceRegistration> {
  const response = await fetch("/api/registrations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errorPayload.error?.message ?? "Não foi possível criar inscrição.");
  }

  const payload = (await response.json()) as RegistrationApiResponse;
  return payload.data;
}

async function patchRegistration(
  registrationId: string,
  action: "CONFIRM_PAYMENT" | "MARK_INTERESTED" | "CANCEL",
  accessToken?: string | null,
): Promise<ServiceRegistration> {
  const response = await fetch(`/api/registrations/${registrationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errorPayload.error?.message ?? "Não foi possível atualizar inscrição.");
  }

  const payload = (await response.json()) as RegistrationApiResponse;
  return payload.data;
}

export async function confirmRegistrationPayment(
  registration: ServiceRegistration,
  accessToken?: string | null,
): Promise<ServiceRegistration> {
  return patchRegistration(registration.id, "CONFIRM_PAYMENT", accessToken);
}

export async function markRegistrationInterested(
  registration: ServiceRegistration,
  accessToken?: string | null,
): Promise<ServiceRegistration> {
  return patchRegistration(registration.id, "MARK_INTERESTED", accessToken);
}

export async function cancelRegistration(
  registration: ServiceRegistration,
  accessToken?: string | null,
): Promise<ServiceRegistration> {
  return patchRegistration(registration.id, "CANCEL", accessToken);
}

export async function checkInRegistration(
  registrationId: string,
  input: {
    action: "CHECK_IN" | "CHECK_OUT";
    latitude: number;
    longitude: number;
  },
  accessToken?: string | null,
): Promise<RegistrationCheckInApiResponse["data"]> {
  const response = await fetch(`/api/registrations/${registrationId}/checkin`, {
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
    throw new Error(errorPayload?.error?.message ?? "Nao foi possivel registrar presenca.");
  }

  const payload = (await response.json()) as RegistrationCheckInApiResponse;
  return payload.data;
}
