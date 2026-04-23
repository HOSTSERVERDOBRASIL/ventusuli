"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildAuthHeaders } from "@/services/runtime";

export type PaymentPollStatus = "PENDING" | "PAID" | "EXPIRED" | "REFUNDED" | "CANCELLED";

interface UsePaymentStatusOptions {
  registrationId: string;
  enabled?: boolean;
  intervalMs?: number;
  accessToken?: string | null;
}

export function usePaymentStatus({
  registrationId,
  enabled = true,
  intervalMs = 5000,
  accessToken,
}: UsePaymentStatusOptions) {
  const [status, setStatus] = useState<PaymentPollStatus>("PENDING");
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();
    setStatus("PENDING");
    setError(null);
    setPixCode(null);
    setExpiresAt(null);
    setAmountCents(null);
    setTxId(null);
  }, [registrationId]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const poll = async () => {
      setIsPolling(true);

      try {
        const response = await fetch(`/api/registrations/${registrationId}/payment`, {
          method: "GET",
          cache: "no-store",
          headers: buildAuthHeaders(accessToken),
        });

        if (!response.ok) {
          throw new Error("endpoint_unavailable");
        }

        const payload = (await response.json()) as {
          data?: {
            status?: PaymentPollStatus;
            pixCode?: string | null;
            expiresAt?: string | null;
            amountCents?: number | null;
            txId?: string | null;
          };
        };
        const nextStatus = payload.data?.status;
        if (nextStatus) {
          if (!cancelled) {
            setStatus(nextStatus);
            setError(null);
            setPixCode(payload.data?.pixCode ?? null);
            setExpiresAt(payload.data?.expiresAt ?? null);
            setAmountCents(payload.data?.amountCents ?? null);
            setTxId(payload.data?.txId ?? null);
          }
          return;
        }

        throw new Error("invalid_response");
      } catch {
        if (!cancelled) {
          setError("Não foi possível verificar o pagamento em tempo real.");
        }
      } finally {
        if (!cancelled) {
          setIsPolling(false);
        }
      }
    };

    poll();
    const timer = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [accessToken, enabled, intervalMs, registrationId]);

  const isPaid = useMemo(() => status === "PAID", [status]);

  return {
    status,
    isPaid,
    isPolling,
    error,
    setStatus,
    pixCode,
    expiresAt,
    amountCents,
    txId,
  };
}

