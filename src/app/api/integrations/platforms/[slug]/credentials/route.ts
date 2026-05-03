import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError, handleApiException } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";
import {
  ensureTicketSportsPlatform,
  upsertPlatformCredential,
} from "@/lib/integrations/external/platform-service";

const credentialSchema = z.object({
  token: z.string().trim().min(1).optional(),
  clientId: z.string().trim().optional().nullable(),
  clientSecret: z.string().trim().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

function canManageIntegrations(roles: readonly UserRole[]): boolean {
  return roles.some(
    (role) => role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ORGANIZER,
  );
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageIntegrations(auth.roles)) {
    return apiError("FORBIDDEN", "Sem permissao para configurar credenciais.", 403);
  }

  try {
    if (params.slug === "ticketsports") await ensureTicketSportsPlatform();
    const parsed = credentialSchema.parse(await req.json());
    const data = await upsertPlatformCredential({
      platformSlug: params.slug,
      organizationId: auth.organizationId,
      token: parsed.token,
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    });

    return NextResponse.json({
      data: {
        id: data.id,
        platformId: data.platformId,
        organizationId: data.organizationId,
        clientId: data.clientId,
        expiresAt: data.expiresAt,
        updatedAt: data.updatedAt,
        hasSecret: true,
      },
    });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel salvar credenciais da integracao.");
  }
}
