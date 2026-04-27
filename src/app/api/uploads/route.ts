import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { isAdminRole, getAuthContext } from "@/lib/request-auth";
import {
  getAllowedImageMimeTypes,
  getMaxUploadSizeBytes,
  uploadImage,
  validateImageFile,
  type UploadScope,
} from "@/lib/storage/image-upload";

const uploadSchema = z.object({
  scope: z.enum(["events", "avatars", "rewards", "branding"]),
});

function canUploadScope(scope: UploadScope, role: UserRole): boolean {
  if (scope === "avatars") return true;
  return isAdminRole(role);
}

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req);
  if (!auth) return apiError("UNAUTHORIZED", "Token de acesso ausente.", 401);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return apiError("VALIDATION_ERROR", "Envie o arquivo como multipart/form-data.", 400);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Falha ao ler arquivo enviado.", 400);
  }

  const scopeParse = uploadSchema.safeParse({
    scope: formData.get("scope"),
  });
  if (!scopeParse.success) {
    return apiError("VALIDATION_ERROR", "Escopo de upload invalido.", 400);
  }

  const scope = scopeParse.data.scope;
  if (!canUploadScope(scope, auth.role)) {
    return apiError("FORBIDDEN", "Voce nao possui permissao para este upload.", 403);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "Arquivo de imagem nao enviado.", 400);
  }

  const allowedMimeTypes = getAllowedImageMimeTypes();
  if (!allowedMimeTypes.includes(file.type)) {
    return apiError("VALIDATION_ERROR", "Tipo de arquivo nao permitido.", 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const validation = validateImageFile({
    mimeType: file.type,
    bytes,
    maxBytes: getMaxUploadSizeBytes(),
  });

  if (!validation.ok) {
    return apiError("VALIDATION_ERROR", validation.message, 400);
  }

  const uploaded = await uploadImage({
    organizationId: auth.organizationId,
    userId: auth.userId,
    scope,
    mimeType: file.type,
    bytes,
  });

  return NextResponse.json({
    data: {
      url: uploaded.url,
      key: uploaded.key,
      bytes: uploaded.bytes,
      mimeType: uploaded.mimeType,
      scope,
      driver: uploaded.driver,
    },
  });
}
