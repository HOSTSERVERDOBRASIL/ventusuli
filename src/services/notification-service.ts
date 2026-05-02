import { buildAuthHeaders } from "@/services/runtime";
import {
  AdminNotificationTemplate,
  UserNotificationChannel,
  UserNotificationItem,
  UserNotificationPreference,
} from "@/services/types";

interface NotificationListResponse {
  data: UserNotificationItem[];
  meta: {
    unread_count: number;
  };
}

interface NotificationPreferenceResponse {
  data: UserNotificationPreference;
}

export interface GetNotificationsInput {
  accessToken?: string | null;
  limit?: number;
  unreadOnly?: boolean;
}

interface AdminTemplateListResponse {
  data: AdminNotificationTemplate[];
}

interface AdminTemplateResponse {
  data: AdminNotificationTemplate;
}

function parseApiError(payload: unknown, fallback: string): Error {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return new Error(fallback);
  }

  const errorMessage = (payload as { error?: { message?: string } }).error?.message;
  return new Error(errorMessage ?? fallback);
}

export async function getNotifications({
  accessToken,
  limit = 10,
  unreadOnly = false,
}: GetNotificationsInput = {}): Promise<NotificationListResponse> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (unreadOnly) query.set("unread", "true");

  const response = await fetch(`/api/notifications?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  const payload = (await response.json().catch(() => null)) as
    | NotificationListResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel carregar notificacoes.");
  }

  return payload;
}

export async function markNotificationRead(
  notificationId: string,
  accessToken?: string | null,
): Promise<void> {
  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: buildAuthHeaders(accessToken),
  });

  if (response.ok) return;

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  throw parseApiError(payload, "Nao foi possivel marcar a notificacao como lida.");
}

export async function getNotificationPreference(
  accessToken?: string | null,
): Promise<UserNotificationPreference> {
  const response = await fetch("/api/notifications/preferences", {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  const payload = (await response.json().catch(() => null)) as
    | NotificationPreferenceResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel carregar preferencias de notificacao.");
  }

  return payload.data;
}

export async function getAdminNotificationTemplates(
  accessToken?: string | null,
  channel?: UserNotificationChannel,
): Promise<AdminNotificationTemplate[]> {
  const query = new URLSearchParams();
  if (channel) query.set("channel", channel);

  const response = await fetch(
    `/api/admin/notifications/templates${query.size ? `?${query.toString()}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
      headers: buildAuthHeaders(accessToken),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | AdminTemplateListResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel carregar os modelos de notificacao.");
  }

  return payload.data;
}

export async function updateAdminNotificationTemplate(
  id: string,
  input: {
    subject?: string | null;
    body?: string;
    isActive?: boolean;
  },
  accessToken?: string | null,
): Promise<AdminNotificationTemplate> {
  const response = await fetch(`/api/admin/notifications/templates/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | AdminTemplateResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel salvar o modelo de notificacao.");
  }

  return payload.data;
}
