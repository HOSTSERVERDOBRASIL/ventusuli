import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getOptionalIntegrationEnv } from "@/lib/env";

export type UploadScope = "events" | "avatars" | "rewards" | "branding";

const IMAGE_MIME_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function normalizeMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) {
      return false;
    }
  }

  return true;
}

export function detectImageMimeType(bytes: Uint8Array): string | null {
  if (matchesSignature(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (matchesSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (
    matchesSignature(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    matchesSignature(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    matchesSignature(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    matchesSignature(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }

  return null;
}

export function validateImageFile(input: { mimeType: string; bytes: Uint8Array }): {
  ok: true;
  mimeType: string;
} | {
  ok: false;
  reason: "unsupported_type" | "signature_mismatch";
} {
  const normalizedMimeType = normalizeMimeType(input.mimeType);
  const detectedMimeType = detectImageMimeType(input.bytes);

  if (!detectedMimeType) {
    return { ok: false, reason: "unsupported_type" };
  }

  if (!getAllowedImageMimeTypes().includes(detectedMimeType)) {
    return { ok: false, reason: "unsupported_type" };
  }

  if (normalizedMimeType && normalizedMimeType !== detectedMimeType) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true, mimeType: detectedMimeType };
}

export function getAllowedImageMimeTypes(): string[] {
  return Object.keys(IMAGE_MIME_MAP);
}

export function getMaxUploadSizeBytes(): number {
  const optionalEnv = getOptionalIntegrationEnv();
  const configuredMb = optionalEnv.UPLOAD_MAX_FILE_MB;
  if (!configuredMb || configuredMb <= 0) return DEFAULT_MAX_UPLOAD_BYTES;
  return configuredMb * 1024 * 1024;
}

export function getExtensionFromMimeType(mimeType: string): string | null {
  return IMAGE_MIME_MAP[normalizeMimeType(mimeType)] ?? null;
}

function toSafeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 80) || "segment";
}

function buildRelativePath(input: {
  organizationId: string;
  scope: UploadScope;
  userId?: string;
  extension: string;
}): string {
  const org = toSafeSegment(input.organizationId);
  const user = input.userId ? toSafeSegment(input.userId) : null;
  const fileName = `${Date.now()}-${randomUUID()}.${input.extension}`;

  if (input.scope === "avatars" && user) {
    return path.posix.join("uploads", org, input.scope, user, fileName);
  }

  return path.posix.join("uploads", org, input.scope, fileName);
}

export interface ImageUploadInput {
  organizationId: string;
  scope: UploadScope;
  mimeType: string;
  bytes: Uint8Array;
  userId?: string;
}

export interface ImageUploadResult {
  url: string;
  key: string;
  bytes: number;
  mimeType: string;
  driver: "local";
}

interface StorageDriver {
  uploadImage(input: ImageUploadInput): Promise<ImageUploadResult>;
}

class LocalStorageDriver implements StorageDriver {
  async uploadImage(input: ImageUploadInput): Promise<ImageUploadResult> {
    const extension = getExtensionFromMimeType(input.mimeType);
    if (!extension) {
      throw new Error("unsupported_mime_type");
    }

    const key = buildRelativePath({
      organizationId: input.organizationId,
      scope: input.scope,
      userId: input.userId,
      extension,
    });
    const absolutePath = path.join(process.cwd(), "public", key);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.bytes);

    return {
      url: `/${key}`,
      key,
      bytes: input.bytes.byteLength,
      mimeType: input.mimeType,
      driver: "local",
    };
  }
}

function getStorageDriver(): StorageDriver {
  const optionalEnv = getOptionalIntegrationEnv();

  // TODO: adicionar S3/MinIO/R2 nesta fábrica sem alterar as chamadas de upload.
  // Hoje, mesmo com STORAGE_* preenchido, o fallback local é usado.
  if (optionalEnv.STORAGE_DRIVER === "s3") {
    return new LocalStorageDriver();
  }

  return new LocalStorageDriver();
}

export async function uploadImage(input: ImageUploadInput): Promise<ImageUploadResult> {
  const driver = getStorageDriver();
  return driver.uploadImage(input);
}
