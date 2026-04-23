import { jwtVerify } from "jose/jwt/verify";
import { UserRole } from "@/types";

export interface EdgeAccessTokenPayload {
  sub: string;
  role: UserRole;
  org: string;
  status?: "ACTIVE" | "PENDING_INVITE" | "PENDING_APPROVAL" | "SUSPENDED";
  iat: number;
  exp: number;
}

function getSecrets(): Uint8Array[] {
  const primary = process.env.JWT_SECRET;
  const previous = process.env.JWT_SECRET_PREVIOUS;
  const candidates = [primary, previous].filter((item): item is string => Boolean(item));
  if (!candidates.length) throw new Error("Missing required environment variable: JWT_SECRET");
  return candidates.map((value) => new TextEncoder().encode(value));
}

export async function verifyAccessTokenEdge(token: string): Promise<EdgeAccessTokenPayload | null> {
  const secrets = getSecrets();
  for (const secret of secrets) {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      return payload as unknown as EdgeAccessTokenPayload;
    } catch {
      // try next secret candidate
    }
  }
  return null;
}
