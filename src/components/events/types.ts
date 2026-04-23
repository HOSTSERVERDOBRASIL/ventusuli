export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "FINISHED";

export interface EventDistanceView {
  id?: string;
  label: string;
  distance_km: number;
  price_cents: number;
  max_slots?: number | null;
  registered_count?: number;
}

export interface EventView {
  id: string;
  name: string;
  city: string;
  state: string;
  event_date: string;
  registration_deadline?: string | null;
  description?: string | null;
  image_url?: string | null;
  status: EventStatus;
  distances: EventDistanceView[];
  registrations_count?: number;
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CANCELLED: "Cancelado",
  FINISHED: "Finalizado",
};

export const EVENT_STATUS_CLASS: Record<EventStatus, string> = {
  DRAFT: "bg-slate-500/20 text-slate-200 border-slate-400/40",
  PUBLISHED: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  CANCELLED: "bg-red-500/20 text-red-200 border-red-400/40",
  FINISHED: "bg-blue-500/20 text-blue-200 border-blue-400/40",
};
