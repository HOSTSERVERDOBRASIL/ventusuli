import type { ReactNode } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { type EventStatus, type EventView } from "@/components/events/types";
import { StatusBadge } from "@/components/system/status-badge";
import type { RaceRecommendationTone } from "@/lib/race-recommendations";
import type { RegistrationStatus } from "@/services/types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Tone = "positive" | "warning" | "info" | "danger" | "neutral";

function statusTone(status: EventStatus): Tone {
  if (status === "PUBLISHED") return "positive";
  if (status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function statusLabel(status: EventStatus): string {
  if (status === "PUBLISHED") return "Publicado";
  if (status === "DRAFT") return "Rascunho";
  if (status === "CANCELLED") return "Cancelado";
  return "Finalizado";
}

function registrationTone(status: RegistrationStatus): Tone {
  if (status === "CONFIRMED") return "positive";
  if (status === "PENDING_PAYMENT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "info";
}

function registrationLabel(status: RegistrationStatus): string {
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "PENDING_PAYMENT") return "Em aberto";
  if (status === "CANCELLED") return "Cancelado";
  return "Interesse";
}

function buildDistanceLabel(event: EventView): string {
  const labels = event.distances.map((distance) => distance.label).filter(Boolean);
  if (labels.length === 0) return "Distancia a definir";
  if (labels.length <= 3) return labels.join(" / ");
  return `${labels.slice(0, 3).join(" / ")} +${labels.length - 3}`;
}

function minPriceLabel(event: EventView): string {
  const minPrice = event.distances.reduce(
    (acc, distance) => Math.min(acc, distance.price_cents),
    Number.POSITIVE_INFINITY,
  );
  return Number.isFinite(minPrice) ? currency.format(minPrice / 100) : "Sob consulta";
}

function defaultCtaLabel(
  mode: "admin" | "athlete",
  event: EventView,
  registration?: { status: RegistrationStatus } | null,
): string {
  if (mode === "admin") {
    if (event.status === "DRAFT") return "Editar rascunho";
    if (event.status === "PUBLISHED") return "Gerenciar prova";
    return "Ver prova";
  }

  if (registration?.status === "CONFIRMED") return "Ver detalhes";
  if (registration?.status === "PENDING_PAYMENT") return "Concluir inscricao";
  if (registration?.status === "INTERESTED") return "Tenho interesse";
  return "Quero participar";
}

export function EventCard({
  event,
  mode = "athlete",
  ctaLabel,
  ctaDisabled,
  recommendation,
  registration,
  actions,
}: {
  event: EventView;
  mode?: "admin" | "athlete";
  ctaLabel?: string;
  ctaDisabled?: boolean;
  recommendation?: {
    label: string;
    tone: RaceRecommendationTone;
  } | null;
  registration?: {
    status: RegistrationStatus;
    distanceLabel?: string | null;
  } | null;
  actions?: ReactNode;
}) {
  const distanceLabel = buildDistanceLabel(event);
  const heroLabel = format(new Date(event.event_date), "dd MMM yyyy", { locale: ptBR })
    .replace(".", "")
    .toUpperCase();
  const primaryBadge = registration
    ? { label: registrationLabel(registration.status), tone: registrationTone(registration.status) }
    : { label: statusLabel(event.status), tone: statusTone(event.status) };
  const selectedDistance = registration?.distanceLabel ?? null;
  const registrationsCount = event.registrations_count ?? 0;
  const buttonLabel = ctaLabel ?? defaultCtaLabel(mode, event, registration);

  return (
    <article className="group flex h-full min-h-[248px] flex-col overflow-hidden rounded-lg border border-[#15395d] bg-[#071b31] shadow-[0_16px_34px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:border-sky-400/45 hover:shadow-[0_18px_46px_rgba(0,0,0,0.36)]">
      <div className="relative h-[104px] overflow-hidden bg-[#0a2743]">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={`Imagem da prova ${event.name}`}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            unoptimized
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#113f67,#0b2540_52%,#061527)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#03101f]/15 via-transparent to-[#071b31]" />

        <div className="absolute left-2 top-2">
          <StatusBadge label={primaryBadge.label} tone={primaryBadge.tone} />
        </div>
        <div className="absolute right-2 top-2 max-w-[56%] truncate rounded border border-white/15 bg-[#061426]/75 px-2 py-1 text-[10px] font-bold text-slate-100 backdrop-blur">
          {distanceLabel}
        </div>
        <div className="absolute bottom-2 left-2 rounded bg-black/45 px-2 py-1 text-[10px] font-bold text-amber-200">
          {heroLabel}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[38px] text-sm font-bold leading-[1.35] text-white">
          {event.name}
        </h3>
        <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-slate-300">
          <MapPin className="h-3 w-3 shrink-0 text-sky-300" />
          <span className="truncate">
            {event.city}/{event.state}
          </span>
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5">
            <p className="text-[9px] font-semibold uppercase text-slate-500">A partir de</p>
            <p className="mt-0.5 truncate font-bold text-slate-100">{minPriceLabel(event)}</p>
          </div>
          <div className="rounded border border-white/10 bg-white/[0.035] px-2 py-1.5">
            <p className="text-[9px] font-semibold uppercase text-slate-500">
              {mode === "admin" ? "Inscritos" : "Sua prova"}
            </p>
            <p className="mt-0.5 truncate font-bold text-slate-100">
              {mode === "admin"
                ? registrationsCount
                : selectedDistance ?? (registration ? "A definir" : "Escolher")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-sky-300" />
            {event.registration_deadline
              ? `Inscricoes ate ${format(new Date(event.registration_deadline), "dd/MM", {
                  locale: ptBR,
                })}`
              : "Inscricoes abertas"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 text-sky-300" />
            {registrationsCount}
          </span>
        </div>

        {recommendation ? (
          <div className="mt-2">
            <StatusBadge label={recommendation.label} tone={recommendation.tone} />
          </div>
        ) : null}

        <div className="mt-auto pt-3">
          {actions ? (
            actions
          ) : (
            <span
              aria-disabled={ctaDisabled}
              className="inline-flex h-8 w-full items-center justify-center rounded-md bg-[#0868bd] px-3 text-xs font-bold text-white transition group-hover:bg-[#0a78d6] aria-disabled:pointer-events-none aria-disabled:opacity-45"
            >
              {buttonLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
