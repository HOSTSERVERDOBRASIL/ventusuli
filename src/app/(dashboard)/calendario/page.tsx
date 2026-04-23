"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { getDashboardData } from "@/services/dashboard-service";
import { DashboardCalendarEntry, DashboardCalendarEntryType } from "@/services/types";

const CALENDAR_TYPE_CONFIG: Record<
  DashboardCalendarEntryType,
  { label: string; tone: "positive" | "warning" | "info"; dayClass: string; dotClass: string }
> = {
  RACE: {
    label: "PROVA",
    tone: "positive",
    dayClass: "border border-emerald-300/50 bg-emerald-500/25 text-emerald-50",
    dotClass: "bg-emerald-300",
  },
  DEADLINE: {
    label: "PRAZO",
    tone: "warning",
    dayClass: "border border-amber-300/60 bg-amber-400/30 text-amber-50",
    dotClass: "bg-amber-300",
  },
  COMMITMENT: {
    label: "COMPROMISSO",
    tone: "info",
    dayClass: "border border-sky-300/50 bg-sky-500/20 text-sky-50",
    dotClass: "bg-sky-300",
  },
};

function calendarEntryType(entry: DashboardCalendarEntry): DashboardCalendarEntryType {
  return entry.entryType ?? "RACE";
}

export default function CalendarioPage() {
  const { accessToken, userRole } = useAuthToken();
  const [entries, setEntries] = useState<DashboardCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getDashboardData({ accessToken, userRole });
        const sorted = (result.data?.calendario ?? [])
          .slice()
          .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
        if (!cancelled) {
          setEntries(sorted);
          const upcoming =
            sorted.find((item) => new Date(item.event_date) >= new Date()) ?? sorted[0];
          if (upcoming) {
            const eventDate = new Date(upcoming.event_date);
            setCalendarMonth(startOfMonth(eventDate));
            setSelectedDay(eventDate);
            setSelectedEntryId(upcoming.id);
          }
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setError("Nao foi possivel carregar o calendario em tempo real.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userRole]);

  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }),
      }),
    [calendarMonth],
  );

  const monthEntries = useMemo(
    () => entries.filter((item) => isSameMonth(new Date(item.event_date), calendarMonth)),
    [entries, calendarMonth],
  );
  const selectedDayEntries = useMemo(
    () => entries.filter((item) => isSameDay(new Date(item.event_date), selectedDay)),
    [entries, selectedDay],
  );
  const nextEvents = useMemo(
    () => entries.filter((item) => new Date(item.event_date) >= new Date()).slice(0, 8),
    [entries],
  );
  const selectedEntry = useMemo(
    () => monthEntries.find((item) => item.id === selectedEntryId) ?? selectedDayEntries[0] ?? null,
    [monthEntries, selectedDayEntries, selectedEntryId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario"
        subtitle="Visao mensal de provas, prazos e compromissos da sua rotina."
      />

      <SectionCard
        title="Calendario mensal"
        description="Clique em um dia para ver a agenda completa"
      >
        {loading ? (
          <LoadingState lines={5} />
        ) : error ? (
          <EmptyState
            title="Calendario indisponivel"
            description={error}
            action={
              <button
                type="button"
                className="rounded-xl border border-white/20 bg-[#0F2743] px-3 py-2 text-sm text-slate-100 hover:bg-[#14375C]"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </button>
            }
          />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Sem eventos no calendario"
            description="Nenhum evento foi encontrado para este periodo."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-[#24486f] bg-[#0f233d] p-3">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((current) => startOfMonth(subMonths(current, 1)))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#2b5583] bg-[#0b1d34] text-[#c4d8f6] transition hover:bg-[#123255]"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold capitalize text-white">
                  {format(calendarMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((current) => startOfMonth(addMonths(current, 1)))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#2b5583] bg-[#0b1d34] text-[#c4d8f6] transition hover:bg-[#123255]"
                  aria-label="Proximo mes"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-[#8eb0dc]">
                {["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"].map((dayLabel) => (
                  <span key={dayLabel} className="py-1 text-[10px] tracking-[0.08em]">
                    {dayLabel}
                  </span>
                ))}

                {calendarDays.map((day) => {
                  const dayEntries = monthEntries.filter((item) =>
                    isSameDay(new Date(item.event_date), day),
                  );
                  const primaryType = dayEntries[0] ? calendarEntryType(dayEntries[0]) : null;
                  const isSelected = isSameDay(day, selectedDay);
                  const toneClass = primaryType
                    ? CALENDAR_TYPE_CONFIG[primaryType].dayClass
                    : "bg-[#0a1a2f] text-[#aac5e9]";

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day);
                        if (dayEntries[0]) setSelectedEntryId(dayEntries[0].id);
                      }}
                      className={`relative min-h-11 rounded-lg px-1 py-1.5 text-xs transition ${isSameMonth(day, calendarMonth) ? toneClass : "bg-[#091628] text-[#4a6689]"} ${isSelected ? "ring-2 ring-[#58a6ff]" : "hover:brightness-110"}`}
                    >
                      <span className="font-semibold">{format(day, "d")}</span>
                      {dayEntries.length ? (
                        <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1">
                          {dayEntries.slice(0, 3).map((entry) => (
                            <span
                              key={entry.id}
                              className={`h-1.5 w-1.5 rounded-full ${CALENDAR_TYPE_CONFIG[calendarEntryType(entry)].dotClass}`}
                            />
                          ))}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-[#24486f] bg-[#0f233d] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8eb0dc]">
                  Proximos eventos
                </p>
                <ul className="mt-2 max-h-[25rem] space-y-2 overflow-y-auto pr-1">
                  {nextEvents.map((entry) => {
                    const entryType = calendarEntryType(entry);
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-[#1f4064] bg-[#0b1d34] px-2.5 py-2 text-left transition hover:border-[#2f6497] hover:bg-[#102640]"
                          onClick={() => {
                            const eventDate = new Date(entry.event_date);
                            setCalendarMonth(startOfMonth(eventDate));
                            setSelectedDay(eventDate);
                            setSelectedEntryId(entry.id);
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#9fc1ea]">
                              {format(new Date(entry.event_date), "dd/MM · HH:mm")}
                            </span>
                            <StatusBadge
                              label={CALENDAR_TYPE_CONFIG[entryType].label}
                              tone={CALENDAR_TYPE_CONFIG[entryType].tone}
                              className="text-[10px]"
                            />
                          </div>
                          <p className="mt-1 text-sm font-semibold text-white">{entry.name}</p>
                          <p className="text-xs text-[#8eb0dc]">
                            {entry.subtitle ??
                              `${entry.city ?? ""} ${entry.state ? `/ ${entry.state}` : ""}`}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#24486f] bg-[#0f233d] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8eb0dc]">
                  Agenda de {format(selectedDay, "dd/MM", { locale: ptBR })}
                </p>
                {selectedDayEntries.length ? (
                  <div className="mt-2 space-y-2">
                    {selectedDayEntries.map((entry) => {
                      const entryType = calendarEntryType(entry);
                      const isActive = selectedEntry?.id === entry.id;
                      return (
                        <Link
                          key={entry.id}
                          href={entry.linkHref ?? "/provas"}
                          className={`block rounded-lg border px-2.5 py-2 transition ${isActive ? "border-[#58a6ff] bg-[#14335a]" : "border-[#1f4064] bg-[#0b1d34] hover:border-[#2f6497] hover:bg-[#102640]"}`}
                          onMouseEnter={() => setSelectedEntryId(entry.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">{entry.name}</p>
                            <StatusBadge
                              label={CALENDAR_TYPE_CONFIG[entryType].label}
                              tone={CALENDAR_TYPE_CONFIG[entryType].tone}
                              className="text-[10px]"
                            />
                          </div>
                          <p className="mt-1 text-xs text-[#8eb0dc]">
                            {entry.subtitle ??
                              `${entry.city ?? ""} ${entry.state ? `/ ${entry.state}` : ""}`}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#8eb0dc]">Sem eventos para o dia selecionado.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
