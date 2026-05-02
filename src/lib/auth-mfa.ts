import crypto from "crypto";
import { MfaMethod, UserRole } from "@prisma/client";
import { generateOneTimeToken, hashOneTimeToken } from "@/lib/auth";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const EMAIL_OTP_DIGITS = 6;

export const MFA_LOGIN_TTL_MS = 10 * 60 * 1000;
export const MFA_EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
export const MFA_MAX_ATTEMPTS = 5;
const DEFAULT_MFA_REQUIRED_ROLES: UserRole[] = [];

export function isPrivilegedRole(role: UserRole | string): boolean {
  const value = String(role);
  return (
    value === "SUPER_ADMIN" ||
    value === "ADMIN" ||
    value === "MANAGER" ||
    value === "FINANCE" ||
    value === "ORGANIZER" ||
    value === "SUPPORT" ||
    value === "MODERATOR"
  );
}

export function isMfaMandatoryForRole(role: UserRole | string): boolean {
  const configuredRoles = process.env.MFA_REQUIRED_ROLES;
  const requiredRoles = (configuredRoles?.trim() ? configuredRoles : DEFAULT_MFA_REQUIRED_ROLES.join(","))
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  if (requiredRoles.includes("ALL")) return true;
  return requiredRoles.includes(String(role));
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const maskedLocal =
    local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}`;
  const [domainName, ...rest] = domain.split(".");
  const maskedDomain = domainName.length <= 2 ? `${domainName[0] ?? "*"}*` : `${domainName.slice(0, 2)}***`;
  return `${maskedLocal}@${[maskedDomain, ...rest].join(".")}`;
}

function normalizeBase32(input: string): string {
  return input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
}

export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(input: string): Buffer {
  const normalized = normalizeBase32(input);
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

export function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

function generateHotp(secret: string, counter: number, digits = TOTP_DIGITS): string {
  const key = decodeBase32(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function generateTotp(secret: string, time = Date.now()): string {
  const counter = Math.floor(time / 1000 / TOTP_STEP_SECONDS);
  return generateHotp(secret, counter);
}

export function verifyTotp(code: string, secret: string, time = Date.now(), windowSize = 1): boolean {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== TOTP_DIGITS) return false;

  const counter = Math.floor(time / 1000 / TOTP_STEP_SECONDS);
  for (let offset = -windowSize; offset <= windowSize; offset += 1) {
    if (generateHotp(secret, counter + offset) === normalized) {
      return true;
    }
  }

  return false;
}

export function buildOtpAuthUrl({
  issuer,
  accountName,
  secret,
}: {
  issuer: string;
  accountName: string;
  secret: string;
}): string {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function createChallengeToken(): { rawToken: string; tokenHash: string } {
  const rawToken = generateOneTimeToken(32);
  return { rawToken, tokenHash: hashOneTimeToken(rawToken) };
}

export function hashChallengeToken(token: string): string {
  return hashOneTimeToken(token);
}

export function generateEmailOtpCode(): string {
  return crypto.randomInt(0, 10 ** EMAIL_OTP_DIGITS).toString().padStart(EMAIL_OTP_DIGITS, "0");
}

export function hashMfaCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function verifyHashedMfaCode(code: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  return hashMfaCode(code.replace(/\D/g, "")) === hash;
}

export function generateRecoveryCodes(total = 8): string[] {
  return Array.from({ length: total }, () =>
    `${crypto.randomBytes(2).toString("hex")}-${crypto.randomBytes(2).toString("hex")}`.toUpperCase(),
  );
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function hashRecoveryCodes(codes: string[]): string[] {
  return codes.map(hashRecoveryCode);
}

export function consumeRecoveryCode(code: string, hashes: string[]): string[] | null {
  const target = hashRecoveryCode(code);
  const index = hashes.indexOf(target);
  if (index === -1) return null;
  return hashes.filter((_, hashIndex) => hashIndex !== index);
}

export function getAvailableMfaMethods(emailOtpEnabled: boolean): MfaMethod[] {
  return emailOtpEnabled
    ? [MfaMethod.TOTP, MfaMethod.EMAIL_OTP, MfaMethod.RECOVERY_CODE]
    : [MfaMethod.TOTP, MfaMethod.RECOVERY_CODE];
}
