import { buildAuthHeaders } from "@/services/runtime";
import { CommunityFeedData, CommunityPost } from "@/services/types";

interface CommunityLoadInput {
  accessToken?: string | null;
  page?: number;
  limit?: number;
  tab?: string;
  cursor?: string | null;
}

export interface CommunityFeedResponse {
  data: CommunityFeedData;
}

async function parseResponseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return new Error(payload.error?.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function getCommunityFeed({
  accessToken,
  page,
  limit,
  tab,
  cursor,
}: CommunityLoadInput): Promise<CommunityFeedResponse> {
  const params = new URLSearchParams();
  if (typeof page === "number" && page > 0) params.set("page", String(page));
  if (typeof limit === "number" && limit > 0) params.set("limit", String(limit));
  if (tab) params.set("tab", tab);
  if (cursor) params.set("cursor", cursor);

  const query = params.toString();
  const response = await fetch(`/api/community/feed${query ? `?${query}` : ""}`, {
    method: "GET",
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw await parseResponseError(response, "community_unavailable");
  }

  const payload = (await response.json()) as CommunityFeedData;
  return { data: payload };
}

interface CommunityCreatePostInput {
  accessToken?: string | null;
  content: string;
  tab?: string;
}

export async function createCommunityPost({
  accessToken,
  content,
  tab,
}: CommunityCreatePostInput): Promise<CommunityPost> {
  const response = await fetch("/api/community/feed", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ content, tab }),
  });

  const payload = (await response.json()) as { post?: CommunityPost; error?: { message?: string } };

  if (!response.ok || !payload.post) {
    const message = payload.error?.message ?? "Nao foi possivel publicar na comunidade.";
    throw new Error(message);
  }

  return payload.post;
}

interface CommunityCreateCommentInput {
  accessToken?: string | null;
  postId: string;
  text: string;
}

export async function createCommunityComment({
  accessToken,
  postId,
  text,
}: CommunityCreateCommentInput): Promise<void> {
  const response = await fetch("/api/community/feed/comments", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ postId, text }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Nao foi possivel comentar.");
  }
}

interface CommunityToggleReactionInput {
  accessToken?: string | null;
  postId: string;
  type: "LIKE" | "FIRE" | "APPLAUSE";
}

export async function toggleCommunityReaction({
  accessToken,
  postId,
  type,
}: CommunityToggleReactionInput): Promise<void> {
  const response = await fetch("/api/community/feed/reactions", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ postId, type }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Nao foi possivel reagir na publicacao.");
  }
}
