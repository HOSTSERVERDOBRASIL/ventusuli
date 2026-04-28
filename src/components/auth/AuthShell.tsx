import Image from "next/image";
import Link from "next/link";
import { Activity, MapPin, Trophy, Users } from "lucide-react";

const showcaseCards = [
  {
    title: "Praia do Campeche",
    image: "/auth/campeche.webp",
  },
  {
    title: "Beira-Mar Norte",
    image: "/auth/beira-mar.png",
  },
  {
    title: "Mercado Publico",
    image: "/auth/mercado-publico.png",
  },
];

const valuePoints = [
  {
    icon: Activity,
    title: "Dados que viram performance",
    description: "Acompanhe metricas que realmente importam para sua evolucao.",
  },
  {
    icon: Users,
    title: "Comunidade que impulsiona",
    description: "Treino, disciplina e identidade local em uma so jornada.",
  },
  {
    icon: Trophy,
    title: "Resultados que voce mede",
    description: "Consistencia clara, metas visiveis e proximos passos objetivos.",
  },
];

export function AuthShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[#050b16] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,179,43,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,72,139,0.35),transparent_36%),linear-gradient(135deg,rgba(4,9,20,0.92),rgba(4,9,20,0.55))]" />
      <div className="relative z-10 min-h-svh lg:grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden min-h-svh overflow-hidden lg:flex">
          <Image
            src="/auth/hercules-sunrise.webp"
            alt="Ponte Hercilio Luz ao amanhecer"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,9,20,0.75),rgba(4,9,20,0.35)),linear-gradient(180deg,rgba(6,12,25,0.1),rgba(6,12,25,0.78))]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <div className="max-w-[36rem]">
              <Image
                src="/auth/ventu-suli-logo.png"
                alt="Logo Ventu Suli"
                width={188}
                height={188}
                className="h-auto w-36 xl:w-44"
              />
              <p className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.38em] text-[#ffd27a]">
                Floripa performance club
              </p>
              <h1 className="mt-5 max-w-[13ch] text-5xl font-semibold leading-[0.95] text-white xl:text-7xl">
                Transforme treinos em <span className="text-[#f7b529]">evolucao real.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200/90">
                Conecte dados, disciplina e comunidade para alcancar sua melhor versao.
              </p>

              <div className="mt-9 space-y-4">
                {valuePoints.map(({ icon: Icon, title: pointTitle, description: pointDescription }) => (
                  <div
                    key={pointTitle}
                    className="flex items-start gap-4 rounded-2xl border border-white/12 bg-white/6 p-4 backdrop-blur-sm"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#f7b529]/30 bg-[#f7b529]/10 text-[#f7b529]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">{pointTitle}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-200/85">{pointDescription}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-8 text-3xl font-medium leading-tight text-white/95">
                Disciplina constroi o que a motivacao nao sustenta.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {showcaseCards.map((card) => (
                <div
                  key={card.title}
                  className="overflow-hidden rounded-[1.4rem] border border-white/15 bg-black/25 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                >
                  <div className="relative aspect-[1.18]">
                    <Image src={card.image} alt={card.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <MapPin className="h-4 w-4 text-[#f7b529]" />
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-white">
                      {card.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-svh items-center justify-center px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          <div className="absolute inset-0 lg:hidden">
            <Image
              src="/auth/hercules-sunrise.webp"
              alt="Ponte Hercilio Luz"
              fill
              priority
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,20,0.9),rgba(4,9,20,0.98))]" />
          </div>

          <div className="relative z-10 w-full max-w-[34rem]">
            <div className="mb-5 flex items-center justify-between lg:hidden">
              <Link href="/login" className="flex items-center gap-3">
                <Image
                  src="/auth/ventu-suli-logo.png"
                  alt="Logo Ventu Suli"
                  width={56}
                  height={56}
                  className="h-11 w-11 sm:h-14 sm:w-14"
                />
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#ffd27a] sm:text-xs sm:tracking-[0.28em]">
                    Ventu Suli
                  </p>
                  <p className="text-xs text-slate-300 sm:text-sm">Evolucao, performance e comunidade</p>
                </div>
              </Link>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:grid-cols-3 lg:hidden">
              {showcaseCards.map((card) => (
                <div
                  key={card.title}
                  className="relative aspect-[1.35] overflow-hidden rounded-xl border border-white/12 last:col-span-2 sm:last:col-span-1"
                >
                  <Image src={card.image} alt={card.title} fill sizes="33vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <p className="absolute bottom-2 left-2 right-2 text-[0.62rem] font-semibold uppercase tracking-[0.05em] text-white sm:tracking-[0.08em]">
                    {card.title}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.75rem] border border-white/14 bg-[linear-gradient(180deg,rgba(9,18,34,0.96),rgba(6,12,25,0.92))] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-[2rem] sm:p-8 lg:p-10">
              <div className="mb-6 sm:mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f7b529]">Acesso seguro</p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">{title}</h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{description}</p>
              </div>
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
