import { type NextResponse } from "next/server";
import { type ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const REFRESH_TOKEN_COOKIE = "vs_refresh_token";
export const ACCESS_TOKEN_COOKIE = "vs_access_token";

const REFRESH_TOKEN_TTL_DAYS = 30;
const SHORT_REFRESH_TOKEN_TTL_DAYS = 1;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

function baseCookieOptions(path: string, maxAge: number): Partial<ResponseCookie> {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path,
    maxAge,
    priority: "high",
    ...(isProduction && process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

export function setAccessCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds = ACCESS_TOKEN_TTL_SECONDS,
): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, token, baseCookieOptions("/", maxAgeSeconds));
}

export function setRefreshCookie(response: NextResponse, token: string, rememberMe = true): void {
  response.cookies.set(
    REFRESH_TOKEN_COOKIE,
    token,
    baseCookieOptions(
      "/api/auth",
      (rememberMe ? REFRESH_TOKEN_TTL_DAYS : SHORT_REFRESH_TOKEN_TTL_DAYS) * 24 * 60 * 60,
    ),
  );
}

export function clearRefreshCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", baseCookieOptions("/api/auth", 0));
}

export function clearAccessCookie(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", baseCookieOptions("/", 0));
}
