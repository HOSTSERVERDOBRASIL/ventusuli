import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenEdge } from "@/lib/auth-edge";
import {
  API_ROUTE_POLICY_RULES,
  PAGE_ROUTE_POLICY_RULES,
  canAccessPolicy,
  getRoutePolicy,
} from "@/lib/authorization";
import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";
import { createRequestId, getRequestIdFromHeaders } from "@/lib/logger";
import { getAccessTokenFromRequest } from "@/lib/request-auth";
import { UserRole } from "@/types";

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/api/organizations/by-slug",
  "/api/integrations/strava/webhook",
  "/api/payments/webhook",
];
const AUTH_PAGES = [
  "/login",
  "/register",
  "/register/assessoria",
  "/register/atleta",
  "/activate-admin",
  "/aguardando-aprovacao",
  "/forgot-password",
  "/reset-password",
  "/mfa",
];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicApiRoute(pathname: string): boolean {
  return startsWithAny(pathname, PUBLIC_API_PREFIXES);
}

function isProtectedApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/") && !isPublicApiRoute(pathname);
}

function isProtectedPageRoute(pathname: string): boolean {
  return getRoutePolicy(pathname, PAGE_ROUTE_POLICY_RULES) !== null;
}

function isAuthPage(pathname: string): boolean {
  return startsWithAny(pathname, AUTH_PAGES);
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}

function redirectToLogin(req: NextRequest, requestId: string, reason?: "expired"): NextResponse {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  if (reason) loginUrl.searchParams.set("reason", reason);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  return withRequestId(response, requestId);
}

function redirectToLoginInactive(req: NextRequest, requestId: string): NextResponse {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("reason", "inactive");
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  return withRequestId(response, requestId);
}

function allowAuthPageWithClearedAccessCookie(requestId: string): NextResponse {
  const response = NextResponse.next();
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  return withRequestId(response, requestId);
}

function parseRole(role: string): UserRole | null {
  const normalized = role.toUpperCase() as UserRole;
  return Object.values(UserRole).includes(normalized) ? normalized : null;
}

function fallbackPathByRole(role: UserRole): string {
  if (role === UserRole.SUPER_ADMIN) return "/super-admin";
  if (role === UserRole.ADMIN) return "/admin";
  if (role === UserRole.FINANCE) return "/admin/financeiro";
  if (role === UserRole.COACH) return "/coach";
  return "/";
}

function resolveLegacyAthletesPath(role: UserRole): string {
  if (role === UserRole.ADMIN) return "/admin/atletas";
  if (role === UserRole.COACH) return "/coach/atletas";
  return fallbackPathByRole(role);
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const requestId = getRequestIdFromHeaders(req.headers) ?? createRequestId();
  const protectedApi = isProtectedApiRoute(pathname);
  const protectedPage = isProtectedPageRoute(pathname);
  const authPage = isAuthPage(pathname);

  if (!protectedApi && !protectedPage && !authPage) {
    return withRequestId(NextResponse.next(), requestId);
  }

  const token = getAccessTokenFromRequest(req, "bearer-first");

  if (!token) {
    if (protectedPage) return redirectToLogin(req, requestId);

    if (protectedApi) {
      return withRequestId(
        NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Token de acesso ausente." } },
          { status: 401, headers: { "X-Session-Expired": "1" } },
        ),
        requestId,
      );
    }

    return withRequestId(NextResponse.next(), requestId);
  }

  const payload = await verifyAccessTokenEdge(token);

  if (!payload) {
    if (authPage) return allowAuthPageWithClearedAccessCookie(requestId);

    if (protectedPage) return redirectToLogin(req, requestId, "expired");

    return withRequestId(
      NextResponse.json(
        { error: { code: "TOKEN_INVALID", message: "Token invalido ou expirado." } },
        { status: 401, headers: { "X-Session-Expired": "1" } },
      ),
      requestId,
    );
  }

  const role = parseRole(payload.role);
  if (!role) {
    if (authPage) return allowAuthPageWithClearedAccessCookie(requestId);

    if (protectedPage) return redirectToLogin(req, requestId, "expired");
    return withRequestId(
      NextResponse.json(
        { error: { code: "TOKEN_INVALID", message: "Perfil de acesso invalido." } },
        { status: 401, headers: { "X-Session-Expired": "1" } },
      ),
      requestId,
    );
  }

  const accountStatus = payload.status ?? "ACTIVE";
  if (accountStatus !== "ACTIVE") {
    if (authPage) return allowAuthPageWithClearedAccessCookie(requestId);

    if (protectedPage) return redirectToLoginInactive(req, requestId);

    return withRequestId(
      NextResponse.json(
        {
          error: {
            code: "ACCOUNT_INACTIVE",
            message: "Conta pendente de ativacao ou aprovacao.",
          },
        },
        { status: 403, headers: { "X-Session-Expired": "1" } },
      ),
      requestId,
    );
  }

  if (authPage) {
    const dispatchUrl = req.nextUrl.clone();
    dispatchUrl.pathname = "/dashboard";
    dispatchUrl.search = "";
    return withRequestId(NextResponse.redirect(dispatchUrl), requestId);
  }

  if (pathname === "/atletas") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = resolveLegacyAthletesPath(role);
    return withRequestId(NextResponse.redirect(redirectUrl), requestId);
  }

  if (pathname === "/dashboard") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = fallbackPathByRole(role);
    redirectUrl.search = "";
    return withRequestId(NextResponse.redirect(redirectUrl), requestId);
  }

  const pagePolicy = protectedPage ? getRoutePolicy(pathname, PAGE_ROUTE_POLICY_RULES) : null;
  if (pagePolicy && !canAccessPolicy(role, pagePolicy)) {
    const blockedUrl = req.nextUrl.clone();
    blockedUrl.pathname = fallbackPathByRole(role);
    blockedUrl.search = "";
    return withRequestId(NextResponse.redirect(blockedUrl), requestId);
  }

  const apiPolicy = protectedApi
    ? getRoutePolicy(pathname, API_ROUTE_POLICY_RULES, req.method)
    : null;
  if (apiPolicy && !canAccessPolicy(role, apiPolicy)) {
    return withRequestId(
      NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Voce nao possui permissao para acessar este recurso.",
          },
        },
        { status: 403 },
      ),
      requestId,
    );
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-role", role);
  requestHeaders.set("x-org-id", payload.org);
  requestHeaders.set("x-request-id", requestId);

  return withRequestId(NextResponse.next({ request: { headers: requestHeaders } }), requestId);
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/super-admin",
    "/super-admin/:path*",
    "/admin",
    "/admin/:path*",
    "/coach",
    "/coach/:path*",
    "/provas",
    "/provas/:path*",
    "/minhas-inscricoes",
    "/minhas-inscricoes/:path*",
    "/financeiro",
    "/financeiro/:path*",
    "/calendario",
    "/calendario/:path*",
    "/atletas",
    "/atletas/:path*",
    "/perfil",
    "/perfil/:path*",
    "/configuracoes",
    "/configuracoes/:path*",
    "/comunidade",
    "/comunidade/:path*",
    "/avisos",
    "/avisos/:path*",
    "/evolucao",
    "/evolucao/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/login",
    "/mfa",
    "/aguardando-aprovacao",
    "/activate-admin",
    "/forgot-password",
    "/reset-password",
    "/register/:path*",
  ],
};
