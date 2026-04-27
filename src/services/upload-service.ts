import { buildAuthHeaders } from "@/services/runtime";

export type FrontendUploadScope = "events" | "avatars" | "rewards" | "branding";
export const ACCEPTED_IMAGE_FILE_INPUT_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,image/gif";

interface UploadResponse {
  data: {
    url: string;
    key: string;
    bytes: number;
    mimeType: string;
    scope: FrontendUploadScope;
    driver: "local" | "s3";
  };
}

export async function uploadImageFile(
  file: File,
  scope: FrontendUploadScope,
  accessToken?: string | null,
): Promise<UploadResponse["data"]> {
  const formData = new FormData();
  formData.append("scope", scope);
  formData.append("file", file);

  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: buildAuthHeaders(accessToken),
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | UploadResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !payload || !("data" in payload)) {
    const message = payload && "error" in payload ? payload.error?.message : null;
    throw new Error(message ?? "Nao foi possivel enviar a imagem.");
  }

  return payload.data;
}
