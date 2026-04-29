import Image from "next/image";
import Link from "next/link";
import { Activity, MapPin, Quote, Trophy, Users } from "lucide-react";

const showcaseCards = [
  {
    title: "Praia do Campeche",
    image: "/auth/praia-campeche-card.webp",
  },
  {
    title: "Beira-Mar Norte",
    image: "/auth/beira-mar-card.png",
  },
  {
    title: "Mercado Publico",
    image: "/auth/mercado-publico-card.png",
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
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[#050b16] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,179,43,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,72,139,0.35),transparent_36%),linear-gradient(135deg,rgba(4,9,20,0.92),rgba(4,9,20,0.55))]" />
      <div className="relative z-10 h-svh lg:grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden h-svh overflow-hidden lg:flex">
          <Image
            src="/auth/floripa-bridge-hero.webp"
            alt="Ponte Hercilio Luz em Florianopolis ao entardecer"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,9,20,0.84),rgba(4,9,20,0.42),rgba(4,9,20,0.16)),linear-gradient(180deg,rgba(6,12,25,0.06),rgba(6,12,25,0.76))]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-8 xl:p-12 2xl:p-14">
            <div className="max-w-[34rem]">
              <Image
                src="/auth/ventu-suli-logo.png"
                alt="Logo Ventu Suli"
                width={224}
                height={224}
                className="h-auto w-32 xl:w-40 2xl:w-48"
              />

              <h1 className="mt-5 max-w-[11ch] text-[2.8rem] font-semibold leading-[0.94] text-white xl:text-6xl 2xl:text-[4.4rem]">
                Transforme treinos em <span className="text-[#f7b529]">evolucao real.</span>
              </h1>
              <p className="mt-4 max-w-[28rem] text-base leading-7 text-slate-100/90 2xl:text-lg 2xl:leading-8">
                Conecte dados, disciplina e proposito para alcancar sua melhor versao.
              </p>

              <div className="mt-6 space-y-4 2xl:mt-8 2xl:space-y-5">
                {valuePoints.map(({ icon: Icon, title: pointTitle, description: pointDescription }) => (
                  <div key={pointTitle} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-[#091224]/80 text-[#f7b529] shadow-[0_8px_30px_rgba(0,0,0,0.2)] 2xl:h-12 2xl:w-12">
                      <Icon className="h-4 w-4 2xl:h-5 2xl:w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white 2xl:text-lg">{pointTitle}</p>
                      <p className="mt-1 max-w-[24rem] text-sm leading-5 text-slate-200/85 2xl:leading-6">{pointDescription}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex items-start gap-4 text-white/95 max-[900px]:hidden 2xl:mt-9">
                <Quote className="mt-1 h-8 w-8 shrink-0 text-[#f7b529]" />
                <p className="max-w-[24rem] text-[1.7rem] font-medium leading-tight 2xl:text-3xl">
                  Disciplina constroi o que a motivacao <span className="text-[#f7b529]">nao sustenta.</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 max-[980px]:hidden">
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

        <section className="relative flex h-svh items-center justify-center overflow-hidden px-3 py-3 sm:px-6 sm:py-4 lg:px-8 xl:py-6">
          <div className="absolute inset-0 lg:hidden">
            <Image
              src="/auth/floripa-bridge-hero.webp"
              alt="Ponte Hercilio Luz"
              fill
              priority
              className="object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,20,0.86),rgba(4,9,20,0.98))]" />
          </div>

          <div className="relative z-10 w-full max-w-[34rem]">
            <div className="mb-3 flex items-center justify-between sm:mb-5 lg:hidden">
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

            <div className="mb-4 hidden grid-cols-2 gap-2 sm:mb-5 sm:grid sm:grid-cols-3 lg:hidden">
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

            <div className="rounded-[1.5rem] border border-white/14 bg-[linear-gradient(180deg,rgba(9,18,34,0.96),rgba(6,12,25,0.92))] p-3.5 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-[2rem] sm:p-6 lg:p-8 xl:p-10">
              <div className="mb-4 sm:mb-6 xl:mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f7b529] sm:text-sm sm:tracking-[0.24em]">
                  Acesso seguro
                </p>
                <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight text-white sm:mt-3 sm:text-4xl">{title}</h2>
                <p className="mt-2 max-w-lg text-sm leading-5 text-slate-300 sm:mt-3 sm:text-base sm:leading-7">{description}</p>
              </div>
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
