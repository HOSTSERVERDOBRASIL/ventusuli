import crypto from "node:crypto";
import { ExternalIntegrationError } from "@/lib/integrations/external/types";

const ALGORITHM = "aes-256-gcm";

function encryptionKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new ExternalIntegrationError(
      "CREDENTIAL_ENCRYPTION_KEY_MISSING",
      "Chave de criptografia de credenciais nao configurada.",
      500,
    );
  }

  const decoded = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new ExternalIntegrationError(
      "CREDENTIAL_ENCRYPTION_KEY_INVALID",
      "CREDENTIAL_ENCRYPTION_KEY deve ter 32 bytes em base64 ou 64 caracteres hexadecimais.",
      500,
    );
  }
  return decoded;
}

export function encryptCredential(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptCredential(value: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new ExternalIntegrationError("CREDENTIAL_FORMAT_INVALID", "Credencial criptografada invalida.", 500);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
