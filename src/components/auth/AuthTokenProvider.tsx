"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { OrgPlan, OrgStatus, UserRole } from "@/types";

interface SessionUser {
  id: string;
  role: UserRole;
  organization_id: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  profile?: {
    hasCpf: boolean;
    athleteStatus?: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED" | null;
  } | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
    plan: OrgPlan;
    status?: OrgStatus;
    setup_completed_at?: string | null;
    logo_url?: string | null;
    settings?: Record<string, unknown> | null;
  } | null;
}

interface AuthTokenContextValue {
  accessToken: string | null;
  userRole: UserRole | null;
  currentUser: SessionUser | null;
  organization: SessionUser["organization"] | null;
  /** null = não determinado ainda; true/false = resultado da sessão */
  hasCpf: boolean | null;
  hydrated: boolean;
  setAccessToken: (token: string | null) => void;
  setUserRole: (role: UserRole | null) => void;
  setAuthSession: (session: { token: string | null; role: UserRole | null }) => void;
  clearAccessToken: () => void;
  refreshSession: () => Promise<boolean>;
}

const AuthTokenContext = createContext<AuthTokenContextValue | undefined>(undefined);

// Rotas que ATHLETEs sem CPF podem acessar sem serem redirecionados.
const ONBOARDING_EXEMPT_PATHS = ["/onboarding", "/perfil", "/login", "/register", "/api/"];

const ORGANIZATION_SETUP_EXEMPT_PATHS = [
  "/onboarding/assessoria",
  "/perfil",
  "/configuracoes",
  "/configuracoes/conta",
  "/admin/configuracoes",
  "/login",
  "/register",
  "/api/",
];

function isOnboardingExempt(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p),
  );
}

function isOrganizationSetupExempt(pathname: string): boolean {
  return ORGANIZATION_SETUP_EXEMPT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p),
  );
}

function shouldRedirectToOrganizationSetup(user: SessionUser): boolean {
  if (user.role !== UserRole.ADMIN) return false;
  const status = user.organization?.status;
  const setupCompletedAt = user.organization?.setup_completed_at ?? null;
  return status === OrgStatus.PENDING_SETUP || !setupCompletedAt;
}

async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/session", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) return null;
  const text = await response.text();
  if (!text.trim()) return null;

  const payload = JSON.parse(text) as { user?: SessionUser };
  return payload.user ?? null;
}

async function refreshAccessToken(): Promise<boolean> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
  });
  return response.ok;
}

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [userRole, setUserRoleState] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [organization, setOrganization] = useState<SessionUser["organization"] | null>(null);
  const [hasCpf, setHasCpf] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refreshSession = async (): Promise<boolean> => {
    const user = await fetchSession();
    if (user) {
      setUserRoleState(user.role);
      setCurrentUser(user);
      setOrganization(user.organization ?? null);
      setHasCpf(user.profile?.hasCpf ?? true);
      return true;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) return false;

    const refreshedUser = await fetchSession();
    if (!refreshedUser) return false;
    setUserRoleState(refreshedUser.role);
    setCurrentUser(refreshedUser);
    setOrganization(refreshedUser.organization ?? null);
    setHasCpf(refreshedUser.profile?.hasCpf ?? true);
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const user = await fetchSession();

        if (user) {
          if (!cancelled) {
            setUserRoleState(user.role);
            setCurrentUser(user);
            setOrganization(user.organization ?? null);
            setHasCpf(user.profile?.hasCpf ?? true);
          }

          // Guard: ATHLETE sem CPF → redirecionar para onboarding se necessário.
          if (
            !cancelled &&
            user.role === UserRole.ATHLETE &&
            user.profile?.hasCpf === false &&
            !isOnboardingExempt(window.location.pathname)
          ) {
            window.location.assign("/onboarding/atleta");
            return;
          }

          if (
            !cancelled &&
            shouldRedirectToOrganizationSetup(user) &&
            !isOrganizationSetupExempt(window.location.pathname)
          ) {
            window.location.assign("/onboarding/assessoria");
            return;
          }

          return;
        }

        // Primeira tentativa falhou — tentar renovar refresh token.
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          if (!cancelled) {
            setAccessTokenState(null);
            setUserRoleState(null);
            setCurrentUser(null);
            setOrganization(null);
            setHasCpf(null);
            const isAuthPath =
              window.location.pathname === "/login" ||
              window.location.pathname.startsWith("/register");
            if (!isAuthPath) {
              window.location.assign("/login?reason=expired");
            }
          }
          return;
        }

        const refreshedUser = await fetchSession();
        if (!refreshedUser) {
          if (!cancelled) {
            const isAuthPath =
              window.location.pathname === "/login" ||
              window.location.pathname.startsWith("/register");
            if (!isAuthPath) {
              window.location.assign("/login?reason=expired");
            }
          }
          return;
        }

        if (!cancelled) {
          setUserRoleState(refreshedUser.role);
          setCurrentUser(refreshedUser);
          setOrganization(refreshedUser.organization ?? null);
          setHasCpf(refreshedUser.profile?.hasCpf ?? true);
        }

        if (
          !cancelled &&
          refreshedUser.role === UserRole.ATHLETE &&
          refreshedUser.profile?.hasCpf === false &&
          !isOnboardingExempt(window.location.pathname)
        ) {
          window.location.assign("/onboarding/atleta");
          return;
        }

        if (
          !cancelled &&
          shouldRedirectToOrganizationSetup(refreshedUser) &&
          !isOrganizationSetupExempt(window.location.pathname)
        ) {
          window.location.assign("/onboarding/assessoria");
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthTokenContextValue>(
    () => ({
      accessToken,
      userRole,
      currentUser,
      organization,
      hasCpf,
      hydrated,
      setAccessToken: (token) => setAccessTokenState(token),
      setUserRole: (role) => setUserRoleState(role),
      setAuthSession: ({ token, role }) => {
        setAccessTokenState(token);
        setUserRoleState(role);
      },
      clearAccessToken: () => {
        setAccessTokenState(null);
        setUserRoleState(null);
        setCurrentUser(null);
        setOrganization(null);
        setHasCpf(null);
      },
      refreshSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, currentUser, hasCpf, hydrated, organization, userRole],
  );

  return <AuthTokenContext.Provider value={value}>{children}</AuthTokenContext.Provider>;
}

export function useAuthToken() {
  const context = useContext(AuthTokenContext);
  if (!context) {
    throw new Error("useAuthToken must be used inside AuthTokenProvider.");
  }
  return context;
}
