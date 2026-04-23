import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { logError, toErrorContext, withRequestContext } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

const ALLOWED_TYPES = new Set(["LIKE", "FIRE", "APPLAUSE"] as const);

type ReactionType = "LIKE" | "FIRE" | "APPLAUSE";

function canReact(role: string): boolean {
  return role === "ATHLETE" || role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canReact(String(auth.role))) {
    return apiError("FORBIDDEN", "Seu perfil nao pode reagir na comunidade.", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const payload = body as { postId?: unknown; type?: unknown };
  const postId = typeof payload.postId === "string" ? payload.postId : "";
  const type = typeof payload.type === "string" ? payload.type.toUpperCase() : "";

  if (!postId) {
    return apiError("VALIDATION_ERROR", "Post invalido para reacao.", 400);
  }

  if (!ALLOWED_TYPES.has(type as ReactionType)) {
    return apiError("VALIDATION_ERROR", "Tipo de reacao invalido.", 400);
  }

  try {
    const post = await prisma.communityPost.findFirst({
      where: {
        id: postId,
        organization_id: auth.organizationId,
      },
      select: { id: true },
    });

    if (!post) {
      return apiError("VALIDATION_ERROR", "Post nao encontrado para este usuario.", 404);
    }

    const existing = await prisma.communityReaction.findFirst({
      where: {
        post_id: postId,
        organization_id: auth.organizationId,
        user_id: auth.userId,
        type: type as ReactionType,
      },
      select: { id: true },
    });

    let active = false;

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.communityReaction.delete({ where: { id: existing.id } });
        active = false;
      } else {
        await tx.communityReaction.create({
          data: {
            id: crypto.randomUUID(),
            post_id: postId,
            organization_id: auth.organizationId,
            user_id: auth.userId,
            type: type as ReactionType,
          },
        });
        active = true;
      }
    });

    const totalsRows = await prisma.communityReaction.groupBy({
      by: ["type"],
      where: {
        post_id: postId,
        organization_id: auth.organizationId,
      },
      _count: { _all: true },
    });

    const totals = {
      LIKE: 0,
      FIRE: 0,
      APPLAUSE: 0,
    } satisfies Record<ReactionType, number>;

    for (const row of totalsRows) {
      const reactionType = row.type as ReactionType;
      totals[reactionType] = row._count._all;
    }

    return NextResponse.json(
      {
        postId,
        type,
        active,
        totals,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError("community_reaction_toggle_failed", {
      ...withRequestContext(req, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        postId,
        type,
      }),
      ...toErrorContext(error),
    });
    return apiError("INTERNAL_ERROR", "Comunidade sem estrutura de banco. Rode as migrations.", 503);
  }
}
