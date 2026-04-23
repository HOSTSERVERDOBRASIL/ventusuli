import { buildAuthHeaders } from "@/services/runtime";
import { NoticeAudience, NoticeItem, NoticeStatus } from "@/services/types";

interface NoticeListResponse {
  data: NoticeItem[];
}

interface NoticeMutationResponse {
  data: NoticeItem;
}

export interface CreateNoticeInput {
  title: string;
  body: string;
  audience: NoticeAudience;
  pinned?: boolean;
  publish_at?: string | null;
  telegram_enabled?: boolean;
}

export interface GetNoticesInput {
  accessToken?: string | null;
  status?: NoticeStatus;
  audience?: NoticeAudience;
  startDate?: string;
  endDate?: string;
}

function parseApiError(payload: unknown, fallback: string): Error {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return new Error(fallback);
  }

  const errorMessage = (payload as { error?: { message?: string } }).error?.message;
  return new Error(errorMessage ?? fallback);
}

function buildQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const queryString = query.toString();
  return queryString.length ? `?${queryString}` : "";
}

export async function getNotices({
  accessToken,
  status,
  audience,
  startDate,
  endDate,
}: GetNoticesInput = {}): Promise<NoticeItem[]> {
  const query = buildQuery({ status, audience, startDate, endDate });

  const response = await fetch(`/api/notices${query}`, {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  const payload = (await response.json().catch(() => null)) as
    | NoticeListResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel carregar os avisos.");
  }

  return payload.data;
}

export async function createNotice(
  input: CreateNoticeInput,
  accessToken?: string | null,
): Promise<NoticeItem> {
  const response = await fetch("/api/notices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | NoticeMutationResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel criar o aviso.");
  }

  return payload.data;
}

export async function publishNotice(
  noticeId: string,
  accessToken?: string | null,
): Promise<NoticeItem> {
  const response = await fetch(`/api/notices/${noticeId}/publish`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  const payload = (await response.json().catch(() => null)) as
    | NoticeMutationResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel publicar o aviso.");
  }

  return payload.data;
}

export async function resendNoticeTelegram(
  noticeId: string,
  accessToken?: string | null,
): Promise<NoticeItem> {
  const response = await fetch(`/api/notices/${noticeId}/resend-telegram`, {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
  });

  const payload = (await response.json().catch(() => null)) as
    | NoticeMutationResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    throw parseApiError(payload, "Nao foi possivel reenviar aviso ao Telegram.");
  }

  return payload.data;
}
