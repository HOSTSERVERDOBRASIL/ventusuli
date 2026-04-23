import { buildAuthHeaders } from "@/services/runtime";
import { Payment, PaymentListFilters, PaymentSummary } from "@/services/types";

export interface PaymentRow extends Payment {
  athleteName: string;
  athleteEmail: string;
  eventName: string;
  distanceLabel: string;
  createdAt: string;
  registrationStatus: string;
  dueState: "OVERDUE" | "DUE_TODAY" | "DUE_SOON" | "NO_DUE_DATE" | "CLOSED";
  reconciliationStatus: "OPEN" | "SETTLED" | "CLOSED";
  reconciliationNote: string;
  daysUntilDue: number | null;
  updatedAt: string;
}

export interface PaymentFilterOptions {
  athletes: string[];
  events: string[];
}

export interface PaymentQueueSummary {
  totalOpenCount: number;
  totalOpenAmount: number;
  overdueCount: number;
  overdueAmount: number;
  dueTodayCount: number;
  dueSoonCount: number;
  noDueDateCount: number;
  recentSettlementsCount: number;
}

export interface PaymentListResult {
  rows: PaymentRow[];
  summary: PaymentSummary;
  queue: PaymentQueueSummary;
  filters: PaymentFilterOptions;
}

interface PaymentMutationResponse {
  data: PaymentRow;
}

export interface PaymentHistoryEvent {
  id: string;
  type: "CREATED" | "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "REOPENED";
  label: string;
  detail: string;
  occurredAt: string;
  actor: string | null;
}

export interface PaymentDetail extends PaymentRow {
  history: PaymentHistoryEvent[];
}

interface PaymentDetailResponse {
  data: PaymentDetail;
}

export async function getPayments(filters: PaymentListFilters): Promise<PaymentListResult> {
  const query = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  if (filters.status && filters.status !== "ALL") query.set("status", filters.status);
  if (filters.athlete?.trim()) query.set("athlete", filters.athlete.trim());
  if (filters.event?.trim()) query.set("event", filters.event.trim());
  if (filters.due && filters.due !== "ALL") query.set("due", filters.due);
  if (filters.sortBy) query.set("sortBy", filters.sortBy);
  if (filters.sortDir) query.set("sortDir", filters.sortDir);

  const response = await fetch(`/api/payments?${query.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(filters.accessToken),
  });

  if (!response.ok) {
    throw new Error("payments_unavailable");
  }

  return (await response.json()) as PaymentListResult;
}

async function patchPayment(
  paymentId: string,
  action: "MARK_PAID" | "CANCEL" | "MARK_EXPIRED" | "REOPEN_PENDING",
  accessToken?: string | null,
): Promise<PaymentRow> {
  const response = await fetch(`/api/payments/${paymentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errorPayload.error?.message ?? "Nao foi possivel atualizar cobranca.");
  }

  const payload = (await response.json()) as PaymentMutationResponse;
  return payload.data;
}

export async function simulatePayment(paymentId: string, accessToken?: string | null): Promise<PaymentRow> {
  return patchPayment(paymentId, "MARK_PAID", accessToken);
}

export async function cancelPayment(paymentId: string, accessToken?: string | null): Promise<PaymentRow> {
  return patchPayment(paymentId, "CANCEL", accessToken);
}

export async function markPaymentExpired(paymentId: string, accessToken?: string | null): Promise<PaymentRow> {
  return patchPayment(paymentId, "MARK_EXPIRED", accessToken);
}

export async function reopenPayment(paymentId: string, accessToken?: string | null): Promise<PaymentRow> {
  return patchPayment(paymentId, "REOPEN_PENDING", accessToken);
}

export async function getPaymentDetail(paymentId: string, accessToken?: string | null): Promise<PaymentDetail> {
  const response = await fetch(`/api/payments/${paymentId}`, {
    cache: "no-store",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const errorPayload = (await response.json()) as { error?: { message?: string } };
    throw new Error(errorPayload.error?.message ?? "Nao foi possivel carregar detalhes da cobranca.");
  }

  const payload = (await response.json()) as PaymentDetailResponse;
  return payload.data;
}
