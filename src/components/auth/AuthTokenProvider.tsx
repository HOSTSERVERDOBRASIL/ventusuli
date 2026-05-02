"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { OrgPlan, OrgStatus, UserRole } from "@/types";
import { getDefaultProfileRole } from "@/lib/profile-config";

interface SessionUser {
  id: string;
  role: UserRole;
  roles?: UserRole[];
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
  userRoles: UserRole[];
  activeRole: UserRole | null;
  currentUser: SessionUser | null;
  organization: SessionUser["organization"] | null;
  /** null = não determinado ainda; true/false = resultado da sessão */
  hasCpf: boolean | null;
  hydrated: boolean;
  setAccessToken: (token: string | null) => void;
  setUserRole: (role: UserRole | null) => void;
  setActiveRole: (role: UserRole | null) => void;
  setAuthSession: (session: {
    token: string | null;
    role: UserRole | null;
    roles?: UserRole[];
    user?: Partial<SessionUser> | null;
    profile?: SessionUser["profile"];
    organization?: SessionUser["organization"] | null;
  }) => void;
  clearAccessToken: () => void;
  refreshSession: () => Promise<boolean>;
}

const AuthTokenContext = createContext<AuthTokenContextValue | undefined>(undefined);

const ACTIVE_ROLE_STORAGE_KEY = "ventu-suli-active-role";

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
  if (!getUserRoles(user).includes(UserRole.ADMIN)) return false;
  const status = user.organization?.status;
  const setupCompletedAt = user.organization?.setup_completed_at ?? null;
  return status === OrgStatus.PENDING_SETUP || !setupCompletedAt;
}

function getUserRoles(user: SessionUser): UserRole[] {
  return user.roles?.length ? user.roles : [user.role];
}

function isAthleteLikeRole(role: UserRole | null | undefined): boolean {
  return role === UserRole.ATHLETE || role === UserRole.PREMIUM_ATHLETE;
}

function parseStoredRole(value: string | null): UserRole | null {
  if (!value) return null;
  const normalized = value.toUpperCase() as UserRole;
  return Object.values(UserRole).includes(normalized) ? normalized : null;
}

function readStoredActiveRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  return parseStoredRole(window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY));
}

function persistActiveRole(role: UserRole | null): void {
  if (typeof window === "undefined") return;
  if (role) {
    window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
  } else {
    window.localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
  }
}

function resolveActiveRole(roles: readonly UserRole[], fallback?: UserRole | null): UserRole | null {
  const stored = readStoredActiveRole();
  if (stored && roles.includes(stored)) return stored;
  if (fallback && roles.includes(fallback)) return fallback;
  return getDefaultProfileRole(roles);
}

async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/session", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { user?: SessionUser };
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
  const [userRoles, setUserRolesState] = useState<UserRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [organization, setOrganization] = useState<SessionUser["organization"] | null>(null);
  const [hasCpf, setHasCpf] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const applyUserSession = (user: SessionUser) => {
    const roles = getUserRoles(user);
    const nextActiveRole = resolveActiveRole(roles, user.role);
    setUserRoleState(user.role);
    setUserRolesState(roles);
    setActiveRoleState(nextActiveRole);
    persistActiveRole(nextActiveRole);
    setCurrentUser(user);
    setOrganization(user.organization ?? null);
    setHasCpf(user.profile?.hasCpf ?? true);
  };

  const refreshSession = async (): Promise<boolean> => {
    const user = await fetchSession();
    if (user) {
      applyUserSession(user);
      return true;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) return false;

    const refreshedUser = await fetchSession();
    if (!refreshedUser) return false;
    applyUserSession(refreshedUser);
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const user = await fetchSession();

        if (user) {
          if (!cancelled) {
            applyUserSession(user);
          }

          // Guard: ATHLETE sem CPF -> redirecionar para onboarding se necessário.
          if (
            !cancelled &&
            isAthleteLikeRole(user.role) &&
            getUserRoles(user).some(isAthleteLikeRole) &&
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

        // Primeira tentativa falhou, tentar renovar refresh token.
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          if (!cancelled) {
            setAccessTokenState(null);
            setUserRoleState(null);
            setUserRolesState([]);
            setActiveRoleState(null);
            persistActiveRole(null);
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
          applyUserSession(refreshedUser);
        }

        if (
          !cancelled &&
          isAthleteLikeRole(refreshedUser.role) &&
          getUserRoles(refreshedUser).some(isAthleteLikeRole) &&
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
      userRoles,
      activeRole,
      currentUser,
      organization,
      hasCpf,
      hydrated,
      setAccessToken: (token) => setAccessTokenState(token),
      setUserRole: (role) => {
        setUserRoleState(role);
        const nextRoles = role ? [role] : [];
        setUserRolesState(nextRoles);
        const nextActiveRole = resolveActiveRole(nextRoles, role);
        setActiveRoleState(nextActiveRole);
        persistActiveRole(nextActiveRole);
      },
      setActiveRole: (role) => {
        if (!role || !userRoles.includes(role)) {
          const nextActiveRole = resolveActiveRole(userRoles, userRole);
          setActiveRoleState(nextActiveRole);
          persistActiveRole(nextActiveRole);
          return;
        }
        setActiveRoleState(role);
        persistActiveRole(role);
      },
      setAuthSession: ({ token, role, roles, user, profile, organization: nextOrganization }) => {
        setAccessTokenState(token);
        setUserRoleState(role);
        const nextRoles = roles?.length ? roles : role ? [role] : [];
        const nextActiveRole = resolveActiveRole(nextRoles, role);
        setUserRolesState(nextRoles);
        setActiveRoleState(nextActiveRole);
        persistActiveRole(nextActiveRole);
        if (user && role) {
          setCurrentUser({
            id: user.id ?? "",
            role,
            roles: nextRoles,
            organization_id: user.organization_id ?? "",
            name: user.name ?? null,
            email: user.email ?? null,
            avatar_url: user.avatar_url ?? null,
            profile: profile ?? user.profile ?? null,
            organization: nextOrganization ?? user.organization ?? null,
          });
          setOrganization(nextOrganization ?? user.organization ?? null);
          setHasCpf((profile ?? user.profile)?.hasCpf ?? true);
        }
      },
      clearAccessToken: () => {
        setAccessTokenState(null);
        setUserRoleState(null);
        setUserRolesState([]);
        setActiveRoleState(null);
        persistActiveRole(null);
        setCurrentUser(null);
        setOrganization(null);
        setHasCpf(null);
      },
      refreshSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, activeRole, currentUser, hasCpf, hydrated, organization, userRole, userRoles],
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
