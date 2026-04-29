import { createHash, createHmac, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getOptionalIntegrationEnv } from "@/lib/env";

export type UploadScope = "events" | "avatars" | "rewards" | "branding" | "photos";

const IMAGE_MIME_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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
  return IMAGE_MIME_MAP[mimeType.toLowerCase()] ?? null;
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
  driver: "local" | "s3";
}

interface StorageDriver {
  uploadImage(input: ImageUploadInput): Promise<ImageUploadResult>;
}

function decodeAscii(bytes: Uint8Array): string {
  return new TextDecoder("ascii").decode(bytes);
}

function hasImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/gif") {
    const header = decodeAscii(bytes.slice(0, 6));
    return header === "GIF87a" || header === "GIF89a";
  }

  if (mimeType === "image/webp") {
    return decodeAscii(bytes.slice(0, 4)) === "RIFF" && decodeAscii(bytes.slice(8, 12)) === "WEBP";
  }

  return false;
}

export function validateImageFile(input: {
  mimeType: string;
  bytes: Uint8Array;
  maxBytes?: number;
}): { ok: true } | { ok: false; message: string } {
  const mimeType = input.mimeType.toLowerCase();
  if (!getExtensionFromMimeType(mimeType)) {
    return { ok: false, message: "Tipo de arquivo nao permitido." };
  }

  const maxBytes = input.maxBytes ?? getMaxUploadSizeBytes();
  if (input.bytes.byteLength > maxBytes) {
    return {
      ok: false,
      message: `Arquivo excede o limite de ${Math.floor(maxBytes / (1024 * 1024))}MB.`,
    };
  }

  if (!hasImageSignature(input.bytes, mimeType)) {
    return { ok: false, message: "Conteudo da imagem nao corresponde ao tipo informado." };
  }

  return { ok: true };
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

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function sha256Hex(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

class S3StorageDriver implements StorageDriver {
  constructor(
    private readonly config: {
      endpoint: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
      publicBaseUrl?: string;
    },
  ) {}

  async uploadImage(input: ImageUploadInput): Promise<ImageUploadResult> {
    const extension = getExtensionFromMimeType(input.mimeType);
    if (!extension) throw new Error("unsupported_mime_type");

    const key = buildRelativePath({
      organizationId: input.organizationId,
      scope: input.scope,
      userId: input.userId,
      extension,
    });

    const endpoint = new URL(this.config.endpoint);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";
    const encodedKey = key.split("/").map(encodePathSegment).join("/");
    const pathname = `/${encodePathSegment(this.config.bucket)}/${encodedKey}`;
    const payloadHash = sha256Hex(input.bytes);
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalHeaders =
      `host:${endpoint.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const canonicalRequest = [
      "PUT",
      pathname,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.config.secretKey}`, dateStamp), region), service),
      "aws4_request",
    );
    const signature = hmac(signingKey, stringToSign).toString("hex");
    const url = new URL(pathname, endpoint);

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization:
          `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${credentialScope}, ` +
          `SignedHeaders=${signedHeaders}, Signature=${signature}`,
        "Content-Type": input.mimeType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
      body: Buffer.from(input.bytes),
    });

    if (!response.ok) {
      throw new Error(`s3_upload_failed:${response.status}`);
    }

    const publicBase = this.config.publicBaseUrl?.replace(/\/+$/, "");
    return {
      url: publicBase ? `${publicBase}/${key}` : url.toString(),
      key,
      bytes: input.bytes.byteLength,
      mimeType: input.mimeType,
      driver: "s3",
    };
  }
}

function getStorageDriver(): StorageDriver {
  const optionalEnv = getOptionalIntegrationEnv();

  if (optionalEnv.STORAGE_DRIVER === "s3") {
    if (
      !optionalEnv.STORAGE_ENDPOINT ||
      !optionalEnv.STORAGE_BUCKET ||
      !optionalEnv.STORAGE_ACCESS_KEY ||
      !optionalEnv.STORAGE_SECRET_KEY
    ) {
      throw new Error("s3_storage_not_configured");
    }

    return new S3StorageDriver({
      endpoint: optionalEnv.STORAGE_ENDPOINT,
      bucket: optionalEnv.STORAGE_BUCKET,
      accessKey: optionalEnv.STORAGE_ACCESS_KEY,
      secretKey: optionalEnv.STORAGE_SECRET_KEY,
      publicBaseUrl: optionalEnv.STORAGE_PUBLIC_BASE_URL,
    });
  }

  return new LocalStorageDriver();
}

export async function uploadImage(input: ImageUploadInput): Promise<ImageUploadResult> {
  const driver = getStorageDriver();
  return driver.uploadImage(input);
}
