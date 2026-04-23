import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { logError, toErrorContext, withRequestContext } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Body invalido.", 400);
  }

  const payload = body as { postId?: unknown; text?: unknown };
  const postId = typeof payload.postId === "string" ? payload.postId : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";

  if (!postId) {
    return apiError("VALIDATION_ERROR", "Post invalido para comentario.", 400);
  }

  if (text.length < 2) {
    return apiError("VALIDATION_ERROR", "Comentario muito curto.", 400);
  }

  if (text.length > 280) {
    return apiError("VALIDATION_ERROR", "Comentario muito longo. Limite de 280 caracteres.", 400);
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

    const comment = await prisma.communityComment.create({
      data: {
        id: crypto.randomUUID(),
        post_id: postId,
        organization_id: auth.organizationId,
        user_id: auth.userId,
        text,
      },
      select: { id: true },
    });

    return NextResponse.json({ commentId: comment.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logError("community_comment_create_failed", {
      ...withRequestContext(req, {
        organizationId: auth.organizationId,
        userId: auth.userId,
        postId,
      }),
      ...toErrorContext(error),
    });
    return apiError("INTERNAL_ERROR", "Comunidade sem estrutura de banco. Rode as migrations.", 503);
  }
}
