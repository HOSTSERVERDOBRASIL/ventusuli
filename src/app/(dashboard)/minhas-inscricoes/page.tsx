"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CircleCheck,
  Clock3,
  Copy,
  Download,
  Handshake,
  MapPin,
  Navigation,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { type DataTableColumn, DataTable } from "@/components/system/data-table";
import { EmptyState } from "@/components/system/empty-state";
import { Modal } from "@/components/system/modal";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import {
  cancelRegistration,
  checkInRegistration,
  confirmRegistrationPayment,
  getRegistrations,
  markRegistrationInterested,
} from "@/services/registrations-service";
import { distanceInMeters } from "@/lib/geo-distance";
import { downloadTextCardAsPng } from "@/lib/share-card";
import { type Inscricao, useInscricoesStore } from "@/store/inscricoes";
import { UserRole } from "@/types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<Inscricao["status"], string> = {
  CONFIRMED: "Confirmada",
  PENDING_PAYMENT: "Aguardando pagamento",
  INTERESTED: "Interesse",
  CANCELLED: "Cancelada",
};

const PAYMENT_LABEL: Record<Inscricao["paymentStatus"], string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
};

const STATUS_TONE: Record<Inscricao["status"], "positive" | "warning" | "info" | "danger"> = {
  CONFIRMED: "positive",
  PENDING_PAYMENT: "warning",
  INTERESTED: "info",
  CANCELLED: "danger",
};

const PAYMENT_TONE: Record<
  Inscricao["paymentStatus"],
  "positive" | "warning" | "danger" | "neutral"
> = {
  PAID: "positive",
  PENDING: "warning",
  EXPIRED: "danger",
  REFUNDED: "neutral",
  CANCELLED: "danger",
};

async function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocalizacao indisponivel neste dispositivo.");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error("Nao foi possivel acessar sua localizacao.")),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 8_000 },
    );
  });
}

export default function MinhasInscricoesPage() {
  const { accessToken, userRoles } = useAuthToken();
  const canPay =
    userRoles.includes(UserRole.ATHLETE) || userRoles.includes(UserRole.PREMIUM_ATHLETE);
  const inscricoes = useInscricoesStore((state) => state.inscricoes);
  const setInscricoes = useInscricoesStore((state) => state.setInscricoes);
  const hydrate = useInscricoesStore((state) => state.hydrate);
  const upsertInscricao = useInscricoesStore((state) => state.upsertInscricao);
  const updateInscricao = useInscricoesStore((state) => state.updateInscricao);
  const [cancelTarget, setCancelTarget] = useState<Inscricao | null>(null);
  const [attendanceBusyId, setAttendanceBusyId] = useState<string | null>(null);
  const [distanceByRegistration, setDistanceByRegistration] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await getRegistrations(accessToken);
        if (!cancelled) {
          setInscricoes(rows);
        }
      } catch {
        if (!cancelled) {
          setError("Nao foi possivel carregar inscricoes em tempo real.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, setInscricoes, reloadKey]);

  const sortedRows = useMemo(
    () =>
      [...inscricoes].sort(
        (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
      ),
    [inscricoes],
  );

  const nextRace = useMemo(() => {
    const now = Date.now();
    return [...inscricoes]
      .filter((item) => item.status !== "CANCELLED")
      .filter((item) => new Date(item.eventDate).getTime() >= now - 86_400_000)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
  }, [inscricoes]);

  function buildRaceShareLines(row: Inscricao) {
    return [
      `${row.eventName} - ${row.distanceLabel}`,
      `Data: ${format(new Date(row.eventDate), "dd/MM/yyyy", { locale: ptBR })}`,
      `Inscricao: ${STATUS_LABEL[row.status]}`,
      `Pagamento: ${PAYMENT_LABEL[row.paymentStatus]}`,
      `Valor: ${currency.format(row.amountCents / 100)}`,
    ];
  }

  function getEventPoint(row: Inscricao) {
    if (typeof row.eventLatitude !== "number" || typeof row.eventLongitude !== "number") {
      return null;
    }
    return { latitude: row.eventLatitude, longitude: row.eventLongitude };
  }

  async function checkCurrentDistance(row: Inscricao) {
    const eventPoint = getEventPoint(row);
    if (!eventPoint) {
      toast.error("Ponto exato da prova ainda nao foi configurado.");
      return null;
    }

    const position = await getCurrentPosition();
    const distance = distanceInMeters(eventPoint, position);
    setDistanceByRegistration((current) => ({ ...current, [row.id]: distance }));
    return { position, distance };
  }

  async function verifyRaceLocation(row: Inscricao) {
    try {
      const result = await checkCurrentDistance(row);
      if (!result) return;

      const checkInRadius = row.checkInRadiusM ?? 100;
      const proximityRadius = row.proximityRadiusM ?? 200;
      if (result.distance <= checkInRadius) {
        toast.success(`Check-in liberado: voce esta a ${result.distance}m.`);
      } else if (result.distance <= proximityRadius) {
        toast.message(`Voce esta proximo: ${result.distance}m do ponto da prova.`);
      } else {
        toast.error(`Voce esta a ${result.distance}m. Aproxime-se do ponto da prova.`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel verificar localizacao.",
      );
    }
  }

  async function handleRaceAttendance(row: Inscricao, action: "CHECK_IN" | "CHECK_OUT") {
    setAttendanceBusyId(row.id);
    try {
      const result = await checkCurrentDistance(row);
      if (!result) return;

      const updated = await checkInRegistration(
        row.id,
        {
          action,
          latitude: result.position.latitude,
          longitude: result.position.longitude,
        },
        accessToken,
      );

      updateInscricao(row.id, (current) => ({
        ...current,
        attendanceStatus: updated.attendanceStatus,
        checkInAt: updated.checkInAt,
        checkInDistanceM: action === "CHECK_IN" ? updated.distanceMeters : current.checkInDistanceM,
        checkOutAt: updated.checkOutAt,
        checkOutDistanceM:
          action === "CHECK_OUT" ? updated.distanceMeters : current.checkOutDistanceM,
      }));

      toast.success(action === "CHECK_IN" ? "Check-in confirmado." : "Check-out confirmado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel registrar presenca.");
    } finally {
      setAttendanceBusyId(null);
    }
  }

  async function copyRaceCard(row: Inscricao) {
    const text = ["Minha proxima largada", ...buildRaceShareLines(row), "Ventu Suli"].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumo da prova copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o resumo.");
    }
  }

  function downloadRaceCard(row: Inscricao) {
    const safeName = row.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "prova";
    downloadTextCardAsPng({
      title: row.eventName,
      subtitle: `${row.distanceLabel} | ${format(new Date(row.eventDate), "dd/MM/yyyy", {
        locale: ptBR,
      })}`,
      lines: buildRaceShareLines(row),
      filename: `ventu-suli-${safeName}.png`,
    });
    toast.success("Card PNG gerado.");
  }

  function renderAttendancePanel(row: Inscricao) {
    const currentDistance = distanceByRegistration[row.id];
    const hasPoint = Boolean(getEventPoint(row));
    const checkInRadius = row.checkInRadiusM ?? 100;
    const proximityRadius = row.proximityRadiusM ?? 200;
    const isBusy = attendanceBusyId === row.id;
    const distanceTone =
      currentDistance == null
        ? "neutral"
        : currentDistance <= checkInRadius
          ? "positive"
          : currentDistance <= proximityRadius
            ? "warning"
            : "danger";
    const distanceLabel =
      currentDistance == null
        ? "local nao verificado"
        : currentDistance <= checkInRadius
          ? `${currentDistance}m | check-in liberado`
          : currentDistance <= proximityRadius
            ? `${currentDistance}m | proximo`
            : `${currentDistance}m | fora do raio`;

    return (
      <div className="rounded-xl border border-sky-300/20 bg-[#0f233d] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <MapPin className="h-4 w-4 text-sky-200" />
              Presenca por GPS
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {hasPoint
                ? row.eventAddress || "Ponto exato configurado"
                : "Ponto exato pendente no cadastro da prova"}
            </p>
          </div>
          <StatusBadge label={distanceLabel} tone={distanceTone} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ActionButton
            size="sm"
            intent="secondary"
            disabled={!hasPoint || isBusy}
            onClick={() => void verifyRaceLocation(row)}
          >
            <Navigation className="mr-2 h-4 w-4" />
            Ver local
          </ActionButton>
          <ActionButton
            size="sm"
            disabled={!hasPoint || isBusy || row.status !== "CONFIRMED" || Boolean(row.checkInAt)}
            onClick={() => void handleRaceAttendance(row, "CHECK_IN")}
          >
            <CircleCheck className="mr-2 h-4 w-4" />
            {row.checkInAt ? "Check-in ok" : "Check-in"}
          </ActionButton>
          <ActionButton
            size="sm"
            intent="secondary"
            disabled={!hasPoint || isBusy || !row.checkInAt || Boolean(row.checkOutAt)}
            onClick={() => void handleRaceAttendance(row, "CHECK_OUT")}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {row.checkOutAt ? "Check-out ok" : "Check-out"}
          </ActionButton>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="text-xs text-slate-400">
            Check-in: {row.checkInAt ? "registrado" : `${checkInRadius}m`}
          </p>
          <p className="text-xs text-slate-400">
            Proximidade: {row.checkOutAt ? "check-out registrado" : `${proximityRadius}m`}
          </p>
        </div>
      </div>
    );
  }

  const btnBase =
    "inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition whitespace-nowrap";
  const btnDefault = `${btnBase} border border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.09] hover:text-white`;
  const btnPrimary = `${btnBase} bg-[#1E90FF] text-white hover:brightness-110`;
  const btnDanger = `${btnBase} border border-[#FF4444]/30 bg-[#FF4444]/10 text-[#FF4444] hover:bg-[#FF4444]/20`;

  const columns: DataTableColumn<Inscricao>[] = [
    {
      key: "event",
      header: "Prova",
      className: "min-w-[180px]",
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.eventName}</p>
          <p className="text-[11px] text-white/40">{row.distanceLabel}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Data",
      className: "min-w-[90px]",
      cell: (row) => (
        <span className="text-[12px]">
          {format(new Date(row.eventDate), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-[130px]",
      cell: (row) => (
        <StatusBadge tone={STATUS_TONE[row.status]} label={STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: "payment",
      header: "Pagamento",
      className: "min-w-[140px]",
      cell: (row) => (
        <div className="space-y-1">
          <StatusBadge
            tone={PAYMENT_TONE[row.paymentStatus]}
            label={PAYMENT_LABEL[row.paymentStatus]}
          />
          <p className="text-[11px] text-white/40">{currency.format(row.amountCents / 100)}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "min-w-[220px]",
      cell: (row) => {
        if (row.status === "CONFIRMED") {
          return (
            <div className="flex flex-nowrap gap-1.5">
              <span
                className={`${btnBase} border border-[#00C853]/30 bg-[#00C853]/10 text-[#00C853]`}
              >
                <CircleCheck className="h-3.5 w-3.5" /> Confirmada
              </span>
              <button type="button" className={btnDanger} onClick={() => setCancelTarget(row)}>
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          );
        }
        if (row.status === "PENDING_PAYMENT") {
          return (
            <div className="flex flex-nowrap gap-1.5">
              <button
                type="button"
                className={btnPrimary}
                onClick={async () => {
                  try {
                    const updated = await confirmRegistrationPayment(row, accessToken);
                    upsertInscricao(updated);
                    toast.success("Pagamento confirmado.");
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível confirmar o pagamento.",
                    );
                  }
                }}
              >
                <Clock3 className="h-3.5 w-3.5" /> Confirmar
              </button>
              {canPay && (
                <Link
                  href={`/provas/${row.eventId}/inscricao?distancia=${encodeURIComponent(row.distanceLabel)}`}
                  className={btnDefault}
                >
                  Pagar
                </Link>
              )}
              <button type="button" className={btnDanger} onClick={() => setCancelTarget(row)}>
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          );
        }
        if (row.status === "INTERESTED") {
          return (
            <div className="flex flex-nowrap gap-1.5">
              <Link
                href={`/provas/${row.eventId}/inscricao?distancia=${encodeURIComponent(row.distanceLabel)}`}
                className={btnPrimary}
              >
                <Handshake className="h-3.5 w-3.5" /> Participar
              </Link>
              <button type="button" className={btnDanger} onClick={() => setCancelTarget(row)}>
                <XCircle className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          );
        }
        return (
          <button
            type="button"
            className={btnDefault}
            onClick={async () => {
              try {
                const updated = await markRegistrationInterested(row, accessToken);
                upsertInscricao(updated);
                toast.success("Inscrição marcada como interesse.");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Não foi possível alterar o status.",
                );
              }
            }}
          >
            <Handshake className="h-3.5 w-3.5" /> Interesse
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas inscrições"
        subtitle="Simule e acompanhe o ciclo completo: interesse, pagamento, confirmação e cancelamento."
        actions={
          <ActionButton asChild>
            <Link href="/provas">Participar de uma prova</Link>
          </ActionButton>
        }
      />

      {nextRace ? (
        <SectionCard
          title="Proxima largada"
          description="Resumo pronto para conferir logistica e compartilhar"
        >
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-xl border border-[#F5A623]/25 bg-[linear-gradient(135deg,#17385e,#0f233d)] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-amber-200">
                Ventu Suli Run Card
              </p>
              <h2 className="mt-3 text-2xl font-bold text-white">{nextRace.eventName}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge
                  tone={STATUS_TONE[nextRace.status]}
                  label={STATUS_LABEL[nextRace.status]}
                />
                <StatusBadge
                  tone={PAYMENT_TONE[nextRace.paymentStatus]}
                  label={PAYMENT_LABEL[nextRace.paymentStatus]}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/40">Distancia</p>
                  <p className="mt-1 text-lg font-bold text-white">{nextRace.distanceLabel}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/40">Data</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {format(new Date(nextRace.eventDate), "dd/MM", { locale: ptBR })}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs uppercase tracking-wide text-white/40">Valor</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {currency.format(nextRace.amountCents / 100)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton asChild size="sm">
                  <Link href={`/provas/${nextRace.eventId}`}>Ver prova</Link>
                </ActionButton>
                <ActionButton size="sm" onClick={() => downloadRaceCard(nextRace)}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PNG
                </ActionButton>
                <ActionButton
                  size="sm"
                  intent="secondary"
                  onClick={() => void copyRaceCard(nextRace)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar texto
                </ActionButton>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="sm:col-span-2 lg:col-span-1">{renderAttendancePanel(nextRace)}</div>
              {[
                {
                  label: "Inscricao",
                  done: nextRace.status === "CONFIRMED",
                  hint:
                    nextRace.status === "CONFIRMED"
                      ? "Confirmada para a largada."
                      : "Finalize a inscricao antes da prova.",
                },
                {
                  label: "Pagamento",
                  done: nextRace.paymentStatus === "PAID",
                  hint:
                    nextRace.paymentStatus === "PAID"
                      ? "Pagamento baixado."
                      : "Pagamento ainda precisa de atencao.",
                },
                {
                  label: "Calendario",
                  done: true,
                  hint: format(new Date(nextRace.eventDate), "dd 'de' MMMM yyyy", {
                    locale: ptBR,
                  }),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-[#0f233d] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      {item.label === "Calendario" ? (
                        <CalendarDays className="h-4 w-4 text-sky-200" />
                      ) : null}
                      {item.label}
                    </p>
                    <StatusBadge
                      label={item.done ? "ok" : "pendente"}
                      tone={item.done ? "positive" : "warning"}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{item.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Histórico" description="Atualização visual em tempo real">
        {loading ? (
          <div className="space-y-2">
            <div className="surface-shimmer h-12 rounded-xl" />
            <div className="surface-shimmer h-12 rounded-xl" />
            <div className="surface-shimmer h-12 rounded-xl" />
          </div>
        ) : error ? (
          <EmptyState
            title="Inscricoes indisponiveis"
            description={error}
            action={
              <ActionButton onClick={() => setReloadKey((prev) => prev + 1)} intent="secondary">
                Tentar novamente
              </ActionButton>
            }
          />
        ) : sortedRows.length === 0 ? (
          <EmptyState
            title="Você ainda não possui inscrições"
            description="Acesse provas e simule sua primeira inscrição em poucos cliques."
            action={
              <ActionButton asChild>
                <Link href="/provas">Ver provas</Link>
              </ActionButton>
            }
          />
        ) : (
          <DataTable columns={columns} data={sortedRows} getRowKey={(row) => row.id} />
        )}
      </SectionCard>

      <Modal
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancelar inscrição"
        description={`Deseja cancelar a inscrição em ${cancelTarget?.eventName ?? ""}?`}
        footer={
          <>
            <ActionButton intent="secondary" onClick={() => setCancelTarget(null)}>
              Voltar
            </ActionButton>
            <ActionButton
              intent="danger"
              onClick={async () => {
                if (!cancelTarget) return;
                try {
                  const updated = await cancelRegistration(cancelTarget, accessToken);
                  upsertInscricao(updated);
                  toast.success("Inscrição cancelada com sucesso.");
                  setCancelTarget(null);
                } catch {
                  toast.error("Não foi possível cancelar a inscrição.");
                }
              }}
            >
              Confirmar cancelamento
            </ActionButton>
          </>
        }
      />
    </div>
  );
}
