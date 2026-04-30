import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  MapPin,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const showcaseCards = [
  {
    title: "Praia do Campeche",
    image: "/auth/praia-campeche-card.webp",
    metric: "Rota 12K",
  },
  {
    title: "Beira-Mar Norte",
    image: "/auth/beira-mar-card.png",
    metric: "Treino 6h",
  },
  {
    title: "Mercado Público",
    image: "/auth/mercado-publico-card.png",
    metric: "Encontro oficial",
  },
];

const platformStats = [
  { value: "94%", label: "presença confirmada" },
  { value: "18", label: "treinos ajustados" },
  { value: "3", label: "alertas financeiros" },
];

const valuePoints = [
  {
    icon: Activity,
    title: "Dados que viram performance",
    description: "Métricas de carga, evolução, presença e prova no mesmo fluxo.",
  },
  {
    icon: BrainCircuit,
    title: "IA para orientar decisões",
    description: "Sugestões de treino e atenção ao risco antes de virar problema.",
  },
  {
    icon: WalletCards,
    title: "Operação conectada",
    description: "Financeiro recorrente, inscrições, pontuação e comunicação integrados.",
  },
];

const todayPlan = [
  { label: "Carga semanal", value: "78%", icon: TrendingUp },
  { label: "Sessões de hoje", value: "14", icon: CalendarCheck2 },
  { label: "Próxima revisão", value: "18:30", icon: Clock3 },
];

export function AuthShell({
  children,
  title,
  description,
  fitViewport = false,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  fitViewport?: boolean;
}) {
  return (
    <div
      className={
        fitViewport
          ? "relative h-svh overflow-hidden bg-[#030817] text-white"
          : "relative min-h-svh overflow-x-hidden bg-[#030817] text-white"
      }
    >
      <Image
        src="/auth/floripa-bridge-hero.webp"
        alt="Ponte Hercílio Luz em Florianópolis ao entardecer"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,23,0.92)_0%,rgba(2,8,23,0.68)_42%,rgba(2,8,23,0.94)_100%)] lg:bg-[linear-gradient(90deg,rgba(2,8,23,0.9)_0%,rgba(2,8,23,0.58)_38%,rgba(2,8,23,0.24)_58%,rgba(2,8,23,0.86)_100%),linear-gradient(180deg,rgba(2,8,23,0.08)_0%,rgba(2,8,23,0.78)_100%)]" />

      <div
        className={
          fitViewport
            ? "relative z-10 flex h-svh px-3 py-2 sm:px-5 lg:px-8 lg:py-3 xl:px-10"
            : "relative z-10 flex min-h-svh px-4 py-4 sm:px-6 lg:px-10 lg:py-7 xl:px-14"
        }
      >
        <div
          className={
            fitViewport
              ? "grid h-full w-full items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(27rem,0.62fr)] lg:gap-5"
              : "grid w-full items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(30rem,0.74fr)] lg:items-center lg:gap-8"
          }
        >
          <section
            className={
              fitViewport
                ? "hidden h-full min-h-0 flex-col justify-center gap-4 overflow-hidden lg:flex"
                : "hidden min-h-[calc(100svh-3.5rem)] flex-col justify-center gap-7 lg:flex"
            }
          >
            <div
              className={
                fitViewport
                  ? "grid items-center gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]"
                  : "grid items-center gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
              }
            >
              <div className="max-w-[38rem]">
                <Image
                  src="/auth/ventu-suli-logo.png"
                  alt="Logo Ventu Suli"
                  width={620}
                  height={620}
                  className={
                    fitViewport
                      ? "h-auto w-[18rem] max-w-full xl:w-[22rem] 2xl:w-[24rem]"
                      : "h-auto w-[30rem] max-w-full xl:w-[34rem] 2xl:w-[36rem]"
                  }
                />

                <h1
                  className={
                    fitViewport
                      ? "mt-1 max-w-[13ch] text-[2rem] font-semibold leading-[0.98] text-white xl:text-[2.45rem]"
                      : "mt-2 max-w-[12ch] text-[2.45rem] font-semibold leading-[0.96] text-white xl:text-[3.2rem]"
                  }
                >
                  Transforme treinos em <span className="text-[#f7b529]">evolução real.</span>
                </h1>
                <p
                  className={
                    fitViewport
                      ? "mt-2 max-w-[28rem] text-sm leading-6 text-slate-50/95 xl:text-base"
                      : "mt-3 max-w-[30rem] text-base leading-7 text-slate-50/95 xl:text-lg"
                  }
                >
                  Conecte dados, disciplina e propósito para alcançar sua melhor versão.
                </p>

                <div
                  className={
                    fitViewport
                      ? "mt-3 grid max-w-[30rem] grid-cols-3 gap-2"
                      : "mt-4 grid max-w-[33rem] grid-cols-3 gap-2"
                  }
                >
                  {platformStats.map((stat) => (
                    <div
                      key={stat.label}
                      className={
                        fitViewport
                          ? "rounded-xl border border-white/14 bg-[#061225]/70 px-3 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-sm"
                          : "rounded-xl border border-white/14 bg-[#061225]/70 px-3 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-sm"
                      }
                    >
                      <p className="text-xl font-black text-[#f7b529]">{stat.value}</p>
                      <p className="mt-1 text-[0.7rem] font-semibold uppercase leading-4 text-slate-100/80">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className={fitViewport ? "hidden 2xl:mt-3 2xl:block 2xl:space-y-2" : "mt-4 space-y-2.5"}>
                  {valuePoints.map(({ icon: Icon, title: pointTitle, description: pointDescription }) => (
                    <div key={pointTitle} className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/16 bg-[#071225]/78 text-[#f7b529] shadow-[0_12px_35px_rgba(0,0,0,0.24)] backdrop-blur-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">{pointTitle}</p>
                        <p className="mt-1 max-w-[27rem] text-sm leading-5 text-slate-50/90">
                          {pointDescription}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={fitViewport ? "hidden" : "mt-6 flex items-start gap-4 text-white/95"}>
                  <Quote className="mt-1 h-8 w-8 shrink-0 fill-[#f7b529] text-[#f7b529]" />
                  <p className="max-w-[25rem] text-xl font-medium leading-tight xl:text-2xl">
                    Disciplina constrói o que motivação{" "}
                    <span className="text-[#f7b529]">não sustenta.</span>
                  </p>
                </div>
              </div>

              <aside className={fitViewport ? "hidden" : "hidden space-y-4 xl:block"}>
                <div className="rounded-[1.4rem] border border-white/18 bg-[#050d1c]/78 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#f7b529]">
                        Inteligência ativa
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">Semana 4/8</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7b529] text-[#071225]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Risco de fadiga</span>
                      <span className="font-semibold text-emerald-300">baixo</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[72%] rounded-full bg-[#f7b529]" />
                    </div>
                    <p className="mt-3 text-sm leading-5 text-slate-200">
                      A IA reduziu intensidade de 2 sessões e manteve o volume-alvo.
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {todayPlan.map(({ icon: Icon, label, value }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5"
                      >
                        <span className="flex items-center gap-2 text-sm text-slate-300">
                          <Icon className="h-4 w-4 text-[#f7b529]" />
                          {label}
                        </span>
                        <span className="text-sm font-bold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/14 bg-[#061225]/78 p-4 backdrop-blur-xl">
                    <BarChart3 className="h-5 w-5 text-[#f7b529]" />
                    <p className="mt-3 text-2xl font-black text-white">42K</p>
                    <p className="mt-1 text-xs leading-4 text-slate-300">
                      meta principal monitorada
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/14 bg-[#061225]/78 p-4 backdrop-blur-xl">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-2xl font-black text-white">MFA</p>
                    <p className="mt-1 text-xs leading-4 text-slate-300">
                      acesso protegido por padrão
                    </p>
                  </div>
                </div>
              </aside>
            </div>

            <div className={fitViewport ? "hidden" : "hidden max-w-[56rem] grid-cols-3 gap-3 2xl:grid"}>
              {showcaseCards.map((card) => (
                <div
                  key={card.title}
                  className="relative aspect-[1.95] overflow-hidden rounded-xl border border-white/25 bg-black/25 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                >
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    sizes="28vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/18 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex min-h-12 items-center justify-between gap-2 bg-black/50 px-4 py-2 backdrop-blur-[2px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-5 w-5 shrink-0 fill-[#f7b529] text-[#f7b529]" />
                      <span className="truncate text-xs font-bold uppercase text-white xl:text-sm">
                        {card.title}
                      </span>
                    </span>
                    <span className="hidden rounded-full bg-[#f7b529]/18 px-2 py-1 text-[0.68rem] font-bold uppercase text-[#ffd27a] xl:block">
                      {card.metric}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            className={
              fitViewport
                ? "flex h-full min-h-0 items-center justify-center overflow-hidden lg:justify-end"
                : "flex min-h-[calc(100svh-2rem)] items-start justify-center py-2 sm:items-center lg:min-h-[calc(100svh-3.5rem)] lg:justify-end lg:py-0"
            }
          >
            <div className="relative z-10 w-full max-w-[35rem]">
              <div
                className={
                  fitViewport
                    ? "mb-2 flex items-center justify-center lg:hidden"
                    : "mb-4 flex items-center justify-center lg:hidden"
                }
              >
                <Link href="/login" className="flex flex-col items-center gap-2 text-center">
                  <Image
                    src="/auth/ventu-suli-logo.png"
                    alt="Logo Ventu Suli"
                    width={168}
                    height={168}
                    className={
                      fitViewport ? "h-16 w-16 sm:h-20 sm:w-20" : "h-28 w-28 sm:h-32 sm:w-32"
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd27a] sm:text-sm sm:tracking-[0.28em]">
                      Ventu Suli
                    </p>
                    <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                      Evolução, performance e comunidade
                    </p>
                  </div>
                </Link>
              </div>

              <div className={fitViewport ? "hidden" : "mb-3 hidden grid-cols-3 gap-2 sm:grid lg:hidden"}>
                {platformStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-white/14 bg-[#061225]/72 px-2 py-2.5 text-center backdrop-blur-sm"
                  >
                    <p className="text-base font-black text-[#f7b529] sm:text-lg">{stat.value}</p>
                    <p className="mt-1 text-[0.58rem] font-semibold uppercase leading-3 text-slate-100/80 sm:text-[0.62rem]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className={fitViewport ? "hidden" : "mb-3 hidden gap-2 sm:grid sm:grid-cols-3 lg:hidden"}>
                {valuePoints.map(({ icon: Icon, title: pointTitle }) => (
                  <div
                    key={pointTitle}
                    className="flex items-center gap-2 rounded-lg border border-white/12 bg-[#061225]/72 px-3 py-2 text-xs font-semibold text-slate-100 backdrop-blur-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#f7b529]" />
                    <span className="min-w-0 leading-4">{pointTitle}</span>
                  </div>
                ))}
              </div>

              <div
                className={
                  fitViewport
                    ? "rounded-[1.1rem] border border-white/25 bg-[linear-gradient(180deg,rgba(7,13,27,0.98),rgba(2,9,19,0.96))] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:p-4 lg:px-5 lg:py-5"
                    : "rounded-[1.1rem] border border-white/25 bg-[linear-gradient(180deg,rgba(7,13,27,0.98),rgba(2,9,19,0.96))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:rounded-[1.7rem] sm:p-7 lg:px-9 lg:py-8"
                }
              >
                <div className={fitViewport ? "hidden" : "mb-4 hidden flex-wrap items-center justify-between gap-2 sm:flex sm:mb-5 sm:gap-3"}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/24 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Sistema online
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#f7b529]/22 bg-[#f7b529]/10 px-3 py-1.5 text-xs font-semibold text-[#ffd27a]">
                    <ShieldCheck className="h-4 w-4" />
                    Acesso protegido
                  </span>
                </div>

                <div className={fitViewport ? "mb-3" : "mb-4 sm:mb-6"}>
                  <h2
                    className={
                      fitViewport
                        ? "text-[1.32rem] font-semibold leading-tight text-white sm:text-[1.55rem]"
                        : "text-[1.58rem] font-semibold leading-tight text-white sm:text-[2.05rem]"
                    }
                  >
                    {title}
                  </h2>
                  <p
                    className={
                      fitViewport
                        ? "mt-1 max-w-lg text-xs leading-5 text-slate-100 sm:text-sm"
                        : "mt-1.5 max-w-lg text-sm leading-5 text-slate-100 sm:mt-3 sm:text-base sm:leading-7"
                    }
                  >
                    {description}
                  </p>
                </div>
                {children}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
