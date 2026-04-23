import { NextRequest, NextResponse } from "next/server";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";
import { logError, toErrorContext, withRequestContext } from "@/lib/logger";
import { CommunityFeedData, CommunityPost } from "@/services/types";

const COMMUNITY_TABS = ["Feed", "Treinos", "Eventos", "Resultados"] as const;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const CURSOR_SEPARATOR = "|";

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function toCommunityRole(role: string): CommunityPost["role"] {
  if (role === "ATHLETE") return "ATHLETE";
  if (role === "COACH") return "COACH";
  return "ORGANIZER";
}

function canPublish(role: string): boolean {
  return role === "ATHLETE" || role === "ADMIN" || role === "SUPER_ADMIN";
}

function normalizeTab(tab?: string | null): string {
  if (!tab) return "Feed";
  return COMMUNITY_TABS.includes(tab as (typeof COMMUNITY_TABS)[number]) ? tab : "Feed";
}

function timeAgo(date: Date): string {
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: ptBR });
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return value;
}

interface FeedCursor {
  createdAt: Date;
  id: string;
}

function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}${CURSOR_SEPARATOR}${cursor.id}`).toString("base64url");
}

function decodeCursor(raw: string | null): FeedCursor | null {
  if (!raw) return null;

  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [createdAtRaw, id] = decoded.split(CURSOR_SEPARATOR);
    if (!createdAtRaw || !id) return null;

    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime())) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
}

function buildEmptyFeed(message: string, page: number, limit: number): CommunityFeedData {
  return {
    tabs: [...COMMUNITY_TABS],
    posts: [],
    source: "EMPTY",
    message,
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasMore: false,
    },
    cursor: {
      next: null,
      hasMore: false,
    },
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), DEFAULT_PAGE);
  const requestedLimit = parsePositiveInt(req.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const cursor = decodeCursor(req.nextUrl.searchParams.get("cursor"));
  const tab = req.nextUrl.searchParams.get("tab");
  const normalizedTab = tab ? normalizeTab(tab) : null;

  try {
    const where = {
      organization_id: auth.organizationId,
      ...(normalizedTab ? { tab: normalizedTab } : {}),
    };

    const whereWithCursor = cursor
      ? {
          ...where,
          OR: [
            { created_at: { lt: cursor.createdAt } },
            { created_at: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : where;

    const [total, postsWithLookahead] = await Promise.all([
      prisma.communityPost.count({ where }),
      prisma.communityPost.findMany({
        where: whereWithCursor,
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        skip: cursor ? 0 : (page - 1) * limit,
        take: limit + 1,
        select: {
          id: true,
          tab: true,
          content: true,
          created_at: true,
          user: {
            select: {
              name: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const hasMore = postsWithLookahead.length > limit;
    const posts = postsWithLookahead.slice(0, limit);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const nextCursor =
      hasMore && posts.length > 0
        ? encodeCursor({
            createdAt: posts[posts.length - 1].created_at,
            id: posts[posts.length - 1].id,
          })
        : null;

    if (!posts.length) {
      return NextResponse.json(
        buildEmptyFeed(
          "Comunidade ainda sem publicações para esta organização. Ative o módulo ou crie o primeiro post.",
          page,
          limit,
        ),
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const postIds = posts.map((post) => post.id);

    const [comments, reactionCounts, userReactions] = await Promise.all([
      prisma.communityComment.findMany({
        where: {
          organization_id: auth.organizationId,
          post_id: { in: postIds },
        },
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          post_id: true,
          text: true,
          created_at: true,
          user: {
            select: {
              name: true,
              role: true,
            },
          },
        },
      }),
      prisma.communityReaction.groupBy({
        by: ["post_id", "type"],
        where: {
          organization_id: auth.organizationId,
          post_id: { in: postIds },
        },
        _count: { _all: true },
      }),
      prisma.communityReaction.findMany({
        where: {
          organization_id: auth.organizationId,
          user_id: auth.userId,
          post_id: { in: postIds },
        },
        select: {
          post_id: true,
          type: true,
        },
      }),
    ]);

    const commentsByPost = comments.reduce<Record<string, typeof comments>>((acc, comment) => {
      if (!acc[comment.post_id]) acc[comment.post_id] = [];
      acc[comment.post_id].push(comment);
      return acc;
    }, {});

    const reactionCountByPost = reactionCounts.reduce<
      Record<string, Record<"LIKE" | "FIRE" | "APPLAUSE", number>>
    >((acc, row) => {
      if (!acc[row.post_id]) {
        acc[row.post_id] = { LIKE: 0, FIRE: 0, APPLAUSE: 0 };
      }
      const reactionType = row.type as "LIKE" | "FIRE" | "APPLAUSE";
      acc[row.post_id][reactionType] = row._count._all;
      return acc;
    }, {});

    const reactionActiveByPost = userReactions.reduce<
      Record<string, Record<"LIKE" | "FIRE" | "APPLAUSE", boolean>>
    >((acc, row) => {
      if (!acc[row.post_id]) {
        acc[row.post_id] = { LIKE: false, FIRE: false, APPLAUSE: false };
      }
      const reactionType = row.type as "LIKE" | "FIRE" | "APPLAUSE";
      acc[row.post_id][reactionType] = true;
      return acc;
    }, {});

    const mappedDbPosts: CommunityPost[] = posts.map((post) => ({
      id: post.id,
      tab: normalizeTab(post.tab),
      author: post.user.name,
      avatarInitials: initialsFromName(post.user.name),
      role: toCommunityRole(post.user.role),
      timeAgo: timeAgo(post.created_at),
      content: post.content,
      reactions: [
        {
          type: "LIKE",
          count: reactionCountByPost[post.id]?.LIKE ?? 0,
          activeByDefault: reactionActiveByPost[post.id]?.LIKE ?? false,
        },
        {
          type: "FIRE",
          count: reactionCountByPost[post.id]?.FIRE ?? 0,
          activeByDefault: reactionActiveByPost[post.id]?.FIRE ?? false,
        },
        {
          type: "APPLAUSE",
          count: reactionCountByPost[post.id]?.APPLAUSE ?? 0,
          activeByDefault: reactionActiveByPost[post.id]?.APPLAUSE ?? false,
        },
      ],
      comments: (commentsByPost[post.id] ?? []).map((comment) => ({
        id: comment.id,
        author: comment.user.name,
        avatarInitials: initialsFromName(comment.user.name),
        role: toCommunityRole(comment.user.role),
        timeAgo: timeAgo(comment.created_at),
        text: comment.text,
      })),
    }));

    return NextResponse.json(
      {
        tabs: [...COMMUNITY_TABS],
        posts: mappedDbPosts,
        source: "LIVE",
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore,
        },
        cursor: {
          next: nextCursor,
          hasMore,
        },
      } satisfies CommunityFeedData,
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("community_feed_load_failed", {
      ...withRequestContext(req, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        page,
        limit,
      }),
      ...toErrorContext(error),
    });
    return apiError(
      "INTERNAL_ERROR",
      "Comunidade indisponivel no momento. Verifique migracoes e conectividade do banco.",
      503,
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  if (!canPublish(auth.role)) {
    return apiError("FORBIDDEN", "Seu perfil não pode publicar na comunidade.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body inválido.", 400);
  }

  const payload = body as { content?: unknown; tab?: unknown };
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  const tab = normalizeTab(typeof payload.tab === "string" ? payload.tab : null);

  if (content.length < 3) {
    return apiError("VALIDATION_ERROR", "Escreva pelo menos 3 caracteres.", 400);
  }

  if (content.length > 500) {
    return apiError("VALIDATION_ERROR", "Post muito longo. Limite de 500 caracteres.", 400);
  }

  try {
    const created = await prisma.communityPost.create({
      data: {
        id: crypto.randomUUID(),
        organization_id: auth.organizationId,
        user_id: auth.userId,
        tab,
        content,
      },
      select: {
        id: true,
        tab: true,
        content: true,
        created_at: true,
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });

    const post: CommunityPost = {
      id: created.id,
      tab,
      author: created.user.name,
      avatarInitials: initialsFromName(created.user.name),
      role: toCommunityRole(created.user.role),
      timeAgo: "agora",
      content,
      reactions: [
        { type: "LIKE", count: 0 },
        { type: "FIRE", count: 0 },
        { type: "APPLAUSE", count: 0 },
      ],
      comments: [],
    };

    return NextResponse.json({ post }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("community_post_create_failed", {
      ...withRequestContext(req, {
        organizationId: auth.organizationId,
        userId: auth.userId,
      }),
      ...toErrorContext(error),
    });
    return apiError("INTERNAL_ERROR", "Comunidade sem estrutura de banco. Rode as migrations.", 503);
  }
}

