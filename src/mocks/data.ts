import { OrgPlan, UserRole } from "@/types";

export type DemoEventStatus = "PUBLISHED";
export type DemoRegistrationStatus = "CONFIRMED" | "PENDING_PAYMENT" | "INTERESTED" | "CANCELLED";
export type DemoPaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CANCELLED";

export interface DemoOrganization {
  id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  logo_url: string | null;
}

export interface DemoUser {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface DemoEventDistance {
  id: string;
  label: string;
  distance_km: number;
  price_cents: number;
}

export interface DemoEvent {
  id: string;
  organization_id: string;
  name: string;
  city: string;
  state: string;
  event_date: string;
  status: DemoEventStatus;
  distances: DemoEventDistance[];
}

export interface DemoRegistration {
  id: string;
  organization_id: string;
  user_id: string;
  event_id: string;
  distance_id: string;
  status: DemoRegistrationStatus;
  payment_status: DemoPaymentStatus | null;
  registered_at: string;
}

export interface DemoPayment {
  id: string;
  organization_id: string;
  user_id: string;
  event_id: string;
  registration_id: string | null;
  amount_cents: number;
  status: DemoPaymentStatus;
  created_at: string;
}

export interface DemoAthleteMetrics {
  provasConfirmadas: number;
  kmNoAno: number;
  provasConcluidas: number;
  rankingNoGrupo: number | null;
  consistencia: number;
}

export interface DemoAdminMetrics {
  atletasAtivos: number;
  receitaMes: number;
  inscricoesPendentes: number;
  provasPublicadas: number;
}

export interface DemoAthleteData {
  organization: DemoOrganization;
  user: DemoUser;
  events: DemoEvent[];
  registrations: DemoRegistration[];
  payments: DemoPayment[];
  metrics: DemoAthleteMetrics;
}

export interface DemoAdminData {
  organization: DemoOrganization;
  users: DemoUser[];
  events: DemoEvent[];
  payments: DemoPayment[];
  metrics: DemoAdminMetrics;
}

export const DEMO_ORGANIZATION: DemoOrganization = {
  id: "org-demo",
  name: "Assessoria Ventu Suli",
  slug: "ventu-suli",
  plan: OrgPlan.PRO,
  logo_url: null,
};

export const DEMO_USERS: DemoUser[] = [
  {
    id: "user-admin",
    organization_id: "org-demo",
    name: "Carlos Menezes",
    email: "admin@ventu.demo",
    role: UserRole.ADMIN,
  },
  {
    id: "user-atleta",
    organization_id: "org-demo",
    name: "Maria Oliveira",
    email: "atleta@ventu.demo",
    role: UserRole.ATHLETE,
  },
];

export const DEMO_EVENTS: DemoEvent[] = [
  {
    id: "evt-ponte-2026",
    organization_id: "org-demo",
    name: "Corrida da Ponte Hercílio Luz",
    city: "Florianópolis",
    state: "SC",
    event_date: "2026-08-16T06:30:00.000Z",
    status: "PUBLISHED",
    distances: [
      { id: "dist-ponte-5k", label: "5K", distance_km: 5, price_cents: 9900 },
      { id: "dist-ponte-10k", label: "10K", distance_km: 10, price_cents: 13900 },
      { id: "dist-ponte-21k", label: "21K", distance_km: 21.097, price_cents: 19900 },
    ],
  },
  {
    id: "evt-serra-gaucha-2026",
    organization_id: "org-demo",
    name: "Meia Maratona Serra Gaúcha",
    city: "Caxias",
    state: "RS",
    event_date: "2026-09-20T06:00:00.000Z",
    status: "PUBLISHED",
    distances: [
      { id: "dist-serra-7k", label: "7K", distance_km: 7, price_cents: 11900 },
      { id: "dist-serra-14k", label: "14K", distance_km: 14, price_cents: 16900 },
      { id: "dist-serra-21k", label: "21K", distance_km: 21.097, price_cents: 22900 },
    ],
  },
  {
    id: "evt-maratona-ventu-2026",
    organization_id: "org-demo",
    name: "Maratona Ventu Suli",
    city: "Curitiba",
    state: "PR",
    event_date: "2026-10-18T05:30:00.000Z",
    status: "PUBLISHED",
    distances: [
      { id: "dist-maratona-10k", label: "10K", distance_km: 10, price_cents: 12900 },
      { id: "dist-maratona-21k", label: "21K", distance_km: 21.097, price_cents: 18900 },
      { id: "dist-maratona-42k", label: "42K", distance_km: 42.195, price_cents: 25900 },
    ],
  },
  {
    id: "evt-praias-sul-2026",
    organization_id: "org-demo",
    name: "Circuito Praias do Sul",
    city: "Florianópolis",
    state: "SC",
    event_date: "2026-11-22T06:15:00.000Z",
    status: "PUBLISHED",
    distances: [
      { id: "dist-praias-5k", label: "5K", distance_km: 5, price_cents: 10900 },
      { id: "dist-praias-12k", label: "12K", distance_km: 12, price_cents: 14900 },
    ],
  },
];

export const DEMO_REGISTRATIONS: DemoRegistration[] = [
  {
    id: "reg-maria-ponte",
    organization_id: "org-demo",
    user_id: "user-atleta",
    event_id: "evt-ponte-2026",
    distance_id: "dist-ponte-10k",
    status: "CONFIRMED",
    payment_status: "PAID",
    registered_at: "2026-07-28T12:10:00.000Z",
  },
  {
    id: "reg-maria-maratona",
    organization_id: "org-demo",
    user_id: "user-atleta",
    event_id: "evt-maratona-ventu-2026",
    distance_id: "dist-maratona-21k",
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    registered_at: "2026-09-25T14:30:00.000Z",
  },
  {
    id: "reg-maria-praias",
    organization_id: "org-demo",
    user_id: "user-atleta",
    event_id: "evt-praias-sul-2026",
    distance_id: "dist-praias-5k",
    status: "INTERESTED",
    payment_status: null,
    registered_at: "2026-10-30T10:45:00.000Z",
  },
];

export const DEMO_PAYMENTS: DemoPayment[] = [
  {
    id: "pay-001",
    organization_id: "org-demo",
    user_id: "user-atleta",
    event_id: "evt-ponte-2026",
    registration_id: "reg-maria-ponte",
    amount_cents: 13900,
    status: "PAID",
    created_at: "2026-07-28T12:15:00.000Z",
  },
  {
    id: "pay-002",
    organization_id: "org-demo",
    user_id: "user-admin",
    event_id: "evt-serra-gaucha-2026",
    registration_id: null,
    amount_cents: 22900,
    status: "PAID",
    created_at: "2026-08-05T09:20:00.000Z",
  },
  {
    id: "pay-003",
    organization_id: "org-demo",
    user_id: "user-admin",
    event_id: "evt-maratona-ventu-2026",
    registration_id: null,
    amount_cents: 25900,
    status: "PAID",
    created_at: "2026-08-15T08:05:00.000Z",
  },
  {
    id: "pay-004",
    organization_id: "org-demo",
    user_id: "user-atleta",
    event_id: "evt-maratona-ventu-2026",
    registration_id: "reg-maria-maratona",
    amount_cents: 18900,
    status: "PENDING",
    created_at: "2026-09-25T14:35:00.000Z",
  },
  {
    id: "pay-005",
    organization_id: "org-demo",
    user_id: "user-admin",
    event_id: "evt-praias-sul-2026",
    registration_id: null,
    amount_cents: 10900,
    status: "PENDING",
    created_at: "2026-10-02T16:20:00.000Z",
  },
  {
    id: "pay-006",
    organization_id: "org-demo",
    user_id: "user-admin",
    event_id: "evt-ponte-2026",
    registration_id: null,
    amount_cents: 9900,
    status: "EXPIRED",
    created_at: "2026-07-10T11:00:00.000Z",
  },
  {
    id: "pay-007",
    organization_id: "org-demo",
    user_id: "user-admin",
    event_id: "evt-serra-gaucha-2026",
    registration_id: null,
    amount_cents: 16900,
    status: "REFUNDED",
    created_at: "2026-09-12T17:10:00.000Z",
  },
  {
    id: "pay-008",
    organization_id: "org-demo",
    user_id: "user-admin",
    event_id: "evt-praias-sul-2026",
    registration_id: null,
    amount_cents: 14900,
    status: "CANCELLED",
    created_at: "2026-10-28T13:45:00.000Z",
  },
];

export const DEMO_ATHLETE_METRICS: DemoAthleteMetrics = {
  provasConfirmadas: 3,
  kmNoAno: 847,
  provasConcluidas: 8,
  rankingNoGrupo: 12,
  consistencia: 72,
};

export const DEMO_ADMIN_METRICS: DemoAdminMetrics = {
  atletasAtivos: 47,
  receitaMes: 382300,
  inscricoesPendentes: 8,
  provasPublicadas: 4,
};

export function getAthleteData(userId: string): DemoAthleteData | null {
  const user = DEMO_USERS.find((item) => item.id === userId);
  if (!user || user.organization_id !== DEMO_ORGANIZATION.id) return null;

  const registrations = DEMO_REGISTRATIONS.filter((item) => item.user_id === userId);
  const payments = DEMO_PAYMENTS.filter((item) => item.user_id === userId);

  return {
    organization: DEMO_ORGANIZATION,
    user,
    events: DEMO_EVENTS.filter((item) => item.organization_id === DEMO_ORGANIZATION.id),
    registrations,
    payments,
    metrics: DEMO_ATHLETE_METRICS,
  };
}

export function getAdminData(orgId: string): DemoAdminData | null {
  if (orgId !== DEMO_ORGANIZATION.id) return null;

  return {
    organization: DEMO_ORGANIZATION,
    users: DEMO_USERS.filter((item) => item.organization_id === orgId),
    events: DEMO_EVENTS.filter((item) => item.organization_id === orgId),
    payments: DEMO_PAYMENTS.filter((item) => item.organization_id === orgId),
    metrics: DEMO_ADMIN_METRICS,
  };
}
