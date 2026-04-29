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

export interface FinancialEntryRow {
  id: string;
  subjectUserId: string | null;
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  category: string;
  description: string | null;
  occurredAt: string;
  dueAt: string | null;
  settledAt: string | null;
  status: "OPEN" | "PAID" | "CANCELLED";
  entryKind: "CASH" | "RECEIVABLE" | "PAYABLE";
  accountCode: string | null;
  costCenter: string | null;
  counterparty: string | null;
  paymentMethod: string | null;
  documentUrl: string | null;
  referenceCode: string | null;
  createdAt: string;
  createdByName: string;
  createdByEmail: string;
}

export interface FinancialEntriesResult {
  data: FinancialEntryRow[];
  summary: {
    incomeCents: number;
    expenseCents: number;
    balanceCents: number;
    openReceivableCents: number;
    openPayableCents: number;
  };
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

export interface RecurringChargeProcessResult {
  data: {
    monthKey: string;
    generatedCount: number;
    skippedCount: number;
    totalAmountCents: number;
    generatedIds: string[];
    organizationName: string;
  };
}

export async function getFinancialEntries(input: {
  startDate: string;
  endDate: string;
  status?: string;
  type?: string;
  entryKind?: string;
  accessToken?: string | null;
}): Promise<FinancialEntriesResult> {
  const query = new URLSearchParams({
    startDate: input.startDate,
    endDate: input.endDate,
  });
  if (input.status && input.status !== "ALL") query.set("status", input.status);
  if (input.type && input.type !== "ALL") query.set("type", input.type);
  if (input.entryKind && input.entryKind !== "ALL") query.set("entryKind", input.entryKind);

  const response = await fetch(`/api/finance/entries?${query.toString()}`, {
    cache: "no-store",
    headers: buildAuthHeaders(input.accessToken),
  });

  if (!response.ok) throw new Error("Nao foi possivel carregar lancamentos manuais.");
  return (await response.json()) as FinancialEntriesResult;
}

export async function createFinancialEntry(
  input: {
    type: "INCOME" | "EXPENSE";
    amountCents: number;
    category: string;
    description?: string;
    occurredAt: string;
    dueAt?: string | null;
    settledAt?: string | null;
    status?: "OPEN" | "PAID" | "CANCELLED";
    entryKind?: "CASH" | "RECEIVABLE" | "PAYABLE";
    accountCode?: string | null;
    costCenter?: string | null;
    counterparty?: string | null;
    paymentMethod?: string | null;
    documentUrl?: string | null;
  },
  accessToken?: string | null,
): Promise<FinancialEntryRow> {
  const response = await fetch("/api/finance/entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Nao foi possivel criar lancamento.");
  }

  const payload = (await response.json()) as { data: FinancialEntryRow };
  return payload.data;
}

export async function patchFinancialEntry(
  entryId: string,
  action: "MARK_PAID" | "REOPEN" | "CANCEL",
  accessToken?: string | null,
): Promise<FinancialEntryRow> {
  const response = await fetch(`/api/finance/entries/${entryId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Nao foi possivel atualizar lancamento.");
  }

  const payload = (await response.json()) as { data: FinancialEntryRow };
  return payload.data;
}

export async function processRecurringCharges(
  input: { monthKey?: string; accessToken?: string | null } = {},
): Promise<RecurringChargeProcessResult["data"]> {
  const response = await fetch("/api/finance/recurring/process", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(input.accessToken),
    },
    body: JSON.stringify({ monthKey: input.monthKey }),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Nao foi possivel processar mensalidades.");
  }

  const payload = (await response.json()) as RecurringChargeProcessResult;
  return payload.data;
}
