import { NextRequest, NextResponse } from "next/server";
import { ExternalPlatformAuthType, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError, handleApiException } from "@/lib/api-error";
import { getAuthContext } from "@/lib/request-auth";
import {
  listExternalPlatforms,
  upsertExternalPlatform,
} from "@/lib/integrations/external/platform-service";

const platformSchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
  baseUrl: z.string().trim().url(),
  authType: z.nativeEnum(ExternalPlatformAuthType),
  isActive: z.boolean().optional(),
});

function canManageIntegrations(roles: readonly UserRole[]): boolean {
  return roles.some(
    (role) => role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.ORGANIZER,
  );
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageIntegrations(auth.roles)) {
    return apiError("FORBIDDEN", "Sem permissao para gerenciar integracoes.", 403);
  }

  try {
    const data = await listExternalPlatforms(auth.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel listar plataformas integradas.");
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);
  if (!canManageIntegrations(auth.roles)) {
    return apiError("FORBIDDEN", "Sem permissao para cadastrar integracoes.", 403);
  }

  try {
    const parsed = platformSchema.parse(await req.json());
    const data = await upsertExternalPlatform(parsed);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiException(error, "Nao foi possivel cadastrar plataforma integrada.");
  }
}
