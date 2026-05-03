"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCpf } from "@/lib/cpf";
import { toast } from "sonner";
import { usePaymentStatus } from "@/components/payment/payment-status-poller";
import { PixQrCode } from "@/components/payment/pix-qrcode";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { StatusBadge } from "@/components/system/status-badge";
import {
  createRegistrationDraft,
  getAthleteIdentity,
  getRegistrations,
} from "@/services/registrations-service";
import { useInscricoesStore } from "@/store/inscricoes";
import { getEventById } from "@/services/events-service";
import { AthleteIdentity, ServiceEvent } from "@/services/types";
import { getRaceDistanceRecommendation } from "@/lib/race-recommendations";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const EMPTY_ATHLETE: AthleteIdentity = {
  name: "Atleta",
  email: "atleta@ventu.app",
  avatarUrl: null,
  memberNumber: null,
  memberSince: null,
  accountStatus: null,
  cpf: null,
  phone: null,
  city: null,
  state: null,
  birthDate: null,
  gender: null,
  sportLevel: null,
  sportGoal: null,
  nextCompetitionDate: null,
  athleteStatus: null,
  signupSource: null,
  onboardingCompletedAt: null,
  emergencyContact: null,
};

export default function InscricaoPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accessToken } = useAuthToken();
  const upsertInscricao = useInscricoesStore((state) => state.upsertInscricao);
  const setInscricoes = useInscricoesStore((state) => state.setInscricoes);
  const inscricoes = useInscricoesStore((state) => state.inscricoes);
  const [step, setStep] = useState<1 | 2>(1);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [paymentStartedAt, setPaymentStartedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const hasShownPaidToastRef = useRef(false);
  const hasHandledPaidFlowRef = useRef(false);
  const [event, setEvent] = useState<ServiceEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<AthleteIdentity>(EMPTY_ATHLETE);

  const selectedLabel = searchParams.get("distancia");
  const distance = useMemo(
    () => event?.distances.find((item) => item.label === selectedLabel) ?? event?.distances[0],
    [event, selectedLabel],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [payload, athletePayload] = await Promise.all([
          getEventById(params.id, accessToken),
          getAthleteIdentity(accessToken),
        ]);
        if (!cancelled) {
          setEvent(payload);
          setAthlete(athletePayload);
        }
      } catch {
        if (!cancelled) {
          setEvent(null);
          setError("Nao foi possivel carregar os dados de inscricao desta prova.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, params.id, reloadKey]);

  const currentRegistration = useMemo(
    () => inscricoes.find((item) => item.id === registrationId) ?? null,
    [inscricoes, registrationId],
  );

  const payment = usePaymentStatus({
    registrationId: registrationId ?? "pending-registration",
    enabled: step === 2,
    intervalMs: 5000,
    accessToken,
  });
  const flowTimeline = useMemo(
    () => [
      {
        key: "interest",
        label: "Interesse na prova",
        done: Boolean(event && distance),
        current: step === 1,
      },
      {
        key: "pending",
        label: "Inscrição pendente de pagamento",
        done:
          currentRegistration?.status === "PENDING_PAYMENT" ||
          currentRegistration?.status === "CONFIRMED",
        current: step === 2 && !payment.isPaid,
      },
      {
        key: "payment",
        label: "Pagamento confirmado",
        done: currentRegistration?.paymentStatus === "PAID" || payment.isPaid,
        current: step === 2 && payment.status === "PENDING",
      },
      {
        key: "confirmed",
        label: "Inscrição confirmada",
        done: currentRegistration?.status === "CONFIRMED" || payment.isPaid,
        current: payment.isPaid,
      },
    ],
    [
      currentRegistration?.paymentStatus,
      currentRegistration?.status,
      distance,
      event,
      payment.isPaid,
      payment.status,
      step,
    ],
  );

  useEffect(() => {
    if (step !== 2 || payment.isPaid || !paymentStartedAt) return;

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [payment.isPaid, paymentStartedAt, step]);

  const paymentProgress = useMemo(() => {
    if (payment.isPaid) return 100;
    if (step !== 2 || !paymentStartedAt) return 0;

    const elapsed = nowMs - paymentStartedAt;
    const ratio = (elapsed / 25000) * 100;
    return Math.min(96, Math.max(8, ratio));
  }, [nowMs, payment.isPaid, paymentStartedAt, step]);

  const distanceRecommendation = useMemo(() => {
    if (!event || !distance) return null;
    return getRaceDistanceRecommendation(distance, athlete, event.event_date);
  }, [athlete, distance, event]);

  const raceChecklist = useMemo(
    () => [
      {
        label: "CPF",
        done: Boolean(athlete.cpf),
        hint: athlete.cpf ? "Pronto para pagamento." : "Obrigatorio para gerar a cobranca.",
      },
      {
        label: "Contato de emergencia",
        done: Boolean(athlete.emergencyContact),
        hint: athlete.emergencyContact ? "Contato registrado." : "Inclua um contato no perfil.",
      },
      {
        label: "Dados de localizacao",
        done: Boolean(athlete.city && athlete.state),
        hint:
          athlete.city && athlete.state
            ? `${athlete.city}/${athlete.state}`
            : "Ajuda na logistica da produtora.",
      },
      {
        label: "Pagamento",
        done: payment.isPaid,
        hint: payment.isPaid ? "Confirmado." : step === 2 ? "Aguardando PIX." : "Proximo passo.",
      },
    ],
    [
      athlete.city,
      athlete.cpf,
      athlete.emergencyContact,
      athlete.state,
      payment.isPaid,
      step,
    ],
  );

  useEffect(() => {
    hasHandledPaidFlowRef.current = false;
    hasShownPaidToastRef.current = false;
  }, [registrationId]);

  useEffect(() => {
    if (step !== 2 || !payment.isPaid) return;
    if (hasHandledPaidFlowRef.current) return;
    hasHandledPaidFlowRef.current = true;

    void (async () => {
      try {
        const updatedRegistrations = await getRegistrations(accessToken);
        setInscricoes(updatedRegistrations);
      } catch {
        toast.error("Nao foi possivel atualizar o status da inscricao.");
      }
    })();

    if (!hasShownPaidToastRef.current) {
      toast.success(`Inscrição confirmada para ${event?.name ?? "a prova"}! Boa corrida!`, {
        duration: 5000,
      });
      hasShownPaidToastRef.current = true;
    }

    const timer = setTimeout(() => {
      router.push("/minhas-inscricoes");
    }, 2200);

    return () => clearTimeout(timer);
  }, [accessToken, event?.name, payment.isPaid, router, setInscricoes, step]);

  if (loading) {
    return <LoadingState lines={4} />;
  }

  if (!event || !distance) {
    return (
      <EmptyState
        title="Inscricao indisponivel"
        description={error ?? "Nao foi possivel preparar sua inscricao para esta prova."}
        action={
          <ActionButton intent="secondary" onClick={() => setReloadKey((prev) => prev + 1)}>
            Tentar novamente
          </ActionButton>
        }
      />
    );
  }

  if (payment.isPaid) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="success-pop rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-10 py-10 text-center text-emerald-100">
          <CheckCircle2 className="mx-auto mb-3 h-20 w-20 text-emerald-300" />
          <h2 className="text-2xl font-bold text-emerald-300">Inscrição confirmada!</h2>
          <p className="mt-2 text-sm text-emerald-100">
            {event.name} • {distance.label}
          </p>
          <p className="mt-1 text-sm">Redirecionando para suas inscrições...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">Inscrição - {event.name}</h1>
        <p className="text-sm text-slate-300">
          {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </header>

      {step === 1 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-white/10 bg-[linear-gradient(180deg,#1a3557,#142b47)] text-white">
            <CardHeader>
              <CardTitle>Resumo da inscrição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <p>Prova: {event.name}</p>
              <p>Distância: {distance.label}</p>
              <p>Valor: {currency.format(distance.price_cents / 100)}</p>
              {distanceRecommendation ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-[#0F2743] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-200">
                      Leitura esportiva
                    </p>
                    <StatusBadge
                      label={distanceRecommendation.label}
                      tone={distanceRecommendation.tone}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    {distanceRecommendation.reason}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[linear-gradient(180deg,#1a3557,#142b47)] text-white">
            <CardHeader>
              <CardTitle>Dados do atleta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-200">
              <p>Nome: {athlete.name}</p>
              <p>Email: {athlete.email}</p>
              <p>
                CPF:{" "}
                {athlete.cpf ? (
                  <span className="font-medium text-white">{formatCpf(athlete.cpf)}</span>
                ) : (
                  <span className="text-amber-300">Não informado</span>
                )}
              </p>
              {athlete.city || athlete.state ? (
                <p>Localização: {[athlete.city, athlete.state].filter(Boolean).join(" / ")}</p>
              ) : null}

              {!athlete.cpf ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="font-semibold text-amber-200">CPF obrigatório para continuar</p>
                    <p className="mt-0.5 text-xs text-amber-100/80">
                      Para gerar o pagamento PIX, você precisa cadastrar seu CPF.
                    </p>
                    <Link
                      href="/perfil"
                      className="mt-2 inline-block rounded-lg bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/30"
                    >
                      Completar perfil agora ?
                    </Link>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[linear-gradient(180deg,#1a3557,#142b47)] text-white lg:col-span-2">
            <CardHeader>
              <CardTitle>Checklist do dia da prova</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-4">
                {raceChecklist.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <StatusBadge
                        label={item.done ? "ok" : "pendente"}
                        tone={item.done ? "positive" : "warning"}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{item.hint}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <Card className="mb-4 border-white/10 bg-[linear-gradient(180deg,#1a3557,#142b47)] text-white">
              <CardHeader>
                <CardTitle>Linha do tempo da inscrição</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {flowTimeline.map((item, index) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F2743] px-3 py-2"
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          item.done
                            ? "bg-emerald-500/25 text-emerald-100"
                            : item.current
                              ? "bg-amber-400/25 text-amber-100"
                              : "bg-slate-500/20 text-slate-300"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <p className="text-sm text-slate-200">{item.label}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            {!athlete.cpf ? (
              <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
                <p className="text-sm text-amber-200">
                  Cadastre seu CPF em{" "}
                  <Link href="/perfil" className="font-semibold underline hover:text-amber-300">
                    Meu Perfil
                  </Link>{" "}
                  para prosseguir com a inscrição.
                </p>
              </div>
            ) : (
              <Button
                className="bg-[#F5A623] font-semibold text-[#0A1628] hover:bg-[#e59a1f]"
                onClick={async () => {
                  try {
                    const created = await createRegistrationDraft(
                      {
                        eventId: event.id,
                        distanceId: distance.id,
                      },
                      accessToken,
                    );
                    setRegistrationId(created.id);
                    setPaymentStartedAt(Date.now());
                    setNowMs(Date.now());
                    hasShownPaidToastRef.current = false;
                    upsertInscricao(created);
                    toast.success("Inscrição criada. Gerando cobrança PIX...");
                    setStep(2);
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "Não foi possível iniciar a inscrição.";
                    if (message.toLowerCase().includes("cpf obrigat")) {
                      toast.error(
                        "CPF obrigatório para inscrição. Complete seu perfil para continuar.",
                      );
                      router.push("/perfil");
                      return;
                    }
                    toast.error(message);
                  }
                }}
              >
                Confirmar e ir para pagamento
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <PixQrCode
              pixCode={payment.pixCode ?? currentRegistration?.id ?? "PIX-PENDENTE"}
              expiresAt={
                new Date(payment.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString())
              }
              amountLabel={currency.format((payment.amountCents ?? distance.price_cents) / 100)}
            />
            <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
              <p className="mb-2 text-sm text-slate-200 animate-pulse">Aguardando pagamento...</p>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#f5a623,#38bdf8)] transition-all duration-300"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
            </div>
          </div>

          <Card className="border-white/10 bg-[linear-gradient(180deg,#1a3557,#142b47)] text-white">
            <CardHeader>
              <CardTitle>Status do pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className="bg-amber-400/20 text-amber-100 border-amber-300/40">
                {payment.status}
              </Badge>
              <p className="text-sm text-slate-300">Atualização automática a cada 5 segundos.</p>
              {payment.error ? <p className="text-xs text-amber-200">{payment.error}</p> : null}
              <p className="text-xs text-slate-400">
                O status muda automaticamente quando o pagamento for confirmado no backend.
              </p>

              <div className="mt-3 rounded-xl border border-white/10 bg-[#0F2743] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.08em] text-slate-300">
                  Linha do tempo
                </p>
                <ol className="space-y-2">
                  {flowTimeline.map((item, index) => (
                    <li key={item.key} className="flex items-center gap-2">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                          item.done
                            ? "bg-emerald-500/25 text-emerald-100"
                            : item.current
                              ? "bg-amber-400/25 text-amber-100"
                              : "bg-slate-500/20 text-slate-300"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span className="text-xs text-slate-200">{item.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
