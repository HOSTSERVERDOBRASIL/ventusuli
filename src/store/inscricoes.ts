"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getInitialRegistrations } from "@/services/registrations-service";

export type RegistrationStatus = "CONFIRMED" | "PENDING_PAYMENT" | "INTERESTED" | "CANCELLED";
export type PaymentStatus = "PAID" | "PENDING" | "EXPIRED" | "REFUNDED" | "CANCELLED";

export interface Inscricao {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  eventAddress?: string | null;
  eventLatitude?: number | null;
  eventLongitude?: number | null;
  checkInRadiusM?: number;
  proximityRadiusM?: number;
  distanceLabel: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amountCents: number;
  attendanceStatus?: "PENDING" | "PRESENT" | "ABSENT";
  checkInAt?: string | null;
  checkInDistanceM?: number | null;
  checkOutAt?: string | null;
  checkOutDistanceM?: number | null;
}

interface InscricoesState {
  inscricoes: Inscricao[];
  hasHydrated: boolean;
  setInscricoes: (inscricoes: Inscricao[]) => void;
  addInscricao: (inscricao: Inscricao) => void;
  upsertInscricao: (inscricao: Inscricao) => void;
  updateInscricao: (id: string, updater: (current: Inscricao) => Inscricao) => void;
  hydrate: () => void;
}

function getInitialDemoInscricoes(): Inscricao[] {
  return getInitialRegistrations();
}

export const useInscricoesStore = create<InscricoesState>()(
  persist(
    (set) => ({
      inscricoes: getInitialDemoInscricoes(),
      hasHydrated: false,
      setInscricoes: (inscricoes) => set({ inscricoes }),
      addInscricao: (inscricao) =>
        set((state) => ({
          inscricoes: [inscricao, ...state.inscricoes],
        })),
      upsertInscricao: (inscricao) =>
        set((state) => {
          const index = state.inscricoes.findIndex((item) => item.id === inscricao.id);
          if (index < 0) {
            return { inscricoes: [inscricao, ...state.inscricoes] };
          }
          const next = [...state.inscricoes];
          next[index] = inscricao;
          return { inscricoes: next };
        }),
      updateInscricao: (id, updater) =>
        set((state) => ({
          inscricoes: state.inscricoes.map((item) => (item.id === id ? updater(item) : item)),
        })),
      hydrate: () => {
        useInscricoesStore.persist.rehydrate();
        const legacy = localStorage.getItem("ventu_demo_registrations");
        if (!legacy) return;

        let parsed: Partial<Inscricao>[] = [];
        try {
          parsed = JSON.parse(legacy) as Partial<Inscricao>[];
        } catch {
          return;
        }
        const normalized: Inscricao[] = parsed.filter((item): item is Inscricao => {
          return Boolean(
            item &&
            item.id &&
            item.eventId &&
            item.eventName &&
            item.eventDate &&
            item.distanceLabel &&
            item.status &&
            item.paymentStatus &&
            typeof item.amountCents === "number",
          );
        });

        if (normalized.length === 0) return;

        set((state) => ({
          inscricoes: [...state.inscricoes, ...normalized].reduce<Inscricao[]>((acc, row) => {
            if (acc.some((item) => item.id === row.id)) return acc;
            return [...acc, row];
          }, []),
        }));
      },
    }),
    {
      name: "ventu-demo-inscricoes",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ inscricoes: state.inscricoes }),
      onRehydrateStorage: () => (state) => {
        if (!state?.hasHydrated) {
          useInscricoesStore.setState({ hasHydrated: true });
        }
      },
    },
  ),
);
