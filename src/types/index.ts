// â”€â”€â”€ Enums â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  FINANCE = "FINANCE",
  COACH = "COACH",
  ATHLETE = "ATHLETE",
  ORGANIZER = "ORGANIZER",
  MANAGER = "MANAGER",
  PREMIUM_ATHLETE = "PREMIUM_ATHLETE",
  SUPPORT = "SUPPORT",
  MODERATOR = "MODERATOR",
  PARTNER = "PARTNER",
}

export enum OrgPlan {
  FREE = "FREE",
  STARTER = "STARTER",
  PRO = "PRO",
  ENTERPRISE = "ENTERPRISE",
}

export enum OrgStatus {
  PENDING_SETUP = "PENDING_SETUP",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  TRIAL = "TRIAL",
  CANCELLED = "CANCELLED",
}

export enum AccountStatus {
  ACTIVE = "ACTIVE",
  PENDING_INVITE = "PENDING_INVITE",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  SUSPENDED = "SUSPENDED",
}

// â”€â”€â”€ Domain Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: OrgPlan;
  status: OrgStatus;
  setup_completed_at: Date | null;
  plan_expires_at: Date | null;
  settings: Record<string, unknown> | null;
  created_at: Date;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  name: string;
  avatar_url: string | null;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

export interface AthleteProfile {
  id: string;
  user_id: string;
  organization_id: string;
  cpf: string | null;
  birth_date: Date | null;
  gender: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  shirt_size: string | null;
  emergency_contact: Record<string, unknown> | null;
  created_at: Date;
}

// â”€â”€â”€ API Response Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// â”€â”€â”€ Auth Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface JwtPayload {
  sub: string;            // user_id
  org: string;            // organization_id
  role: UserRole;
  roles?: UserRole[];
  email: string;
  iat?: number;
  exp?: number;
}

// â”€â”€â”€ NextAuth Extensions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
    organization_id: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      organization_id: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    organization_id: string;
  }
}
