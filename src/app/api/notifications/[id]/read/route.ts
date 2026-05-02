import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/request-auth";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const readAt = new Date();
  const result = await prisma.notificationJob.updateMany({
    where: {
      id: params.id,
      organizationId: auth.organizationId,
      recipientId: auth.userId,
      channel: "IN_APP",
    },
    data: {
      readAt,
    },
  });

  if (result.count === 0) {
    return apiError("USER_NOT_FOUND", "Notificacao nao encontrada.", 404);
  }

  return NextResponse.json({
    data: {
      id: params.id,
      read_at: readAt.toISOString(),
    },
  });
}
