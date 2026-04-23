import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserRole } from "@/types";
import { assertAuthSecretsForRuntime } from "@/lib/auth-config";

// ─── Environment ──────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  assertAuthSecretsForRuntime();
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function readSecretCandidates(key: string): string[] {
  const primary = process.env[key];
  const previous = process.env[`${key}_PREVIOUS`];
  return [primary, previous].filter((value): value is string => Boolean(value));
}

// ─── Password ─────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT Access Token ─────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;   // userId
  role: UserRole;
  org: string;   // orgId
  status?: "ACTIVE" | "PENDING_INVITE" | "PENDING_APPROVAL" | "SUSPENDED";
  iat: number;
  exp: number;
}

export function generateAccessToken(
  userId: string,
  role: UserRole,
  orgId: string,
  accountStatus: AccessTokenPayload["status"] = "ACTIVE",
  expiresIn: jwt.SignOptions["expiresIn"] = "15m",
): string {
  const secret = requireEnv("JWT_SECRET");
  return jwt.sign(
    { sub: userId, role, org: orgId, status: accountStatus },
    secret,
    { expiresIn, algorithm: "HS256" },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const candidates = readSecretCandidates("JWT_SECRET");
  if (!candidates.length) return null;

  for (const secret of candidates) {
    try {
      const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
      return payload as AccessTokenPayload;
    } catch {
      // try next candidate secret
    }
  }

  return null;
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/** Returns a cryptographically random 64-byte hex string. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

/** SHA-256 hash of a refresh token for safe DB storage. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Returns a random token for one-time flows (password reset, invite links, etc.) */
export function generateOneTimeToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** SHA-256 hash used to store one-time tokens safely in database. */
export function hashOneTimeToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
