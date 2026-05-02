import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { type EventView } from "@/components/events/types";
import { StatusBadge } from "@/components/system/status-badge";
import type { RaceRecommendationTone } from "@/lib/race-recommendations";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function EventCard({
  event,
  mode = "athlete",
  ctaLabel,
  ctaDisabled,
  recommendation,
}: {
  event: EventView;
  mode?: "admin" | "athlete";
  ctaLabel?: string;
  ctaDisabled?: boolean;
  recommendation?: {
    label: string;
    tone: RaceRecommendationTone;
  } | null;
}) {
  const defaultLabel = mode === "admin" ? "Gerenciar" : "Ver detalhes";
  const minPrice = event.distances.reduce(
    (acc, d) => Math.min(acc, d.price_cents),
    Number.POSITIVE_INFINITY,
  );
  const displayPrice = Number.isFinite(minPrice) ? currency.format(minPrice / 100) : "—";
  const totalSlots = event.distances.reduce((acc, d) => acc + (d.max_slots ?? 0), 0);
  const totalRegistered = event.distances.reduce((acc, d) => acc + (d.registered_count ?? 0), 0);
  const hasLimitedSlots = event.distances.some((d) => Boolean(d.max_slots));
  const occupancy =
    hasLimitedSlots && totalSlots > 0 ? Math.round((totalRegistered / totalSlots) * 100) : null;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#112240] shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
      {/* Header image area — fixed height */}
      <div className="relative h-[168px] w-full flex-shrink-0 overflow-hidden">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={`Imagem da prova ${event.name}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#0c2d5c_0%,#1a4b8a_50%,#0d2d4d_100%)]" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,144,255,0.18),transparent_55%)]" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#112240] to-transparent" />

        {/* Status badge */}
        <div className="absolute left-3 top-3">
          <EventStatusBadge status={event.status} />
        </div>
        {recommendation ? (
          <div className="absolute right-3 top-3">
            <StatusBadge label={recommendation.label} tone={recommendation.tone} />
          </div>
        ) : null}

        {/* Title + city pinned to bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-white">
            {event.name}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-white/50">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {event.city}/{event.state}
          </p>
        </div>
      </div>

      {/* Body — grows to fill remaining space */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Date */}
        <p className="flex items-center gap-1.5 text-[12px] text-white/55">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-[#1E90FF]" />
          {format(new Date(event.event_date), "dd 'de' MMMM yyyy", { locale: ptBR })}
        </p>

        {/* KPI row — fixed height, always 3 cols */}
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { label: "A partir de", value: displayPrice },
              { label: "Distâncias", value: String(event.distances.length) },
              { label: "Ocupação", value: occupancy !== null ? `${occupancy}%` : "—" },
            ] as const
          ).map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-2 text-center"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/35">
                {label}
              </p>
              <p className="mt-1 text-[13px] font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Distances list — scrollable, max 4 visible */}
        <ul className="max-h-[88px] space-y-1.5 overflow-y-auto pr-0.5">
          {event.distances.map((d) => (
            <li key={d.id ?? d.label} className="flex items-center justify-between text-[12px]">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-white/70">
                {d.label}
              </span>
              <span className="font-semibold text-white">
                {currency.format(d.price_cents / 100)}
              </span>
            </li>
          ))}
        </ul>

        {/* Inscriptions count */}
        <p className="flex items-center gap-1.5 text-[11px] text-white/35">
          <Users className="h-3 w-3" />
          Inscrições: {event.registrations_count ?? 0}
        </p>

        {/* CTA — always at the bottom */}
        <div className="mt-auto pt-1">
          <button
            type="button"
            disabled={ctaDisabled}
            className="h-9 w-full rounded-lg bg-[#1E90FF] text-[13px] font-semibold text-white transition hover:brightness-110 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ctaLabel ?? defaultLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
