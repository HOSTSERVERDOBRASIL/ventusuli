import { UserRole } from "@/types";

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "FINISHED";
export type RegistrationStatus = "INTERESTED" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CANCELLED";
export type DashboardCalendarEntryType = "RACE" | "DEADLINE" | "COMMITMENT";
export type CommunityReactionType = "LIKE" | "FIRE" | "APPLAUSE";
export type NoticeAudience = "ALL" | "ATHLETES" | "COACHES" | "ADMINS";
export type NoticeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type NoticeChannel = "IN_APP" | "TELEGRAM";
export type NoticeDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export interface DashboardCalendarEntry {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  event_date: string;
  status: string;
  entryType?: DashboardCalendarEntryType;
  subtitle?: string | null;
  linkHref?: string;
}

export interface CommunityComment {
  id: string;
  author: string;
  avatarInitials: string;
  role: "ATHLETE" | "COACH" | "ORGANIZER";
  timeAgo: string;
  text: string;
}

export interface CommunityReaction {
  type: CommunityReactionType;
  count: number;
  activeByDefault?: boolean;
}

export interface CommunityPostImage {
  title: string;
  subtitle?: string;
  tone: "ocean" | "sunset" | "forest" | "violet";
}

export interface CommunityPost {
  id: string;
  tab: string;
  author: string;
  avatarInitials: string;
  role: "ATHLETE" | "COACH" | "ORGANIZER";
  timeAgo: string;
  content: string;
  image?: CommunityPostImage;
  comments: CommunityComment[];
  reactions: CommunityReaction[];
  ctaLabel?: string;
}

export interface CommunityFeedData {
  tabs: string[];
  posts: CommunityPost[];
  source?: "LIVE" | "EMPTY";
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  cursor?: {
    next: string | null;
    hasMore: boolean;
  };
}

export interface NoticeDelivery {
  id: string;
  channel: NoticeChannel;
  status: NoticeDeliveryStatus;
  external_id: string | null;
  error_message: string | null;
  attempt_count?: number;
  last_attempt_at?: string | null;
  sent_at: string | null;
}

export interface NoticeItem {
  id: string;
  organization_id: string | null;
  created_by: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  status: NoticeStatus;
  pinned: boolean;
  publish_at: string | null;
  telegram_enabled: boolean;
  created_at: string;
  updated_at: string;
  is_global?: boolean;
  creator_name?: string | null;
  deliveries?: NoticeDelivery[];
}

export interface ServiceEventDistance {
  id: string;
  label: string;
  distance_km: number;
  price_cents: number;
  max_slots: number | null;
  registered_count: number;
}

export interface ServiceEvent {
  id: string;
  name: string;
  city: string;
  state: string;
  event_date: string;
  registration_deadline?: string | null;
  description?: string | null;
  image_url?: string | null;
  status: EventStatus;
  distances: ServiceEventDistance[];
  registrations_count: number;
}

export interface EventUpsertPayload {
  name: string;
  city: string;
  state: string;
  event_date: string;
  registration_deadline?: string;
  description?: string;
  image_url?: string;
  distances: Array<{
    label: string;
    distance_km: number;
    price_cents: number;
    max_slots?: number;
  }>;
}

export interface DashboardData {
  metrics: {
    provasConfirmadas: number;
    kmNoAno: number | null;
    provasConcluidas: number;
    rankingNoGrupo: number | null;
    consistencia: number | null;
  };
  proximasProvas: Array<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    event_date: string;
    status: string;
    image_url?: string | null;
    distances: ServiceEventDistance[];
    minhaInscricao: {
      status: RegistrationStatus;
      distance_id: string;
    } | null;
  }>;
  minhasInscricoes: Array<{
    id: string;
    status: RegistrationStatus;
    registered_at: string;
    event: { name: string };
    distance: { label: string };
    payment: { status: PaymentStatus } | null;
  }>;
  financeiro: {
    totalGastoAno: number;
    pendente: number;
    proximaCobranca: {
      id: string;
      amount_cents: number;
      expires_at: string | null;
    } | null;
  };
  calendario: DashboardCalendarEntry[];
  experience?: {
    greeting: {
      headline: string;
      subtitle: string;
    };
    financeBreakdown: Array<{
      name: string;
      value: number;
      color: string;
    }>;
    evolutionSeries: Array<{
      month: string;
      current: number;
      previous: number;
    }>;
    highlights: Array<{
      id: "completed" | "distance" | "consistency" | "podium" | "best5k" | "best21k" | "best42k";
      label: string;
      value: string;
    }>;
    distanceDistribution: Array<{
      name: string;
      value: number;
      color: string;
    }>;
    achievements: Array<{
      id: string;
      label: string;
      tone: "info" | "warning" | "success";
    }>;
    sportsMetrics: Array<{
      id: string;
      label: string;
      value: string;
      delta: string;
      trend: "up" | "down" | "stable";
    }>;
    personalRecords: Array<{
      id: string;
      label: string;
      value: string;
      event: string;
      achievedAt: string;
    }>;
    groupRanking: {
      updatedAt: string;
      totalAthletes: number;
      user: {
        name: string;
        position: number;
        points: number;
        change: number;
      };
      leaderboard: Array<{
        id: string;
        name: string;
        points: number;
        position: number;
      }>;
    };
    communityPreview: CommunityFeedData;
  };
  experienceSource?: "LIVE" | "EMPTY";
  dataWarnings?: string[];
}

export interface AthleteEmergencyContact {
  name: string;
  phone: string;
  relation?: string;
}

export interface AthleteIdentity {
  name: string;
  email: string;
  avatarUrl?: string | null;
  memberNumber?: string | null;
  memberSince?: string | null;
  accountStatus?: "ACTIVE" | "PENDING_INVITE" | "PENDING_APPROVAL" | "SUSPENDED" | null;
  cpf: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  birthDate: string | null;
  gender: string | null;
  athleteStatus?: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED" | null;
  signupSource?: "SLUG" | "INVITE" | "ADMIN" | null;
  onboardingCompletedAt?: string | null;
  emergencyContact: AthleteEmergencyContact | null;
}

export interface FinancialRow {
  payment_id: string;
  athlete_name: string;
  athlete_email: string;
  event_name: string;
  distance_label: string;
  amount_cents: number;
  payment_status: PaymentStatus;
  created_at: string;
}

export interface FinancialReport {
  data: FinancialRow[];
  totals: {
    totalCobrado: number;
    totalPago: number;
    totalPendente: number;
  };
}

export type PaymentDemoStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
export type PaymentDueFilter = "ALL" | "OVERDUE" | "TODAY" | "NEXT_7_DAYS" | "NO_DUE_DATE";
export type PaymentSortBy = "createdAt" | "expiresAt" | "amount";
export type PaymentSortDir = "asc" | "desc";

export interface Payment {
  id: string;
  registrationId: string;
  amountCents: number;
  status: PaymentDemoStatus;
  txId: string;
  qrCodeUrl?: string;
  pixCopyPaste?: string;
  expiresAt?: string;
  paidAt?: string;
}

export interface PaymentListFilters {
  startDate: string;
  endDate: string;
  status?: "ALL" | PaymentDemoStatus;
  athlete?: string;
  event?: string;
  due?: PaymentDueFilter;
  sortBy?: PaymentSortBy;
  sortDir?: PaymentSortDir;
  accessToken?: string | null;
}

export interface PaymentSummary {
  totalCobrado: number;
  totalPago: number;
  totalPendente: number;
  totalExpirado: number;
  totalCancelado: number;
}

export interface AdminOverviewData {
  report: FinancialReport;
  events: Array<{
    id: string;
    name: string;
    status: string;
    event_date: string;
    city: string;
    state: string;
    image_url?: string | null;
    registrations_count: number;
  }>;
  metrics: {
    atletasAtivos: number;
    receitaMes: number;
    inscricoesPendentes: number;
    provasPublicadas: number;
  };
}

export interface AdminCollectiveGroup {
  id: string;
  name: string;
  company: string;
  contactName: string;
  athletesCount: number;
  status: "READY" | "PENDING_APPROVAL";
}

export interface CollectiveRegistrationSimulationResult {
  groupId: string;
  groupName: string;
  eventId: string;
  eventName: string;
  registrationsCreated: number;
  pendingAmountCents: number;
}

export interface DashboardLoadInput {
  accessToken?: string | null;
  userRole?: UserRole | null;
}

export type AthleteCrmStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "BLOCKED";
export type AthleteFinancialSituation = "EM_DIA" | "PENDENTE" | "SEM_HISTORICO";

export interface AthleteListRow {
  id: string;
  memberNumber: string | null;
  memberSequence: number | null;
  memberSince: string | null;
  name: string;
  email: string;
  status: AthleteCrmStatus;
  approvalPending: boolean;
  signupSource?: "SLUG" | "INVITE" | "ADMIN" | null;
  invitedByName?: string | null;
  invitedByMemberNumber?: string | null;
  invitedByEmail?: string | null;
  registrationsCount: number;
  nextEventName: string | null;
  nextEventDate: string | null;
  pendingAmountCents: number;
  paidAmountCents: number;
  financialSituation: AthleteFinancialSituation;
  lastPaymentAt: string | null;
  city: string | null;
  state: string | null;
  internalNote: string | null;
}

export interface AthletesListSummary {
  totalAthletes: number;
  active: number;
  pendingApproval: number;
  rejected: number;
  blocked: number;
  totalPendingCents: number;
  totalPaidCents: number;
  withMemberNumber?: number;
  missingMemberNumber?: number;
  invitedSignups?: number;
  slugSignups?: number;
  adminSignups?: number;
}

export interface AthletesListResponse {
  data: AthleteListRow[];
  summary: AthletesListSummary;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminAthletePolicy {
  slug: string;
  allowAthleteSelfSignup: boolean;
  requireAthleteApproval: boolean;
}

export interface AdminAthletesListResponse extends AthletesListResponse {
  organizationPolicy: AdminAthletePolicy;
}

export interface AdminAthleteInvite {
  id: string;
  token: string;
  label: string | null;
  active: boolean;
  expiresAt: string | null;
  expired: boolean;
  status: "AVAILABLE" | "EXPIRED" | "EXHAUSTED" | "INACTIVE";
  maxUses: number | null;
  usedCount: number;
  availableUses: number | null;
  reusable: boolean;
  inviteKind: string;
  invitedEmail: string | null;
  invitedName: string | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  acceptedUser: {
    id: string;
    name: string | null;
    email: string | null;
    memberNumber: string | null;
  } | null;
  acceptedAt: string | null;
  createdAt: string;
  signupUrl: string;
}

export interface AdminAthleteInviteSummary {
  total: number;
  available: number;
  used: number;
  expired: number;
  athleteReferral: number;
  adminGeneral: number;
}

export interface CreateAthleteByAdminResponse {
  data: {
    id: string;
    name: string;
    email: string;
    role: string;
    organizationId: string;
    mode: "QUICK" | "FULL";
    temporaryPassword: string;
  };
}

export interface AthleteDetailRegistration {
  id: string;
  status: RegistrationStatus;
  registeredAt: string;
  event: {
    id: string;
    name: string;
    eventDate: string;
    city: string | null;
    state: string | null;
    status: string;
  };
  distance: {
    id: string;
    label: string;
    distanceKm: number;
    priceCents: number;
  };
  payment: {
    id: string;
    status: string;
    amountCents: number;
    createdAt: string;
    paidAt: string | null;
  } | null;
}

export interface AthleteDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  profile: {
    cpf: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    internalNote: string | null;
    athleteStatus: AthleteCrmStatus;
    approvalPending: boolean;
    memberNumber: string | null;
    memberSince: string | null;
    signupSource: "SLUG" | "INVITE" | "ADMIN" | null;
  };
  summary: {
    registrationsCount: number;
    paidAmountCents: number;
    pendingAmountCents: number;
    nextEventName: string | null;
    nextEventDate: string | null;
  };
  registrations: AthleteDetailRegistration[];
}
